"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { FaArrowLeft, FaSync } from "react-icons/fa"
import type { User } from "@supabase/supabase-js"
import { useState, useCallback, useEffect, useRef } from "react"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import GameLoading from "./game-loading"
import GameError from "./game-error"
import type { RealtimeChannel } from "@supabase/supabase-js"

interface Profile {
  id: string
  username: string
}

interface GameState {
  id: string
  lobby_id: string
  size: number
  score: number
  is_popped: boolean 
  current_player: string
  remaining_pumps: number
  turn_timer: number
  pop_threshold: number
  status: 'waiting' | 'playing' | 'waiting_turn' | 'finished'
  winner: string | null
  player1: string
  player2: string | null
  created_at: string
}

interface PlayerStats {
  total_games: number
  wins: number
  highest_score: number
  average_score: number
}

interface MatchHistory {
  id: string
  winner_id: string
  loser_id: string
  final_score: number
  created_at: string
}

interface BalloonGameProps {
  lobbyId: string
  currentUser: User | null
}

export default function BalloonGame({ lobbyId, currentUser }: BalloonGameProps) {
  const router = useRouter()
  const supabase = createClientComponentClient()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [players, setPlayers] = useState<Profile[]>([])
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [highScore, setHighScore] = useState(0)
  const [playerStats, setPlayerStats] = useState<Record<string, PlayerStats>>({})
  const [matchHistory, setMatchHistory] = useState<MatchHistory[]>([])
  const gameStateIdRef = useRef<string | null>(null)

  const retryRequest = async <T,>(fn: () => Promise<T>, maxRetries = 3, delayMs = 500): Promise<T> => {
    let lastError: unknown
    for (let i = 0; i < maxRetries; i++) {
      try {
        const result = await fn()
        return result
      } catch (err) {
        console.log(`Request attempt ${i + 1} failed:`, err)
        lastError = err
        if (i < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, delayMs))
        }
      }
    }
    throw lastError
  }

  useEffect(() => {
    let isActive = true
    let gameStateSubscription: RealtimeChannel | null = null
    let pollInterval: NodeJS.Timeout | null = null

    async function setupRealtimeSubscription(gameId: string) {
      if (!isActive) return
      
      try {
        if (gameStateSubscription) {
          await gameStateSubscription.unsubscribe()
        }

        gameStateSubscription = supabase
          .channel(`balloon_game_${gameId}`)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "balloon_game_states", 
              filter: `id=eq.${gameId}`
            },
            async payload => {
              if (!isActive) return
              console.log('Received game state update:', payload)
              const newState = payload.new as GameState
              setGameState(newState)

              const updatedPlayerIds = [newState.player1, newState.player2].filter(Boolean)
              if (updatedPlayerIds.length > 0) {
                const { data: updatedProfiles } = await retryRequest(async () =>
                  supabase
                    .from("profiles")
                    .select("*")
                    .in("id", updatedPlayerIds)
                )

                if (isActive && updatedProfiles) {
                  setPlayers(updatedProfiles)
                }
              }
            }
          );
        gameStateSubscription.subscribe();
        console.log('Successfully subscribed to game updates')
      } catch (err) {
        console.error('Error setting up subscription:', err)
        setTimeout(() => {
          if (isActive) {
            setupRealtimeSubscription(gameId)
          }
        }, 1000)
      }
    }

    async function fetchLatestGameState() {
      if (!gameStateIdRef.current || !isActive) return

      try {
        const { data, error } = await supabase
          .from("balloon_game_states")
          .select("*")
          .eq("id", gameStateIdRef.current)
          .single()

        if (error) throw error
        if (isActive && data) {
          setGameState(data)
        }
      } catch (err) {
        console.error("Error polling game state:", err)
      }
    }

    async function loadGameData() {
      try {
        if (!currentUser) {
          router.push("/")
          return
        }

        // Check if game state exists - with retry
        const { data: freshGameState, error: gameStateError } = await retryRequest(async () => 
          supabase
            .from("balloon_game_states")
            .select("*")
            .eq("lobby_id", lobbyId)
            .single()
        )

        if (gameStateError && gameStateError.code !== "PGRST116") {
          throw gameStateError
        }

        let gameStateData = freshGameState

        // Initialize new game state if none exists
        if (!gameStateData) {
          console.log('Creating new game state...')
          try {
            const { data: newGameState, error: createError } = await retryRequest(async () =>
              supabase
                .from("balloon_game_states")
                .insert({
                  lobby_id: lobbyId,
                  player1: currentUser.id,
                  current_player: currentUser.id,
                  pop_threshold: Math.floor(Math.random() * 100) + 50,
                  size: 24,
                  score: 0,
                  is_popped: false,
                  remaining_pumps: 3,
                  turn_timer: 10,
                  status: "waiting"
                })
                .select()
                .single()
            )

            if (createError) {
              if (createError.code === '23505') { // Unique violation
                console.log('Game already exists, fetching existing game...')
                const { data: existingGame, error: fetchError } = await retryRequest(async () =>
                  supabase
                    .from("balloon_game_states")
                    .select("*")
                    .eq("lobby_id", lobbyId)
                    .single()
                )
                if (fetchError) throw fetchError
                gameStateData = existingGame
              } else {
                console.error('Error creating game:', createError)
                throw createError
              }
            } else {
              console.log('Created new game state:', newGameState)
              gameStateData = newGameState
            }
          } catch (err) {
            console.error('Error in game creation/fetch:', err)
            throw err
          }
        }
        // Join as player 2 if possible
        else if (!gameStateData.player2 && gameStateData.player1 !== currentUser.id) {
          console.log('Joining as player 2...')
          const { data: updatedState, error: joinError } = await retryRequest(async () =>
            supabase.rpc("join_balloon_game", {
              p_game_state_id: gameStateData.id,
              p_player2: currentUser.id
            })
          )

          if (joinError) {
            const { data: latestState, error: fetchError } = await supabase
              .from("balloon_game_states")
              .select("*")
              .eq("id", gameStateData.id)
              .single()

            if (fetchError) throw fetchError

            if (latestState.player2 === currentUser.id) {
              gameStateData = latestState
            } else {
              throw joinError
            }
          } else {
            console.log('Joined game as player 2:', updatedState)
            gameStateData = updatedState
          }
        }

        if (isActive) {
          console.log('Setting game state:', gameStateData)
          setGameState(gameStateData)
          gameStateIdRef.current = gameStateData.id
          await setupRealtimeSubscription(gameStateData.id)
        }

        // Get plr profiles
        const playerIds = [gameStateData.player1, gameStateData.player2].filter(Boolean)
        if (playerIds.length > 0) {
          console.log('Fetching player profiles...')
          const { data: profiles, error: profileError } = await retryRequest(async () =>
            supabase
              .from("profiles")
              .select("*")
              .in("id", playerIds)
          )

          if (profileError) {
            console.error('Error fetching profiles:', profileError)
          } else if (isActive && profiles) {
            console.log('Setting player profiles:', profiles)
            setPlayers(profiles)
          }
        }

      } catch (err: unknown) {
        console.error("Error loading game data:", err)
        if (isActive) {
          if (err instanceof Error) {
            setError(err.message)
          } else if (typeof err === 'object' && err !== null && 'message' in err) {
            setError(String(err.message))
          } else {
            setError("Failed to load game data")
          }
        }
      } finally {
        if (isActive) setLoading(false)
      }
    }

    loadGameData()

    pollInterval = setInterval(fetchLatestGameState, 5000)

    return () => {
      console.log('Cleanup: unsubscribing and clearing intervals')
      isActive = false
      if (gameStateSubscription) gameStateSubscription.unsubscribe()
      if (pollInterval) clearInterval(pollInterval)
    }
  }, [lobbyId, router, supabase, currentUser])

  useEffect(() => {
    async function loadPlayerStats() {
      if (!players.length) return

      try {
        const playerIds = players.map(p => p.id)
        const { data: stats, error: statsError } = await supabase
          .from('player_stats')
          .select('*')
          .in('player_id', playerIds)

        if (statsError) throw statsError

        const statsMap: Record<string, PlayerStats> = {}
        stats.forEach((stat: { player_id: string; total_games: number; wins: number; highest_score: number; average_score: number }) => {
          statsMap[stat.player_id] = {
            total_games: stat.total_games,
            wins: stat.wins,
            highest_score: stat.highest_score,
            average_score: stat.average_score
          }
        })
        setPlayerStats(statsMap)

        // Fetch recent match history
        const { data: history, error: historyError } = await supabase
          .from('match_history')
          .select('*')
          .or(`winner_id.in.(${playerIds}),loser_id.in.(${playerIds})`)
          .order('created_at', { ascending: false })
          .limit(5)

        if (historyError) throw historyError
        setMatchHistory(history)
      } catch (err) {
        console.error('Error loading player stats:', err)
      }
    }

    loadPlayerStats()
  }, [players, supabase])

  const handlePump = useCallback(async () => {
    if (!gameState || !currentUser || gameState.is_popped || gameState.current_player !== currentUser.id) return

    try {
      const { data, error } = await supabase.rpc("pump_balloon", {
        game_state_id: gameState.id
      })

      if (error) throw error

      if (data) {
        setGameState(data)
        
        // Record the win-
        if (data.is_popped) {
          const winnerId = data.player1 === currentUser.id ? data.player2 : data.player1
          try {
            const response = await fetch('/api/record-win', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                gameStateId: data.id,
                winnerId
              })
            })
            if (!response.ok) {
              throw new Error('Failed to record win')
            }
          } catch (err) {
            console.error('Error recording win:', err)
          }
        }
      }

      if (data?.is_popped && data.score > highScore) {
        setHighScore(data.score)
      }
    } catch (err) {
      console.error("Error pumping balloon:", err)
    }
  }, [gameState, currentUser, highScore, supabase])

  const handleEndTurn = useCallback(async () => {
    if (!gameState || !currentUser || gameState.current_player !== currentUser.id) return

    try {
      const nextPlayer = gameState.player1 === currentUser.id ? gameState.player2! : gameState.player1
      
      setGameState({
        ...gameState,
        current_player: nextPlayer,
        remaining_pumps: 3,
        status: "playing" as const
      })

      const { error } = await supabase
        .from("balloon_game_states")
        .update({
          current_player: nextPlayer,
          remaining_pumps: 3,
          status: "playing"
        })
        .eq("id", gameState.id)

      if (error) {
        setGameState(gameState)
        throw error
      }
    } catch (err) {
      console.error("Error ending turn:", err)
    }
  }, [gameState, currentUser, supabase])

  const handleManualRefresh = useCallback(async () => {
    setIsRefreshing(true)
    try {
      const { data, error } = await supabase
        .from("balloon_game_states")
        .select("*")
        .eq("id", gameStateIdRef.current)
        .single()

      if (error) throw error
      setGameState(data)
    } catch (err) {
      console.error("Error refreshing game state:", err)
    } finally {
      setIsRefreshing(false)
    }
  }, [supabase])

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const getWinRate = (stats: PlayerStats) => {
    if (!stats.total_games) return '0%'
    return `${Math.round((stats.wins / stats.total_games) * 100)}%`
  }

  const getPlayerName = (playerId: string) => {
    const player = players.find(p => p.id === playerId)
    return player?.username || "Unknown Player"
  }

  if (loading) return <GameLoading />
  if (error || !gameState) return <GameError error={error || "Game not found"} />

  const isMyTurn = gameState.current_player === currentUser?.id

  return (
    <div className="bg-white min-h-screen p-4 md:p-8 font-[family-name:var(--font-geist-sans)]">
      <header className="max-w-4xl mx-auto mb-4 md:mb-8">
        <div className="flex justify-between items-center">
          <Link 
            href="/explore" 
            className="flex items-center text-black transition-transform duration-200 hover:translate-x-[-4px]"
          >
            <FaArrowLeft className="mr-2" />
            <span>Back to Games</span>
          </Link>
          <div className="flex">
            <h1 className="text-xl md:text-2xl font-bold text-black">CSGames</h1>
            <span className="text-black text-xl md:text-2xl">.dev</span>
          </div>
        </div>
      </header>

      <main className="text-black max-w-4xl mx-auto">
        <div className="mb-4 md:mb-6 flex flex-col md:flex-row justify-between items-center">
          <h2 className="text-2xl md:text-3xl font-bold text-black mb-2 md:mb-0">
            Pump Till It Pops
          </h2>

          <div className="flex items-center space-x-4">
            <button
              onClick={handleManualRefresh}
              className={`p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-all duration-300 ${
                isRefreshing ? "animate-spin" : ""
              }`}
              aria-label="Refresh game"
              disabled={isRefreshing}
            >
              <FaSync className="text-black" />
            </button>
            <div className="bg-gray-100 px-4 py-2 rounded-lg">
              <span className="font-mono">Score: {gameState.score}</span>
            </div>
            <div className="bg-gray-100 px-4 py-2 rounded-lg">
              <span className="font-mono">Time: {gameState.turn_timer}s</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div
            className={`p-3 rounded-lg border-2 transition-all duration-300 ${
              gameState.current_player === gameState.player1 && !gameState.is_popped
                ? "border-black shadow-md scale-105"
                : "border-gray-200"
            }`}
          >
            <div className="flex items-center">
              <div>
                <p className="font-bold">{getPlayerName(gameState.player1)}</p>
                <p className="text-xs text-gray-500">{gameState.player1 === currentUser?.id ? "(You)" : ""}</p>
              </div>
            </div>
          </div>
          <div
            className={`p-3 rounded-lg border-2 transition-all duration-300 ${
              gameState.current_player === gameState.player2 && !gameState.is_popped
                ? "border-black shadow-md scale-105"
                : "border-gray-200"
            }`}
          >
            <div className="flex items-center">
              <div>
                <p className="font-bold">
                  {gameState.player2 ? getPlayerName(gameState.player2) : "Waiting for opponent..."}
                </p>
                {gameState.player2 && (
                  <p className="text-xs text-gray-500">{gameState.player2 === currentUser?.id ? "(You)" : ""}</p>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center space-y-8">
          <div className="relative">
            {!gameState.is_popped ? (
              <>
                <div 
                  className="rounded-full shadow-lg transition-all duration-200" 
                  style={{ 
                    background: "radial-gradient(circle at 30% 30%, #f87171, #dc2626)",
                    width: `${gameState.size}px`,
                    height: `${gameState.size}px`,
                  }} 
                />
                <div className="w-2 h-8 bg-gray-400 absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-full" />
              </>
            ) : (
              <div className="text-4xl">💥</div>
            )}
          </div>

          <div className="flex space-x-4">
            <button
              onClick={handlePump}
              disabled={
                gameState.is_popped ||
                !isMyTurn ||
                gameState.status !== "playing" ||
                !gameState.player2
              }
              className={`px-6 py-3 rounded-lg text-white font-bold transition-all duration-200 transform ${
                gameState.is_popped || !isMyTurn || gameState.status !== "playing" || !gameState.player2
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-black hover:bg-gray-800 hover:scale-105 active:scale-95"
              }`}
            >
              {gameState.is_popped
                ? "Game Over! 💥"
                : !gameState.player2
                ? "Waiting for opponent..."
                : isMyTurn && gameState.status === "playing"
                ? `Pump! 🎈 (${gameState.remaining_pumps} left)`
                : `${getPlayerName(gameState.current_player)} is playing...`}
            </button>
            {isMyTurn && !gameState.is_popped && gameState.status === "playing" && gameState.player2 && (
              <button
                onClick={handleEndTurn}
                className="px-6 py-3 rounded-lg text-white font-bold bg-blue-500 hover:bg-blue-600"
              >
                End Turn
              </button>
            )}
          </div>          {gameState.is_popped && (
            <div className="text-center">
              <p className="text-xl font-bold mb-2">
                {gameState.winner === currentUser?.id 
                  ? "You won! 🎉" 
                  : `${getPlayerName(gameState.winner || "")} won!`}
              </p>
              <p className="text-lg font-bold">Final Score: {gameState.score}</p>
              <p className="text-sm text-gray-600">High Score: {highScore}</p>
            </div>
          )}

          {!gameState.player2 && (
            <div className="text-center">
              <p className="text-lg font-bold text-gray-600">
                Waiting for another player to join...
              </p>
              <p className="text-sm text-gray-500">
                Share the game URL with a friend to play together!
              </p>
            </div>
          )}
        </div>

        <div className="mt-12 border-t pt-8">
          <h3 className="text-xl font-bold mb-6">Player Statistics</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {players.map(player => {
              const stats = playerStats[player.id] || {
                total_games: 0,
                wins: 0,
                highest_score: 0,
                average_score: 0
              }
              
              return (
                <div key={player.id} className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-bold mb-3">{getPlayerName(player.id)}</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Games Played</p>
                      <p className="font-bold">{stats.total_games}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Win Rate</p>
                      <p className="font-bold">{getWinRate(stats)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Highest Score</p>
                      <p className="font-bold">{stats.highest_score}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Avg Score</p>
                      <p className="font-bold">{Math.round(stats.average_score)}</p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <h3 className="text-xl font-bold mt-8 mb-6">Recent Matches</h3>
          <div className="bg-gray-50 rounded-lg overflow-hidden">
            {matchHistory.length > 0 ? (
              <div className="divide-y">
                {matchHistory.map(match => (
                  <div key={match.id} className="p-4 flex justify-between items-center">
                    <div>
                      <span className="font-bold">{getPlayerName(match.winner_id)}</span>
                      <span className="text-gray-600 mx-2">vs</span>
                      <span className="font-bold">{getPlayerName(match.loser_id)}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-600">{formatDate(match.created_at)}</p>
                      <p className="font-bold">Score: {match.final_score}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="p-4 text-center text-gray-600">No recent matches</p>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}