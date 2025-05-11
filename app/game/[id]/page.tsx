"use client"

import { useEffect, useState, useRef } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { FaArrowLeft, FaRedo, FaSync } from "react-icons/fa"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { User, RealtimeChannel } from "@supabase/supabase-js"

interface GameState {
  id: string
  lobby_id: string
  board: number[][]
  status: "pending" | "in_progress" | "finished"
  winner: string | null
  player1: string
  player2: string
  current_player: string
  created_at?: string
}

interface Profile {
  id: string
  username: string
}

// Colors for the pieces
const EMPTY_COLOR = "#ffffff"
const PLAYER1_COLOR = "#e53e3e"
const PLAYER2_COLOR = "#ecc94b"

const POLLING_INTERVAL = 3000

export default function GamePage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const supabase = createClientComponentClient()
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [players, setPlayers] = useState<Profile[]>([])
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [hoverColumn, setHoverColumn] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dropAnimation, setDropAnimation] = useState<{ row: number; col: number; player: number } | null>(null)
  const [winner, setWinner] = useState<string | null>(null)
  const [gameOver, setGameOver] = useState(false)
  const [lastMoveTime, setLastMoveTime] = useState<number>(0)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const boardRef = useRef<HTMLDivElement>(null)
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const gameStateIdRef = useRef<string | null>(null)

  // Load game data
  useEffect(() => {
    let isActive = true
    let gameStateSubscription: RealtimeChannel | null = null
    let gameMovesSubscription: RealtimeChannel | null = null

    async function loadGameData() {
      try {
        console.log("Loading game data for lobby:", params.id)

        // Get current user
        const {
          data: { session },
        } = await supabase.auth.getSession()

        if (!session) {
          router.push("/")
          return
        }

        if (isActive) setCurrentUser(session.user)
        console.log("Current user:", session.user.id)

        // Fetch game state
        const { data: gameStateData, error: gameStateError } = await supabase
          .from("game_states")
          .select("*")
          .eq("lobby_id", params.id)
          .single()

        if (gameStateError) {
          throw gameStateError
        }

        console.log("Initial game state:", gameStateData)
        if (isActive) {
          setGameState(gameStateData)
          gameStateIdRef.current = gameStateData.id
        }

        // Check if game is over
        if (gameStateData.status === "finished" && isActive) {
          setGameOver(true)
          if (gameStateData.winner) {
            setWinner(gameStateData.winner)
          }
        }

        // Fetch player profiles
        const playerIds = [gameStateData.player1, gameStateData.player2].filter(Boolean)

        if (playerIds.length > 0) {
          const { data: playerData, error: playerError } = await supabase
            .from("profiles")
            .select("*")
            .in("id", playerIds)

          if (playerError) {
            console.error("Error fetching players:", playerError)
          } else if (isActive) {
            setPlayers(playerData || [])
          }
        }

        // Set up real-time sub for state changes
        gameStateSubscription = supabase
          .channel("game_state_changes")
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "game_states",
              filter: `id=eq.${gameStateData.id}`,
            },
            (payload) => {
              console.log("Game state changed:", payload)
              if (!isActive) return

              // Always update the state
              setGameState(payload.new as GameState)
              setLastMoveTime(Date.now())

              // Check if the game is over
              if (payload.new && 'status' in payload.new && (payload.new as GameState).status === "finished") {
                setGameOver(true)
                if ('winner' in payload.new && (payload.new as GameState).winner) {
                  setWinner((payload.new as GameState).winner)
                }
              }

              // Handle board changes
              if (payload.eventType === "UPDATE" && payload.new && payload.old) {
                const oldBoard = (payload.old as GameState).board
                const newBoard = (payload.new as GameState).board

                // Process if the boards are different only
                if (JSON.stringify(oldBoard) !== JSON.stringify(newBoard)) {
                  console.log("Board changed, finding the difference")

                  let changedRow = -1
                  let changedCol = -1
                  let playerNumber = 0

                  for (let row = 0; row < 6; row++) {
                    for (let col = 0; col < 7; col++) {
                      if (oldBoard[row][col] !== newBoard[row][col] && newBoard[row][col] !== 0) {
                        changedRow = row
                        changedCol = col
                        playerNumber = newBoard[row][col]
                        break
                      }
                    }
                    if (changedRow !== -1) break
                  }

                  // Animate the drop
                  if (changedRow !== -1 && changedCol !== -1) {
                    console.log(`Animating drop at row ${changedRow}, col ${changedCol}, player ${playerNumber}`)

                    setDropAnimation({
                      row: changedRow,
                      col: changedCol,
                      player: playerNumber,
                    })

                    setTimeout(() => {
                      setDropAnimation(null)
                    }, 500)
                  }
                }
              }
            },
          )
          .subscribe((status) => {
            console.log("Game state subscription status:", status)
          })

        gameMovesSubscription = supabase
          .channel("game_moves_changes")
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "game_moves",
              filter: `game_state_id=eq.${gameStateData.id}`,
            },
            (payload) => {
              console.log("New move detected:", payload)
              if (!isActive) return

              // Refresh the state when a new move has been made
              fetchLatestGameState()
            },
          )
          .subscribe((status) => {
            console.log("Game moves subscription status:", status)
          })

        startPolling()
      } catch (err: unknown) {
        console.error("Error loading game data:", err)
        if (isActive) setError((err as Error).message || "Failed to load game data")
      } finally {
        if (isActive) setLoading(false)
      }
    }

    loadGameData()

    // Clean up sub
    return () => {
      isActive = false
      if (gameStateSubscription) gameStateSubscription.unsubscribe()
      if (gameMovesSubscription) gameMovesSubscription.unsubscribe()
      stopPolling()
    }
  }, [params.id, router])

  // Start polling for state updates
  function startPolling() {
    console.log("Starting polling for game state updates")

    stopPolling()

    pollingIntervalRef.current = setInterval(() => {
      if (gameStateIdRef.current) {
        console.log("Polling for game state updates")
        fetchLatestGameState()
      }
    }, POLLING_INTERVAL)
  }

  function stopPolling() {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
      pollingIntervalRef.current = null
    }
  }

  async function fetchLatestGameState() {
    try {
      if (!gameStateIdRef.current) return

      const { data, error } = await supabase
        .from("game_states")
        .select("*")
        .eq("id", gameStateIdRef.current)
        .single()

      if (error) {
        console.error("Error fetching latest game state:", error)
        return
      }

      console.log("Fetched latest game state:", data)
      setGameState(data)
      setLastMoveTime(Date.now())

      // Check if the game is over
      if (data.status === "finished") {
        setGameOver(true)
        if (data.winner) {
          setWinner(data.winner)
        }
      }
    } catch (err) {
      console.error("Error in fetchLatestGameState:", err)
    }
  }

  async function handleManualRefresh() {
    setIsRefreshing(true)
    await fetchLatestGameState()
    setTimeout(() => setIsRefreshing(false), 500)
  }

  // Handle click
  async function handleColumnClick(columnIndex: number) {
    if (!gameState || gameOver) return

    // Check if it's the user's turn
    if (gameState.current_player !== currentUser?.id) {
      return
    }

    try {
      console.log(`Making move in column ${columnIndex}`)

      // Actually make the move
      const { error } = await supabase.rpc("make_move", {
        game_state_id: gameState.id,
        column_index: columnIndex,
      })

      if (error) {
        console.error("Error making move:", error)
        if (!error.message.includes("Column is full")) {
          alert(error.message)
        }
      } else {
        // Fetch game state after moving
        fetchLatestGameState()
      }
    } catch (err: unknown) {
      console.error("Error making move:", err)
    }
  }

  function getPlayerName(playerId: string) {
    if (!playerId) return "Unknown"

    const player = players.find((p) => p.id === playerId)
    return player?.username || "Unknown player"
  }

  function getPlayerColor(playerNumber: number) {
    if (playerNumber === 1) return PLAYER1_COLOR
    if (playerNumber === 2) return PLAYER2_COLOR
    return EMPTY_COLOR
  }

  function isMyTurn() {
    return gameState && gameState.current_player === currentUser?.id
  }

  if (loading) {
    return (
      <div className="bg-white min-h-screen p-8 flex items-center justify-center font-[family-name:var(--font-geist-sans)]">
        <p className="text-black">Loading game...</p>
      </div>
    )
  }

  if (error || !gameState) {
    return (
      <div className="bg-white min-h-screen p-8 flex flex-col items-center justify-center font-[family-name:var(--font-geist-sans)]">
        <p className="text-black mb-4">Error: {error || "Game not found"}</p>
        <Link href="/explore" className="text-black underline">
          Return to Explore Games
        </Link>
      </div>
    )
  }

  const board = gameState.board
  const playerNumber = gameState.player1 === currentUser?.id ? 1 : 2
  const myColor = playerNumber === 1 ? PLAYER1_COLOR : PLAYER2_COLOR

  return (
    <div className="bg-white min-h-screen p-4 md:p-8 font-[family-name:var(--font-geist-sans)]">
      <header className="max-w-4xl mx-auto mb-4 md:mb-8">
        <div className="flex justify-between items-center">
          <Link href={`/lobby/${params.id}`} className="flex items-center text-black">
            <FaArrowLeft className="mr-2" />
            <span>Back to Lobby</span>
          </Link>
          <div className="flex">
            <h1 className="text-xl md:text-2xl font-bold text-black">CSGames</h1>
            <span className="text-black text-xl md:text-2xl">.dev</span>
          </div>
        </div>
      </header>

      <main className="text-black max-w-4xl mx-auto">
        <div className="mb-4 md:mb-6 flex flex-col md:flex-row justify-between items-center">
          <h2 className="text-2xl md:text-3xl font-bold text-black mb-2 md:mb-0">Connect Four</h2>

          <div className="flex items-center space-x-4">
            <button
              onClick={handleManualRefresh}
              className={`p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors ${isRefreshing ? 'animate-spin' : ''}`}
              aria-label="Refresh game"
              disabled={isRefreshing}
            >
              <FaSync className="text-black" />
            </button>

            <div className={`flex items-center ${isMyTurn() && !gameOver ? "animate-pulse" : ""}`}>
              <div
                className="w-4 h-4 md:w-6 md:h-6 rounded-full mr-2"
                style={{
                  backgroundColor: gameState.current_player === gameState.player1 ? PLAYER1_COLOR : PLAYER2_COLOR,
                }}
              ></div>
              <span className="text-sm md:text-base">
                {gameOver
                  ? "Game Over"
                  : `${gameState.current_player === currentUser?.id ? "Your" : getPlayerName(gameState.current_player) + "'s"} turn`}
              </span>
            </div>
          </div>
        </div>

        {gameOver && (
          <div className="mb-6 p-4 bg-gray-100 rounded-lg text-center">
            {winner ? (
              <p className="text-lg font-bold">
                {winner === currentUser?.id ? "You won! 🎉" : `${getPlayerName(winner)} won!`}
              </p>
            ) : (
              <p className="text-lg font-bold">Game ended in a draw!</p>
            )}
            <Link href="/explore">
              <button className="mt-2 bg-black text-white px-4 py-2 rounded-lg flex items-center mx-auto">
                <FaRedo className="mr-2" />
                Play Again
              </button>
            </Link>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div
            className={`p-3 rounded-lg border-2 ${gameState.current_player === gameState.player1 && !gameOver ? "border-black" : "border-gray-200"}`}
          >
            <div className="flex items-center">
              <div className="w-6 h-6 rounded-full mr-2" style={{ backgroundColor: PLAYER1_COLOR }}></div>
              <div>
                <p className="font-bold">{getPlayerName(gameState.player1)}</p>
                <p className="text-xs text-gray-500">{gameState.player1 === currentUser?.id ? "(You)" : ""}</p>
              </div>
            </div>
          </div>
          <div
            className={`p-3 rounded-lg border-2 ${gameState.current_player === gameState.player2 && !gameOver ? "border-black" : "border-gray-200"}`}
          >
            <div className="flex items-center">
              <div className="w-6 h-6 rounded-full mr-2" style={{ backgroundColor: PLAYER2_COLOR }}></div>
              <div>
                <p className="font-bold">{getPlayerName(gameState.player2)}</p>
                <p className="text-xs text-gray-500">{gameState.player2 === currentUser?.id ? "(You)" : ""}</p>
              </div>
            </div>
          </div>
        </div>

        <div
          ref={boardRef}
          className="bg-blue-600 p-2 md:p-4 rounded-lg mx-auto max-w-md md:max-w-lg relative"
          style={{
            boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
          }}
          key={`board-${lastMoveTime}`}
        >
          {isMyTurn() && hoverColumn !== null && !gameOver && (
            <div
              className="absolute top-0 w-[14.28%] h-8 flex items-center justify-center"
              style={{
                left: `${hoverColumn * 14.28}%`,
                transition: "left 0.1s ease-out",
              }}
            >
              <div className="w-[80%] h-[80%] rounded-full" style={{ backgroundColor: myColor, opacity: 0.7 }}></div>
            </div>
          )}

          <div className="grid grid-cols-7 gap-1 md:gap-2">
            {board.map((row: number[], rowIndex: number) =>
              row.map((cell: number, colIndex: number) => (
                <div
                  key={`${rowIndex}-${colIndex}`}
                  className="aspect-square bg-blue-700 rounded-full flex items-center justify-center relative overflow-hidden"
                  onClick={() => handleColumnClick(colIndex)}
                  onMouseEnter={() => setHoverColumn(colIndex)}
                  onMouseLeave={() => setHoverColumn(null)}
                  style={{ cursor: isMyTurn() && !gameOver ? "pointer" : "default" }}
                >
                  <div
                    className={`w-[85%] h-[85%] rounded-full ${
                      dropAnimation && dropAnimation.col === colIndex && dropAnimation.row === rowIndex
                        ? "animate-drop-piece"
                        : ""
                    }`}
                    style={{
                      backgroundColor: getPlayerColor(cell),
                      boxShadow: "inset 0 2px 4px 0 rgba(0, 0, 0, 0.1)",
                    }}
                  ></div>
                </div>
              )),
            )}
          </div>
        </div>
      </main>
    </div>
  )
}