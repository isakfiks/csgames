"use client"

import { useEffect, useState, useRef } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { FaArrowLeft, FaRedo, FaSync, FaRandom, FaCheck, FaVolumeUp, FaVolumeMute } from "react-icons/fa"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import type { User, RealtimeChannel } from "@supabase/supabase-js"

interface BattleshipGameProps {
  lobbyId: string
  currentUser: User | null
}

// Game constants
const BOARD_SIZE = 10
const EMPTY = 0
const SHIP = 1
const MISS = 2
const HIT = 3
const SUNK = 4

// Ship types and sizes
const SHIPS = [
  { name: "Carrier", size: 5, color: "#6366F1" },
  { name: "Battleship", size: 4, color: "#8B5CF6" },
  { name: "Cruiser", size: 3, color: "#EC4899" },
  { name: "Submarine", size: 3, color: "#F43F5E" },
  { name: "Destroyer", size: 2, color: "#F97316" },
]

interface GameState {
  id: string
  lobby_id: string
  player1: string
  player2: string
  player1_board: number[][]
  player2_board: number[][]
  player1_shots: number[][]
  player2_shots: number[][]
  player1_ready: boolean
  player2_ready: boolean
  current_player: string
  status: "setup" | "in_progress" | "finished"
  winner: string | null
  created_at?: string
  last_updated?: string
}

interface Profile {
  id: string
  username: string
}

interface ShipPlacement {
  shipIndex: number
  row: number
  col: number
  orientation: "horizontal" | "vertical"
}

interface GameMove {
  id: string
  game_state_id: string
  player_id: string
  row: number
  col: number
  is_hit: boolean
  created_at: string
}

function GameLoading() {
  return (
    <div className="flex items-center justify-center h-screen">
      <div className="animate-pulse flex flex-col items-center">
        <div className="w-16 h-16 rounded-full bg-blue-600 mb-4 animate-bounce"></div>
        <p className="text-xl font-bold">Loading game...</p>
      </div>
    </div>
  )
}

function GameError({ error }: { error: string }) {
  return (
    <div className="flex items-center justify-center h-screen">
      <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded shadow-md max-w-md">
        <p className="font-bold">Error</p>
        <p>{error}</p>
      </div>
    </div>
  )
}

