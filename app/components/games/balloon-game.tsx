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
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const gameStateIdRef = useRef<string | null>(null)

  const retryRequest = async (fn: () => Promise<any>, maxRetries = 3, delayMs = 500) => {
    let lastError
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

  const handlePump = useCallback(async () => {
    if (!gameState || !currentUser || gameState.is_popped || gameState.current_player !== currentUser.id) return

    try {
      const { data, error } = await supabase.rpc("pump_balloon", {
        game_state_id: gameState.id
      })

      if (error) throw error

      if (data) {
        setGameState(data)
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

  const getPlayerName = (playerId: string) => {
    const player = players.find(p => p.id === playerId)
    return player?.username || "Unknown Player"
  }

  if (loading) return <GameLoading />
  if (error || !gameState) return <GameError error={error || "Game not found"} />

  const isMyTurn = gameState.current_player === currentUser?.id
  const opponent = players.find(p => p.id !== currentUser?.id)

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
          </div>

          {gameState.is_popped && (
            <div className="text-center">
              <p className="text-lg font-bold">Score: {gameState.score}</p>
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
      </main>
    </div>
  )
}