// Play Again Button Component
function PlayAgainButton({
  lobbyId,
  gameStateId,
  currentUser,
}: {
  lobbyId: string
  gameStateId: string
  currentUser: User | null
}) {
  const supabase = createClientComponentClient()
  const [playAgainStatus, setPlayAgainStatus] = useState<{
    requestedBy: string[]
    newGameId: string | null
  } | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // Fetch current play again status
  useEffect(() => {
    let isActive = true

    const fetchPlayAgainStatus = async () => {
      const { data, error } = await supabase
        .from("play_again_requests")
        .select("*")
        .eq("original_game_id", gameStateId)
        .single()

      if (!error && data && isActive) {
        setPlayAgainStatus({
          requestedBy: data.requested_by || [],
          newGameId: data.new_game_id,
        })

        // If there's a new game and current user has requested to play again, redirect
        if (data.new_game_id && data.requested_by.includes(currentUser?.id || "")) {
          window.location.href = `/game/${lobbyId}`
        }
      }
    }

    fetchPlayAgainStatus()

    // Subscribe to changes
    const channel = supabase
      .channel(`play-again-${gameStateId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "play_again_requests",
          filter: `original_game_id=eq.${gameStateId}`,
        },
        (payload) => {
          if (isActive) {
            const newData = payload.new as { requested_by: string[]; new_game_id: string | null }
            setPlayAgainStatus({
              requestedBy: newData.requested_by || [],
              newGameId: newData.new_game_id,
            })

            // If there's a new game and current user has requested to play again, redirect
            if (newData.new_game_id && newData.requested_by.includes(currentUser?.id || "")) {
              window.location.href = `/game/${lobbyId}`
            }
          }
        },
      )
      .subscribe()

    return () => {
      isActive = false
      channel.unsubscribe()
    }
  }, [gameStateId, supabase, currentUser, lobbyId])

  const handlePlayAgain = async () => {
    if (!currentUser) return

    setIsLoading(true)
    try {
      // Check if a request already exists
      const { data, error } = await supabase
        .from("play_again_requests")
        .select("*")
        .eq("original_game_id", gameStateId)
        .single()

      if (error && error.code === "PGRST116") {
        // No request exists, create one
        await supabase.from("play_again_requests").insert({
          original_game_id: gameStateId,
          lobby_id: lobbyId,
          requested_by: [currentUser.id],
          new_game_id: null,
        })
      } else if (data) {
        // Request exists but current user hasn't requested yet
        if (!data.requested_by.includes(currentUser.id)) {
          const updatedRequestedBy = [...data.requested_by, currentUser.id]

          // If both players have now requested, create a new game
          if (updatedRequestedBy.length >= 2) {
            // Call server function to create a new game
            const { data: newGameData } = await supabase.rpc("create_new_game_from_existing", {
              p_original_game_id: gameStateId,
              p_lobby_id: lobbyId,
            })

            if (newGameData) {
              // Update the play again request with the new game ID
              await supabase
                .from("play_again_requests")
                .update({
                  requested_by: updatedRequestedBy,
                  new_game_id: newGameData,
                })
                .eq("original_game_id", gameStateId)
            }
          } else {
            // Just update the requested_by array
            await supabase
              .from("play_again_requests")
              .update({ requested_by: updatedRequestedBy })
              .eq("original_game_id", gameStateId)
          }
        }
      }
    } catch (err) {
      console.error("Error handling play again:", err)
    } finally {
      setIsLoading(false)
    }
  }

  // If user has already requested to play again
  const hasRequested = playAgainStatus?.requestedBy.includes(currentUser?.id || "")

  // How many players have requested to play again
  const requestCount = playAgainStatus?.requestedBy.length || 0

  return (
    <button
      onClick={handlePlayAgain}
      disabled={isLoading || hasRequested}
      className={`mt-2 px-4 py-2 rounded-lg flex items-center mx-auto transition-all duration-300 transform hover:scale-105 ${
        hasRequested ? "bg-gray-300 text-gray-700" : "bg-black text-white hover:bg-gray-800"
      }`}
    >
      <FaRedo className={`mr-2 ${isLoading ? "animate-spin" : ""}`} />
      {isLoading ? "Loading..." : hasRequested ? `Waiting for opponent (${requestCount}/2)` : "Play Again"}
    </button>
  )
}

export default function BattleshipGame({ lobbyId, currentUser }: BattleshipGameProps) {
  const router = useRouter()
  const supabase = createClientComponentClient()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [players, setPlayers] = useState<Profile[]>([])
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState(true)

  // Ship placement state
  const [placementPhase, setPlacementPhase] = useState(true)
  const [currentShipIndex, setCurrentShipIndex] = useState(0)
  const [shipOrientation, setShipOrientation] = useState<"horizontal" | "vertical">("horizontal")
  const [hoverPosition, setHoverPosition] = useState<{ row: number; col: number } | null>(null)
  const [placedShips, setPlacedShips] = useState<ShipPlacement[]>([])
  const [isReady, setIsReady] = useState(false)
  const [waitingForOpponent, setWaitingForOpponent] = useState(false)

  // Game state
  const [gameOver, setGameOver] = useState(false)
  const [winner, setWinner] = useState<string | null>(null)
  const [showWinnerMessage, setShowWinnerMessage] = useState(false)
  const [hitAnimation, setHitAnimation] = useState<{ row: number; col: number; isHit: boolean } | null>(null)
  const [recentMoves, setRecentMoves] = useState<GameMove[]>([])

  // Local boards for rendering
  const [myBoard, setMyBoard] = useState<number[][]>(
    Array(BOARD_SIZE)
      .fill(0)
      .map(() => Array(BOARD_SIZE).fill(0)),
  )
  const [opponentBoard, setOpponentBoard] = useState<number[][]>(
    Array(BOARD_SIZE)
      .fill(0)
      .map(() => Array(BOARD_SIZE).fill(0)),
  )
  const [myShots, setMyShots] = useState<number[][]>(
    Array(BOARD_SIZE)
      .fill(0)
      .map(() => Array(BOARD_SIZE).fill(0)),
  )
  const [opponentShots, setOpponentShots] = useState<number[][]>(
    Array(BOARD_SIZE)
      .fill(0)
      .map(() => Array(BOARD_SIZE).fill(0)),
  )

  // Ship tracking
  const [myShipHealth] = useState<{ [key: number]: number }>(
    SHIPS.reduce((acc, ship, index) => ({ ...acc, [index]: ship.size }), {}),
  )
  const [opponentShipHealth] = useState<{ [key: number]: number }>(
    SHIPS.reduce((acc, ship, index) => ({ ...acc, [index]: ship.size }), {}),
  )

  // Ship cells mapping
  const [myShipCells, setMyShipCells] = useState<{ [key: string]: number }>({})
  const [opponentShipCells, setOpponentShipCells] = useState<{ [key: string]: number }>({})

  // Audio refs
  const hitSoundRef = useRef<HTMLAudioElement | null>(null)
  const missSoundRef = useRef<HTMLAudioElement | null>(null)
  const sunkSoundRef = useRef<HTMLAudioElement | null>(null)
  const placeSoundRef = useRef<HTMLAudioElement | null>(null)
  const gameStartSoundRef = useRef<HTMLAudioElement | null>(null)
  const gameOverSoundRef = useRef<HTMLAudioElement | null>(null)

  // Polling interval
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const gameStateIdRef = useRef<string | null>(null)

  // Initialize audio elements
  useEffect(() => {
    hitSoundRef.current = new Audio("/sounds/hit.mp3")
    missSoundRef.current = new Audio("/sounds/miss.mp3")
    sunkSoundRef.current = new Audio("/sounds/sunk.mp3")
    placeSoundRef.current = new Audio("/sounds/place.mp3")
    gameStartSoundRef.current = new Audio("/sounds/game-start.mp3")
    gameOverSoundRef.current = new Audio("/sounds/game-over.mp3")

    return () => {
      // Clean up audio elements
      hitSoundRef.current = null
      missSoundRef.current = null
      sunkSoundRef.current = null
      placeSoundRef.current = null
      gameStartSoundRef.current = null
      gameOverSoundRef.current = null
    }
  }, [])

  // Play sound
  function playSound(sound: "hit" | "miss" | "sunk" | "place" | "gameStart" | "gameOver") {
    if (!soundEnabled) return

    switch (sound) {
      case "hit":
        hitSoundRef.current?.play().catch(e => console.log("Error playing sound:", e))
        break
      case "miss":
        missSoundRef.current?.play().catch(e => console.log("Error playing sound:", e))
        break
      case "sunk":
        sunkSoundRef.current?.play().catch(e => console.log("Error playing sound:", e))
        break
      case "place":
        placeSoundRef.current?.play().catch(e => console.log("Error playing sound:", e))
        break
      case "gameStart":
        gameStartSoundRef.current?.play().catch(e => console.log("Error playing sound:", e))
        break
      case "gameOver":
        gameOverSoundRef.current?.play().catch(e => console.log("Error playing sound:", e))
        break
    }
  }

  // Load game data
  useEffect(() => {
    let isActive = true
    let gameStateSubscription: RealtimeChannel | null = null
    let gameMovesSubscription: RealtimeChannel | null = null

    async function loadGameData() {
      try {
        console.log("Loading game data for lobby:", lobbyId)

        if (!currentUser) {
          router.push("/")
          return
        }

        // Check if game state exists for this lobby
        const { data: existingGameState, error: existingGameError } = await supabase
          .from("battleship_game_states")
          .select("*")
          .eq("lobby_id", lobbyId)
          .single()

        if (existingGameError && existingGameError.code !== "PGRST116") {
          throw existingGameError
        }

        let gameStateData: GameState

        if (!existingGameState) {
          // Create new game state
          const { data: newGameState, error: newGameError } = await supabase
            .from("battleship_game_states")
            .insert({
              lobby_id: lobbyId,
              player1: currentUser.id,
              player1_board: Array(BOARD_SIZE).fill(Array(BOARD_SIZE).fill(EMPTY)),
              player2_board: Array(BOARD_SIZE).fill(Array(BOARD_SIZE).fill(EMPTY)),
              player1_shots: Array(BOARD_SIZE).fill(Array(BOARD_SIZE).fill(EMPTY)),
              player2_shots: Array(BOARD_SIZE).fill(Array(BOARD_SIZE).fill(EMPTY)),
              player1_ready: false,
              player2_ready: false,
              current_player: currentUser.id,
              status: "setup",
              winner: null,
            })
            .select()
            .single()

          if (newGameError) {
            throw newGameError
          }

          gameStateData = newGameState
        } else if (existingGameState.player1 === currentUser.id || existingGameState.player2 === currentUser.id) {
          // Player is already in the game
          gameStateData = existingGameState
        } else if (!existingGameState.player2) {
          // Join as player 2
          const { data: updatedGameState, error: updateError } = await supabase
            .from("battleship_game_states")
            .update({
              player2: currentUser.id,
            })
            .eq("id", existingGameState.id)
            .select()
            .single()

          if (updateError) {
            throw updateError
          }

          gameStateData = updatedGameState
        } else {
          // Game is full
          throw new Error("Game is full")
        }

        console.log("Game state:", gameStateData)
        if (isActive) {
          setGameState(gameStateData)
          gameStateIdRef.current = gameStateData.id

          // Set game phase based on status
          if (gameStateData.status === "setup") {
            setPlacementPhase(true)

            // Check if player is ready
            if (gameStateData.player1 === currentUser.id && gameStateData.player1_ready) {
              setIsReady(true)

              // Load player's board
              if (gameStateData.player1_board) {
                setMyBoard(gameStateData.player1_board)

                // Reconstruct placed ships and ship cells
                reconstructPlacedShips(gameStateData.player1_board)
              }

              // Check if waiting for opponent
              if (!gameStateData.player2_ready) {
                setWaitingForOpponent(true)
              }
            } else if (gameStateData.player2 === currentUser.id && gameStateData.player2_ready) {
              setIsReady(true)

              // Load player's board
              if (gameStateData.player2_board) {
                setMyBoard(gameStateData.player2_board)

                // Reconstruct placed ships and ship cells
                reconstructPlacedShips(gameStateData.player2_board)
              }

              // Check if waiting for opponent
              if (!gameStateData.player1_ready) {
                setWaitingForOpponent(true)
              }
            }

            // If both players are ready, game should be in progress
            if (gameStateData.player1_ready && gameStateData.player2_ready) {
              setPlacementPhase(false)
              setWaitingForOpponent(gameStateData.current_player !== currentUser.id)
            }
          } else if (gameStateData.status === "in_progress") {
            setPlacementPhase(false)
            setIsReady(true)

            // Load boards
            if (gameStateData.player1 === currentUser.id) {
              setMyBoard(gameStateData.player1_board)
              setOpponentBoard(createOpponentBoardView(gameStateData.player2_board, gameStateData.player1_shots))
              setMyShots(gameStateData.player1_shots)
              setOpponentShots(gameStateData.player2_shots)

              // Reconstruct ship cells
              reconstructPlacedShips(gameStateData.player1_board)
              reconstructOpponentShipCells(gameStateData.player2_board, gameStateData.player1_shots)
            } else {
              setMyBoard(gameStateData.player2_board)
              setOpponentBoard(createOpponentBoardView(gameStateData.player1_board, gameStateData.player2_shots))
              setMyShots(gameStateData.player2_shots)
              setOpponentShots(gameStateData.player1_shots)

              // Reconstruct ship cells
              reconstructPlacedShips(gameStateData.player2_board)
              reconstructOpponentShipCells(gameStateData.player1_board, gameStateData.player2_shots)
            }

            setWaitingForOpponent(gameStateData.current_player !== currentUser.id)
          } else if (gameStateData.status === "finished") {
            setPlacementPhase(false)
            setIsReady(true)
            setGameOver(true)
            setWinner(gameStateData.winner)

            // Load boards
            if (gameStateData.player1 === currentUser.id) {
              setMyBoard(gameStateData.player1_board)
              setOpponentBoard(gameStateData.player2_board) // Show full board at game end
              setMyShots(gameStateData.player1_shots)
              setOpponentShots(gameStateData.player2_shots)

              // Reconstruct ship cells
              reconstructPlacedShips(gameStateData.player1_board)
              reconstructOpponentShipCells(gameStateData.player2_board, gameStateData.player1_shots)
            } else {
              setMyBoard(gameStateData.player2_board)
              setOpponentBoard(gameStateData.player1_board) // Show full board at game end
              setMyShots(gameStateData.player2_shots)
              setOpponentShots(gameStateData.player1_shots)

              // Reconstruct ship cells
              reconstructPlacedShips(gameStateData.player2_board)
              reconstructOpponentShipCells(gameStateData.player1_board, gameStateData.player2_shots)
            }

            setTimeout(() => {
              setShowWinnerMessage(true)
              playSound("gameOver")
            }, 500)
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

        // Fetch recent moves
        const { data: movesData, error: movesError } = await supabase
          .from("battleship_moves")
          .select("*")
          .eq("game_state_id", gameStateData.id)
          .order("created_at", { ascending: false })
          .limit(5)

        if (!movesError && movesData && isActive) {
          setRecentMoves(movesData)
        }

        // Enhanced real-time subscription for state changes
        gameStateSubscription = supabase
          .channel(`battleship_game_${gameStateData.id}`)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "battleship_game_states",
              filter: `id=eq.${gameStateData.id}`,
            },
            async (payload) => {
              console.log("Game state changed:", payload)
              if (!isActive) return

              const newState = payload.new as GameState
              setGameState(newState)

              // Update boards immediately when state changes
              if (newState.player1 === currentUser?.id) {
                setMyBoard(newState.player1_board)
                setMyShots(newState.player1_shots)
                setOpponentShots(newState.player2_shots)
                if (newState.status === "finished") {
                  setOpponentBoard(newState.player2_board)
                } else {
                  setOpponentBoard(createOpponentBoardView(newState.player2_board, newState.player1_shots))
                }
              } else {
                setMyBoard(newState.player2_board)
                setMyShots(newState.player2_shots)
                setOpponentShots(newState.player1_shots)
                if (newState.status === "finished") {
                  setOpponentBoard(newState.player1_board)
                } else {
                  setOpponentBoard(createOpponentBoardView(newState.player1_board, newState.player2_shots))
                }
              }

              // Update waiting state
              setWaitingForOpponent(newState.current_player !== currentUser?.id)

              // Handle game phase changes
              if (newState.status === "in_progress" && placementPhase) {
                setPlacementPhase(false)
                playSound("gameStart")
              }

              // Check for game over
              if (newState.status === "finished" && !gameOver) {
                setGameOver(true)
                setWinner(newState.winner)
                setTimeout(() => {
                  setShowWinnerMessage(true)
                  playSound("gameOver")
                }, 500)
              }

              // Fetch latest moves after state change
              const { data: latestMoves } = await supabase
                .from("battleship_moves")
                .select("*")
                .eq("game_state_id", gameStateData.id)
                .order("created_at", { ascending: false })
                .limit(5)

              if (latestMoves) {
                setRecentMoves(latestMoves)
              }
            },
          )
          .subscribe()

        // Enhanced moves subscription
        gameMovesSubscription = supabase
          .channel(`battleship_moves_${gameStateData.id}`)
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "battleship_moves",
              filter: `game_state_id=eq.${gameStateData.id}`,
            },
            async (payload) => {
              console.log("New move detected:", payload)
              if (!isActive) return

              const newMove = payload.new as GameMove
              setRecentMoves((prev) => [newMove, ...prev.slice(0, 4)])

              // Show hit animation
              setHitAnimation({
                row: newMove.row,
                col: newMove.col,
                isHit: newMove.is_hit,
              })

              // Play sound
              playSound(newMove.is_hit ? "hit" : "miss")

              // Force refresh game state after move
              await fetchLatestGameState()

              setTimeout(() => setHitAnimation(null), 1000)
            },
          )
          .subscribe()

        // Start polling for updates
        startPolling()

        // Hide game start animation after a delay
        setTimeout(() => {
          // We'll use this timeout but without setting the removed state
        }, 1000)
      } catch (err: unknown) {
        console.error("Error loading game data:", err)
        if (isActive) setError((err as Error).message || "Failed to load game data")
      } finally {
        if (isActive) setLoading(false)
      }
    }

    loadGameData()

    // Cleanup subscriptions
    return () => {
      isActive = false
      if (gameStateSubscription) gameStateSubscription.unsubscribe()
      if (gameMovesSubscription) gameMovesSubscription.unsubscribe()
      stopPolling()
    }
  }, [lobbyId, router, supabase, currentUser])

  // Create opponent board view (hiding ships that haven't been hit)
  function createOpponentBoardView(opponentBoard: number[][], myShots: number[][]): number[][] {
    const boardView = Array(BOARD_SIZE)
      .fill(0)
      .map(() => Array(BOARD_SIZE).fill(0))

    for (let row = 0; row < BOARD_SIZE; row++) {
      for (let col = 0; col < BOARD_SIZE; col++) {
        if (myShots[row][col] === MISS) {
          boardView[row][col] = MISS
        } else if (myShots[row][col] === HIT && opponentBoard[row][col] === SHIP) {
          boardView[row][col] = HIT
        } else if (myShots[row][col] === HIT && opponentBoard[row][col] === SUNK) {
          boardView[row][col] = SUNK
        } else {
          boardView[row][col] = EMPTY
        }
      }
    }

    return boardView
  }

  // Reconstruct placed ships from board
  function reconstructPlacedShips(board: number[][]) {
    const shipCells: { [key: string]: number } = {}
    const newPlacedShips: ShipPlacement[] = []

    // First pass: identify all ship cells
    for (let row = 0; row < BOARD_SIZE; row++) {
      for (let col = 0; col < BOARD_SIZE; col++) {
        if (board[row][col] === SHIP || board[row][col] === HIT || board[row][col] === SUNK) {
          shipCells[`${row},${col}`] = -1
        }
      }
    }

    // Second pass: identify ships
    let shipIndex = 0

    for (const ship of SHIPS) {
      // Look for horizontal ships
      for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col <= BOARD_SIZE - ship.size; col++) {
          let isShip = true

          for (let i = 0; i < ship.size; i++) {
            const cellKey = `${row},${col + i}`
            if (!(cellKey in shipCells)) {
              isShip = false
              break
            }
          }

          if (isShip) {
            // Found a ship
            for (let i = 0; i < ship.size; i++) {
              const cellKey = `${row},${col + i}`
              shipCells[cellKey] = shipIndex
            }

            newPlacedShips.push({
              shipIndex,
              row,
              col,
              orientation: "horizontal",
            })

            shipIndex++
            // Move to next ship
            break
          }
        }

        if (shipIndex > newPlacedShips.length) break
      }

      // If ship not found horizontally, look for vertical ships
      if (shipIndex <= newPlacedShips.length) {
        for (let col = 0; col < BOARD_SIZE; col++) {
          for (let row = 0; row <= BOARD_SIZE - ship.size; row++) {
            let isShip = true

            for (let i = 0; i < ship.size; i++) {
              const cellKey = `${row + i},${col}`
              if (!(cellKey in shipCells)) {
                isShip = false
                break
              }
            }

            if (isShip) {
              // Found a ship
              for (let i = 0; i < ship.size; i++) {
                const cellKey = `${row + i},${col}`
                shipCells[cellKey] = shipIndex
              }

              newPlacedShips.push({
                shipIndex,
                row,
                col,
                orientation: "vertical",
              })

              shipIndex++
              // Move to next ship
              break
            }
          }

          if (shipIndex > newPlacedShips.length) break
        }
      }
    }

    setMyShipCells(shipCells)
    setPlacedShips(newPlacedShips)
    setCurrentShipIndex(SHIPS.length)
  }

  // Reconstruct opponent ship cells
  function reconstructOpponentShipCells(opponentBoard: number[][], myShots: number[][]) {
    const shipCells: { [key: string]: number } = {}

    // Identify hit ship cells
    for (let row = 0; row < BOARD_SIZE; row++) {
      for (let col = 0; col < BOARD_SIZE; col++) {
        if ((opponentBoard[row][col] === SHIP || opponentBoard[row][col] === SUNK) && myShots[row][col] === HIT) {
          shipCells[`${row},${col}`] = 0
        }
      }
    }

    setOpponentShipCells(shipCells)
  }

  // Start polling for state updates
  function startPolling() {
    console.log("Starting polling for game state updates")

    stopPolling()

    pollingIntervalRef.current = setInterval(() => {
      if (gameStateIdRef.current) {
        console.log("Polling for game state updates")
        fetchLatestGameState()
      }
    }, 5000) // Poll every 5 seconds
  }

  function stopPolling() {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
      pollingIntervalRef.current = null
    }
  }

  // Enhanced fetchLatestGameState function
  async function fetchLatestGameState() {
    try {
      if (!gameStateIdRef.current) return

      const { data, error } = await supabase
        .from("battleship_game_states")
        .select("*")
        .eq("id", gameStateIdRef.current)
        .single()

      if (error) {
        console.error("Error fetching latest game state:", error)
        return
      }

      // Update all relevant state
      setGameState(data)
      
      if (data.player1 === currentUser?.id) {
        setMyBoard(data.player1_board)
        setMyShots(data.player1_shots)
        setOpponentShots(data.player2_shots)
        if (data.status === "finished") {
          setOpponentBoard(data.player2_board)
        } else {
          setOpponentBoard(createOpponentBoardView(data.player2_board, data.player1_shots))
        }
      } else {
        setMyBoard(data.player2_board)
        setMyShots(data.player2_shots)
        setOpponentShots(data.player1_shots)
        if (data.status === "finished") {
          setOpponentBoard(data.player1_board)
        } else {
          setOpponentBoard(createOpponentBoardView(data.player1_board, data.player2_shots))
        }
      }

      setWaitingForOpponent(data.current_player !== currentUser?.id)
    } catch (err) {
      console.error("Error in fetchLatestGameState:", err)
    }
  }

  // Handle ship placement
  function handleCellClick(row: number, col: number, isOpponentBoard = false) {
    if (isOpponentBoard) {
      if (placementPhase || waitingForOpponent || gameOver) return
      handleShot(row, col)
      return
    }

    if (!placementPhase || isReady) return

    const currentShip = SHIPS[currentShipIndex]
    if (!currentShip) return

    // Check if placement is valid
    if (isValidPlacement(row, col, currentShip.size, shipOrientation)) {
      // Place the ship
      const newBoard = [...myBoard]
      const newShipCells = { ...myShipCells }

      if (shipOrientation === "horizontal") {
        for (let i = 0; i < currentShip.size; i++) {
          newBoard[row][col + i] = SHIP
          newShipCells[`${row},${col + i}`] = currentShipIndex
        }
      } else {
        for (let i = 0; i < currentShip.size; i++) {
          newBoard[row + i][col] = SHIP
          newShipCells[`${row + i},${col}`] = currentShipIndex
        }
      }

      setMyBoard(newBoard)
      setMyShipCells(newShipCells)

      // Save ship placement
      setPlacedShips([
        ...placedShips,
        {
          shipIndex: currentShipIndex,
          row,
          col,
          orientation: shipOrientation,
        },
      ])

      // Play sound
      playSound("place")

      // Move to next ship
      if (currentShipIndex < SHIPS.length - 1) {
        setCurrentShipIndex(currentShipIndex + 1)
      } else {
        // All ships placed, but not ready yet
        // Player needs to click "Ready" button
      }
    }
  }

  // Mark player as ready
  async function markAsReady() {
    if (!gameState || placedShips.length < SHIPS.length) return

    setIsReady(true)
    setWaitingForOpponent(true)

    try {
      // Update game state in database
      const { error } = await supabase.rpc("battleship_mark_player_ready", {
        p_game_state_id: gameState.id,
        p_player_id: currentUser?.id,
        p_board: myBoard,
      })

      if (error) {
        console.error("Error marking player as ready:", error)
        setIsReady(false)
        setWaitingForOpponent(false)
        return
      }

      // Fetch updated game state
      fetchLatestGameState()
    } catch (err) {
      console.error("Error in markAsReady:", err)
      setIsReady(false)
      setWaitingForOpponent(false)
    }
  }

  // Check if ship placement is valid on a specific board
  function isValidPlacementOnBoard(
    row: number,
    col: number,
    size: number,
    orientation: "horizontal" | "vertical",
    board: number[][],
  ): boolean {
    // Check if ship fits on board
    if (orientation === "horizontal" && col + size > BOARD_SIZE) return false
    if (orientation === "vertical" && row + size > BOARD_SIZE) return false

    // Check if ship overlaps with another ship or is adjacent to another ship
    for (
      let r = Math.max(0, row - 1);
      r <= Math.min(BOARD_SIZE - 1, row + (orientation === "vertical" ? size : 1));
      r++
    ) {
      for (
        let c = Math.max(0, col - 1);
        c <= Math.min(BOARD_SIZE - 1, col + (orientation === "horizontal" ? size : 1));
        c++
      ) {
        if (board[r][c] !== EMPTY) return false
      }
    }

    return true
  }

  // Check if ship placement is valid
  function isValidPlacement(row: number, col: number, size: number, orientation: "horizontal" | "vertical"): boolean {
    return isValidPlacementOnBoard(row, col, size, orientation, myBoard)
  }

  // Handle hover for ship placement preview
  function handleCellHover(row: number, col: number) {
    if (!placementPhase || isReady) return
    setHoverPosition({ row, col })
  }

  // Check if cell is part of current hover preview
  function isHoverCell(row: number, col: number): boolean {
    if (!placementPhase || !hoverPosition || isReady) return false

    const currentShip = SHIPS[currentShipIndex]
    if (!currentShip) return false

    if (shipOrientation === "horizontal") {
      return (
        row === hoverPosition.row &&
        col >= hoverPosition.col &&
        col < hoverPosition.col + currentShip.size &&
        hoverPosition.col + currentShip.size <= BOARD_SIZE
      )
    } else {
      return (
        col === hoverPosition.col &&
        row >= hoverPosition.row &&
        row < hoverPosition.row + currentShip.size &&
        hoverPosition.row + currentShip.size <= BOARD_SIZE
      )
    }
  }

  // Toggle ship orientation
  function toggleOrientation() {
    setShipOrientation(shipOrientation === "horizontal" ? "vertical" : "horizontal")
  }

  // Handle shot at opponent's board
  async function handleShot(row: number, col: number) {
    if (placementPhase || gameOver || waitingForOpponent) return
    if (!gameState || gameState.current_player !== currentUser?.id) return

    // Check if cell was already shot
    if (myShots[row][col] !== EMPTY) return

    try {
      setWaitingForOpponent(true)

      // Make move in database
      const { error } = await supabase.rpc("battleship_make_move", {
        p_game_state_id: gameState.id,
        p_player_id: currentUser?.id,
        p_row: row,
        p_col: col,
      })

      if (error) {
        console.error("Error making move:", error)
        
        // Fallback: Manual update if the RPC call fails
        if (error.code === '42883') { // Array length function error
          console.log("Attempting fallback method for move...");
          
          // Determine which player is making the move
          const isPlayer1 = gameState.player1 === currentUser?.id;
          
          // Create a deep copy of current game state to modify
          const opponentBoardField = isPlayer1 ? 'player2_board' : 'player1_board';
          const shotsField = isPlayer1 ? 'player1_shots' : 'player2_shots';
          const opponentBoard = gameState[opponentBoardField];
          const newShots = JSON.parse(JSON.stringify(gameState[shotsField]));
          
          // Update the shots array
          newShots[row][col] = opponentBoard[row][col] === SHIP ? HIT : MISS;
          
          // Record whether the shot was a hit
          const isHit = opponentBoard[row][col] === SHIP;
          
          // Update the game state
          const { error: updateError } = await supabase
            .from("battleship_game_states")
            .update({
              [shotsField]: newShots,
              current_player: isPlayer1 ? gameState.player2 : gameState.player1
            })
            .eq("id", gameState.id);
            
          // Also record the move in the moves table
          const { error: moveError } = await supabase
            .from("battleship_moves")
            .insert({
              game_state_id: gameState.id,
              player_id: currentUser?.id,
              row: row,
              col: col,
              is_hit: isHit
            });
            
          if (updateError || moveError) {
            console.error("Error with fallback update:", updateError || moveError);
            setWaitingForOpponent(false);
            return;
          }
        } else {
          setWaitingForOpponent(false);
          return;
        }
      }

      // Fetch updated game state
      fetchLatestGameState();
    } catch (err) {
      console.error("Error in handleShot:", err);
      setWaitingForOpponent(false);
    }
  }

  // Place ships randomly
  function placeShipsRandomly() {
    if (!placementPhase || isReady) return

    const newBoard = Array(BOARD_SIZE)
      .fill(0)
      .map(() => Array(BOARD_SIZE).fill(0))
    const newPlacedShips: ShipPlacement[] = []
    const newShipCells: { [key: string]: number } = {}

    for (let shipIndex = 0; shipIndex < SHIPS.length; shipIndex++) {
      const ship = SHIPS[shipIndex]
      let placed = false

      let attempts = 0
      const maxAttempts = 100

      while (!placed && attempts < maxAttempts) {
        attempts++
        const orientation = Math.random() > 0.5 ? "horizontal" : "vertical"
        const row = Math.floor(Math.random() * BOARD_SIZE)
        const col = Math.floor(Math.random() * BOARD_SIZE)

        if (isValidPlacementOnBoard(row, col, ship.size, orientation, newBoard)) {
          if (orientation === "horizontal") {
            for (let i = 0; i < ship.size; i++) {
              newBoard[row][col + i] = SHIP
              newShipCells[`${row},${col + i}`] = shipIndex
            }
          } else {
            for (let i = 0; i < ship.size; i++) {
              newBoard[row + i][col] = SHIP
              newShipCells[`${row + i},${col}`] = shipIndex
            }
          }

          newPlacedShips.push({
            shipIndex,
            row,
            col,
            orientation,
          })
          placed = true
        }
      }

      if (!placed) {
        // If we couldn't place a ship after max attempts, reset and try again
        return placeShipsRandomly()
      }
    }

    setMyBoard(newBoard)
    setMyShipCells(newShipCells)
    setPlacedShips(newPlacedShips)
    setCurrentShipIndex(SHIPS.length)
  }

  // Get ship color for a cell
  function getShipColor(row: number, col: number, isOpponentBoard = false): string {
    const cellKey = `${row},${col}`
    const shipIndex = isOpponentBoard ? opponentShipCells[cellKey] : myShipCells[cellKey]

    if (shipIndex === undefined) return "#4B5563" // Default gray
    return SHIPS[shipIndex]?.color || "#4B5563"
  }

  async function handleManualRefresh() {
    setIsRefreshing(true)
    await fetchLatestGameState()
    setTimeout(() => setIsRefreshing(false), 500)
  }

  function getPlayerName(playerId: string) {
    if (!playerId) return "Unknown"
    if (playerId === currentUser?.id) return "You"

    const player = players.find((p) => p.id === playerId)
    return player?.username || "Unknown player"
  }

  function isMyTurn() {
    return gameState && gameState.current_player === currentUser?.id
  }

  function toggleSound() {
    setSoundEnabled(!soundEnabled)
  }

  // Modified to use opponentShots
  function updateShipHealthStatus() {
    // Track damage to your ships based on opponent's shots
    if (opponentShots) {
      for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
          // If there's a hit on one of your ships
          if (opponentShots[row][col] === HIT && myBoard[row][col] === SHIP) {
            const cellKey = `${row},${col}`;
            const shipIndex = myShipCells[cellKey];
            
            // If the ship index is valid, we could track its damage here
            if (shipIndex !== undefined) {
              // This would be the place to update ship health if needed
              console.log(`Ship ${shipIndex} was hit at ${row},${col}`);
            }
          }
        }
      }
    }
  }
  
  // Call this function whenever opponent shots are updated
  useEffect(() => {
    updateShipHealthStatus();
  }, [opponentShots]);

  if (loading) {
    return <GameLoading />
  }

  if (error || !gameState) {
    return <GameError error={error || "Game not found"} />
  }

  return (
    <div className="bg-white min-h-screen p-4 md:p-8">
      <header className="max-w-4xl mx-auto mb-4 md:mb-8">
        <div className="flex justify-between items-center">
          <Link
            href={`/lobby/${lobbyId}`}
            className="flex items-center text-black transition-transform duration-200 hover:translate-x-[-4px]"
          >
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
          <h2 className="text-2xl md:text-3xl font-bold text-black mb-2 md:mb-0">Battleship</h2>

          <div className="flex items-center space-x-4">
            <button
              onClick={toggleSound}
              className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-all duration-300"
              aria-label={soundEnabled ? "Mute sound" : "Enable sound"}
            >
              {soundEnabled ? <FaVolumeUp className="text-black" /> : <FaVolumeMute className="text-black" />}
            </button>
            
            <button
              onClick={handleManualRefresh}
              className={`p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-all duration-300 ${isRefreshing ? "animate-spin" : ""}`}
              aria-label="Refresh game"
              disabled={isRefreshing}
            >
              <FaSync className="text-black" />
            </button>

            <div
              className={`flex items-center ${isMyTurn() && !gameOver && !waitingForOpponent && !placementPhase ? "animate-pulse" : ""}`}
            >
              <div
                className="w-4 h-4 md:w-6 md:h-6 rounded-full mr-2 transition-all duration-300"
                style={{
                  backgroundColor: isMyTurn() ? "#3B82F6" : "#EF4444",
                }}
              ></div>
              <span className="text-sm md:text-base">
                {gameOver
                  ? "Game Over"
                  : placementPhase
                    ? isReady
                      ? "Waiting for opponent"
                      : "Place your ships"
                    : waitingForOpponent
                      ? "Opponent's turn"
                      : isMyTurn()
                        ? "Your turn"
                        : "Opponent's turn"}
              </span>
            </div>
          </div>
        </div>

        {placementPhase && !isReady && (
          <div className="mb-4 flex flex-col sm:flex-row justify-between items-center gap-2">
            <div className="flex items-center">
              <p className="mr-2">Placing: {SHIPS[currentShipIndex]?.name || "All ships placed"}</p>
              <button
                onClick={toggleOrientation}
                className="px-3 py-1 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors"
                disabled={currentShipIndex >= SHIPS.length}
              >
                {shipOrientation === "horizontal" ? "Horizontal" : "Vertical"}
              </button>
            </div>
            <div className="flex gap-2">
              <button
                onClick={placeShipsRandomly}
                className="px-3 py-1 bg-gray-800 text-white rounded-md hover:bg-gray-700 transition-colors flex items-center"
                disabled={isReady}
              >
                <FaRandom className="mr-2" />
                Random
              </button>
              <button
                onClick={markAsReady}
                className={`px-3 py-1 rounded-md transition-colors flex items-center ${
                  placedShips.length === SHIPS.length
                    ? "bg-green-600 text-white hover:bg-green-700"
                    : "bg-gray-300 text-gray-500 cursor-not-allowed"
                }`}
                disabled={placedShips.length < SHIPS.length}
              >
                <FaCheck className="mr-2" />
                Ready
              </button>
            </div>
          </div>
        )}

        {gameOver && showWinnerMessage && (
          <div className="mb-6 p-4 bg-gray-100 rounded-lg text-center animate-fadeIn">
            {winner ? (
              <p className="text-lg font-bold animate-winner">
                {winner === currentUser?.id ? "You won! 🎉" : `${getPlayerName(winner)} won!`}
              </p>
            ) : (
              <p className="text-lg font-bold">Game ended in a draw!</p>
            )}
            <PlayAgainButton lobbyId={lobbyId} gameStateId={gameState.id} currentUser={currentUser} />
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* My Board */}
          <div>
            <h3 className="text-lg font-bold mb-2">Your Fleet</h3>
            <div className="bg-blue-100 p-2 rounded-lg">
              <div className="grid grid-cols-10 gap-1">
                {myBoard.map((row, rowIndex) =>
                  row.map((cell, colIndex) => (
                    <div
                      key={`my-${rowIndex}-${colIndex}`}
                      className={`aspect-square rounded-sm flex items-center justify-center cursor-pointer transition-all duration-200 ${
                        placementPhase &&
                        !isReady &&
                        isValidPlacement(rowIndex, colIndex, SHIPS[currentShipIndex]?.size || 0, shipOrientation)
                          ? "hover:bg-blue-300"
                          : ""
                      } ${
                        isHoverCell(rowIndex, colIndex)
                          ? isValidPlacement(
                              hoverPosition?.row || 0,
                              hoverPosition?.col || 0,
                              SHIPS[currentShipIndex]?.size || 0,
                              shipOrientation,
                            )
                            ? "bg-blue-300"
                            : "bg-red-300"
                          : cell === SHIP
                            ? "bg-opacity-90"
                            : cell === HIT
                              ? "bg-red-500"
                              : cell === MISS
                                ? "bg-gray-300"
                                : "bg-blue-200"
                      } ${
                        hitAnimation && hitAnimation.row === rowIndex && hitAnimation.col === colIndex
                          ? hitAnimation.isHit
                            ? "animate-hit"
                            : "animate-miss"
                          : ""
                      }`}
                      onClick={() => handleCellClick(rowIndex, colIndex)}
                      onMouseEnter={() => handleCellHover(rowIndex, colIndex)}
                      style={{
                        backgroundColor: cell === SHIP ? getShipColor(rowIndex, colIndex) : undefined,
                      }}
                    >
                      {cell === HIT && <div className="w-2 h-2 bg-white rounded-full"></div>}
                      {cell === MISS && <div className="w-2 h-2 bg-gray-500 rounded-full"></div>}
                    </div>
                  )),
                )}
              </div>
            </div>

            {/* Ship status */}
            <div className="mt-4 grid grid-cols-2 gap-2">
              {SHIPS.map((ship, index) => (
                <div key={`my-ship-${index}`} className="flex items-center">
                  <div className="w-4 h-4 rounded-sm mr-2" style={{ backgroundColor: ship.color }}></div>
                  <span className="text-sm">
                    {ship.name}: {myShipHealth[index]}/{ship.size}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Opponent's Board */}
          <div>
            <h3 className="text-lg font-bold mb-2">Enemy Waters</h3>
            <div className="bg-red-100 p-2 rounded-lg">
              <div className="grid grid-cols-10 gap-1">
                {opponentBoard.map((row, rowIndex) =>
                  row.map((cell, colIndex) => (
                    <div
                      key={`opponent-${rowIndex}-${colIndex}`}
                      className={`aspect-square rounded-sm flex items-center justify-center ${
                        !placementPhase &&
                        isMyTurn() &&
                        !gameOver &&
                        !waitingForOpponent &&
                        myShots[rowIndex][colIndex] === EMPTY
                          ? "cursor-pointer hover:bg-red-300"
                          : ""
                      } ${
                        cell === SHIP 
                          ? "bg-opacity-90" 
                          : cell === HIT 
                            ? "bg-red-500" 
                            : cell === MISS 
                              ? "bg-gray-300" 
                              : "bg-red-200"
                      } ${
                        hitAnimation && hitAnimation.row === rowIndex && hitAnimation.col === colIndex
                          ? hitAnimation.isHit
                            ? "animate-hit"
                            : "animate-miss"
                          : ""
                      }`}
                      onClick={() => handleCellClick(rowIndex, colIndex, true)}
                      style={{
                        backgroundColor: gameOver && cell === SHIP ? getShipColor(rowIndex, colIndex, true) : undefined,
                      }}
                    >
                      {cell === HIT && <div className="w-2 h-2 bg-white rounded-full"></div>}
                      {cell === MISS && <div className="w-2 h-2 bg-gray-500 rounded-full"></div>}
                    </div>
                  )),
                )}
              </div>
            </div>

            {/* Ship status */}
            <div className="mt-4 grid grid-cols-2 gap-2">
              {SHIPS.map((ship, index) => (
                <div key={`opponent-ship-${index}`} className="flex items-center">
                  <div className="w-4 h-4 rounded-sm mr-2" style={{ backgroundColor: ship.color }}></div>
                  <span className="text-sm">
                    {ship.name}: {opponentShipHealth[index]}/{ship.size}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent moves */}
        {recentMoves.length > 0 && (
          <div className="mt-6">
            <h3 className="text-lg font-bold mb-2">Recent Moves</h3>
            <div className="bg-gray-100 p-3 rounded-lg">
              <ul className="space-y-1">
                {recentMoves.map((move) => (
                  <li key={move.id} className="text-sm">
                    {getPlayerName(move.player_id)} fired at ({move.row}, {move.col}) and{" "}
                    {move.is_hit ? (
                      <span className="text-red-500 font-bold">hit</span>
                    ) : (
                      <span className="text-gray-500">missed</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </main>

      <style jsx global>{`
        @keyframes hit {
          0% { transform: scale(1); }
          50% { transform: scale(1.5); background-color: #EF4444; }
          100% { transform: scale(1); }
        }
        
        @keyframes miss {
          0% { transform: scale(1); }
          50% { transform: scale(1.2); background-color: #9CA3AF; }
          100% { transform: scale(1); }
        }
        
        @keyframes winner {
          0% { transform: scale(1); }
          50% { transform: scale(1.1); }
          100% { transform: scale(1); }
        }
        
        @keyframes fadeIn {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
        
        .animate-hit {
          animation: hit 0.5s ease-in-out;
        }
        
        .animate-miss {
          animation: miss 0.5s ease-in-out;
        }
        
        .animate-winner {
          animation: winner 1s ease-in-out infinite;
        }
        
        .animate-fadeIn {
          animation: fadeIn 0.5s ease-in-out;
        }
      `}</style>
    </div>
  )
}