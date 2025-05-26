"use client"

import { useEffect, useState, useRef } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { FaArrowLeft, FaRedo, FaSync } from "react-icons/fa"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import type { User, RealtimeChannel } from "@supabase/supabase-js"

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
  gravity_flipped: boolean
  player1_used_flip: boolean
  player2_used_flip: boolean
}

interface Profile {
  id: string
  username: string
}

interface ConnectFourGameProps {
  lobbyId: string
  currentUser: User | null
}

// Colors for the pieces
const EMPTY_COLOR = "#ffffff"
const PLAYER1_COLOR = "#e53e3e"
const PLAYER2_COLOR = "#ecc94b"

const POLLING_INTERVAL = 3000

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
        setPlayAgainStatus(data)

        // If there's a new game and current user has requested to play again, redirect
        if (data.new_game_id && data.requested_by.includes(currentUser?.id || "")) {
          window.location.href = `/game/${data.new_game_id}`
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
              requestedBy: newData.requested_by,
              newGameId: newData.new_game_id,
            })

            // If there's a new game and current user has requested to play again, redirect
            if (newData.new_game_id && newData.requested_by.includes(currentUser?.id || "")) {
              window.location.href = `/game/${newData.new_game_id}`
            }
          }
        },
      )
      .subscribe()

    return () => {
      isActive = false
      channel.unsubscribe()
    }
  }, [gameStateId, supabase, currentUser])

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

export default function ConnectFourGame({ lobbyId, currentUser }: ConnectFourGameProps) {
  const router = useRouter()
  const supabase = createClientComponentClient()
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [players, setPlayers] = useState<Profile[]>([])
  const [hoverColumn, setHoverColumn] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dropAnimation, setDropAnimation] = useState<{ row: number; col: number; player: number } | null>(null)
  const [winner, setWinner] = useState<string | null>(null)
  const [gameOver, setGameOver] = useState(false)
  const [lastMoveTime, setLastMoveTime] = useState<number>(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [showWinnerMessage, setShowWinnerMessage] = useState(false)
  const [invalidMoveColumn, setInvalidMoveColumn] = useState<number | null>(null)
  const [winningCells, setWinningCells] = useState<Array<[number, number]>>([])
  const [gameStartAnimation, setGameStartAnimation] = useState(true)
  const [isFlipping, setIsFlipping] = useState(false)

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
        console.log("Loading game data for lobby:", lobbyId)

        if (!currentUser) {
          router.push("/")
          return
        }

        // Fetch game state
        const { data: gameStateData, error: gameStateError } = await supabase
          .from("game_states")
          .select("*")
          .eq("lobby_id", lobbyId)
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
            setTimeout(() => {
              setShowWinnerMessage(true)
            }, 500)
            
            // Find winning cells
            findWinningCells(gameStateData.board)
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
              if (payload.new && "status" in payload.new && (payload.new as GameState).status === "finished") {
                setGameOver(true)
                if ("winner" in payload.new && (payload.new as GameState).winner) {
                  setWinner((payload.new as GameState).winner)
                  setTimeout(() => {
                    setShowWinnerMessage(true)
                  }, 500)
                  
                  // Find winning cells
                  if (payload.new.board) {
                    findWinningCells(payload.new.board)
                  }
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
        
        // Hide game start animation after a delay
        setTimeout(() => {
          setGameStartAnimation(false)
        }, 1000)
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
  }, [lobbyId, router, supabase, currentUser])
  
  // Find winning cells
  function findWinningCells(board: number[][]) {
    if (!board) return
    
    const rows = board.length
    const cols = board[0].length
    const winningCells: Array<[number, number]> = []
    
    // Check horizontal
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c <= cols - 4; c++) {
        if (
          board[r][c] !== 0 &&
          board[r][c] === board[r][c + 1] &&
          board[r][c] === board[r][c + 2] &&
          board[r][c] === board[r][c + 3]
        ) {
          winningCells.push([r, c], [r, c + 1], [r, c + 2], [r, c + 3])
        }
      }
    }
    
    // Check vertical
    for (let r = 0; r <= rows - 4; r++) {
      for (let c = 0; c < cols; c++) {
        if (
          board[r][c] !== 0 &&
          board[r][c] === board[r + 1][c] &&
          board[r][c] === board[r + 2][c] &&
          board[r][c] === board[r + 3][c]
        ) {
          winningCells.push([r, c], [r + 1, c], [r + 2, c], [r + 3, c])
        }
      }
    }
    
    // Check diagonal (down-right)
    for (let r = 0; r <= rows - 4; r++) {
      for (let c = 0; c <= cols - 4; c++) {
        if (
          board[r][c] !== 0 &&
          board[r][c] === board[r + 1][c + 1] &&
          board[r][c] === board[r + 2][c + 2] &&
          board[r][c] === board[r + 3][c + 3]
        ) {
          winningCells.push([r, c], [r + 1, c + 1], [r + 2, c + 2], [r + 3, c + 3])
        }
      }
    }
    
    // Check diagonal (up-right)
    for (let r = 3; r < rows; r++) {
      for (let c = 0; c <= cols - 4; c++) {
        if (
          board[r][c] !== 0 &&
          board[r][c] === board[r - 1][c + 1] &&
          board[r][c] === board[r - 2][c + 2] &&
          board[r][c] === board[r - 3][c + 3]
        ) {
          winningCells.push([r, c], [r - 1, c + 1], [r - 2, c + 2], [r - 3, c + 3])
        }
      }
    }
    
    if (winningCells.length > 0) {
      setWinningCells(winningCells)
    }
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

      const { data, error } = await supabase.from("game_states").select("*").eq("id", gameStateIdRef.current).single()

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
          setTimeout(() => {
            setShowWinnerMessage(true)
          }, 500)
          
          // Find winning cells
          findWinningCells(data.board)
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

  // Check if column is full
  function isColumnFull(columnIndex: number): boolean {
    if (!gameState) return true
    return gameState.board[0][columnIndex] !== 0
  }

  // Handle click
  async function handleColumnClick(columnIndex: number) {
    if (!gameState || gameOver) return

    // Check if it's the user's turn
    if (gameState.current_player !== currentUser?.id) {
      return
    }

    // Check if column is full
    if (isColumnFull(columnIndex)) {
      setInvalidMoveColumn(columnIndex)
      setTimeout(() => setInvalidMoveColumn(null), 800)
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

  async function handleGravityFlip() {
    if (!gameState || !currentUser) return;
    
    // Check if player has already used their flip
    const hasUsedFlip = gameState.player1 === currentUser.id 
      ? gameState.player1_used_flip 
      : gameState.player2_used_flip;
      
    if (hasUsedFlip) return;
    
    try {
      setIsFlipping(true);
      
      const { error } = await supabase
        .from("game_states")
        .update({
          gravity_flipped: !gameState.gravity_flipped,
          ...(gameState.player1 === currentUser.id 
            ? { player1_used_flip: true }
            : { player2_used_flip: true })
        })
        .eq("id", gameState.id);

      if (error) throw error;
      
      // Wait for flip animation
      await new Promise(resolve => setTimeout(resolve, 1000));
      await fetchLatestGameState();
    } catch (err) {
      console.error("Error flipping gravity:", err);
    } finally {
      setIsFlipping(false);
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
  
  // Check if a cell is part of the winning combination
  function isWinningCell(rowIndex: number, colIndex: number): boolean {
    return winningCells.some(([row, col]) => row === rowIndex && col === colIndex)
  }

  if (loading) {
    return <GameLoading />
  }

  if (error || !gameState) {
    return <GameError error={error || "Game not found"} />
  }

  const board = gameState.board
  const playerNumber = gameState.player1 === currentUser?.id ? 1 : 2
  const myColor = playerNumber === 1 ? PLAYER1_COLOR : PLAYER2_COLOR

  return (
    <div className="bg-white min-h-screen p-4 md:p-8 font-[family-name:var(--font-geist-sans)]">
      <header className="max-w-4xl mx-auto mb-4 md:mb-8">
        <div className="flex justify-between items-center">
          <Link href={`/lobby/${lobbyId}`} className="flex items-center text-black transition-transform duration-200 hover:translate-x-[-4px]">
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
              className={`p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-all duration-300 ${
                isRefreshing ? "animate-spin" : ""
              }`}
              aria-label="Refresh game"
              disabled={isRefreshing}
            >
              <FaSync className="text-black" />
            </button>

            {isMyTurn() && !gameOver && (
              <button
                onClick={handleGravityFlip}
                disabled={
                  (gameState.player1 === currentUser?.id && gameState.player1_used_flip) ||
                  (gameState.player2 === currentUser?.id && gameState.player2_used_flip) ||
                  isFlipping
                }
                className={`p-2 rounded-full transition-all duration-300 ${
                  isFlipping ? "animate-spin bg-yellow-400" :
                  ((gameState.player1 === currentUser?.id && gameState.player1_used_flip) ||
                  (gameState.player2 === currentUser?.id && gameState.player2_used_flip))
                    ? "bg-gray-200 cursor-not-allowed"
                    : "bg-yellow-400 hover:bg-yellow-500"
                }`}
                title={
                  ((gameState.player1 === currentUser?.id && gameState.player1_used_flip) ||
                  (gameState.player2 === currentUser?.id && gameState.player2_used_flip))
                    ? "Gravity flip already used"
                    : "Flip board gravity"
                }
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                </svg>
              </button>
            )}

            <div className={`flex items-center ${isMyTurn() && !gameOver ? "animate-pulse" : ""}`}>
              <div
                className="w-4 h-4 md:w-6 md:h-6 rounded-full mr-2 transition-all duration-300"
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

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div
            className={`p-3 rounded-lg border-2 transition-all duration-300 ${gameState.current_player === gameState.player1 && !gameOver ? "border-black shadow-md scale-105" : "border-gray-200"}`}
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
            className={`p-3 rounded-lg border-2 transition-all duration-300 ${gameState.current_player === gameState.player2 && !gameOver ? "border-black shadow-md scale-105" : "border-gray-200"}`}
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
          className={`bg-blue-600 p-2 md:p-4 rounded-lg mx-auto max-w-md md:max-w-lg relative transition-all duration-500 transform ${
            gameStartAnimation ? "scale-95 opacity-90" : "scale-100 opacity-100"
          } hover:scale-[1.01] ${isFlipping ? "animate-flip-board" : ""} ${
            gameState.gravity_flipped ? "rotate-180" : ""
          }`}
        >
          {isMyTurn() && hoverColumn !== null && !gameOver && (
            <div
              className="absolute top-0 w-[14.28%] h-8 flex items-center justify-center transition-all duration-200"
              style={{
                left: `${hoverColumn * 14.28}%`,
              }}
            >
              <div 
                className={`w-[80%] h-[80%] rounded-full ${isColumnFull(hoverColumn) ? "animate-shake" : "animate-bounce-slow"}`} 
                style={{ backgroundColor: myColor, opacity: 0.7 }}
              ></div>
            </div>
          )}

          <div className="grid grid-cols-7 gap-1 md:gap-2">
            {board.map((row: number[], rowIndex: number) =>
              row.map((cell: number, colIndex: number) => (
                <div
                  key={`${rowIndex}-${colIndex}`}
                  className={`aspect-square bg-blue-700 rounded-full flex items-center justify-center relative overflow-hidden transition-transform duration-200 
                    ${isMyTurn() && !gameOver && !isColumnFull(colIndex) ? "hover:scale-105" : ""} 
                    ${invalidMoveColumn === colIndex ? "animate-shake" : ""}`}
                  onClick={() => handleColumnClick(colIndex)}
                  onMouseEnter={() => setHoverColumn(colIndex)}
                  onMouseLeave={() => setHoverColumn(null)}
                  style={{ cursor: isMyTurn() && !gameOver && !isColumnFull(colIndex) ? "pointer" : "default" }}
                >
                  <div
                    className={`w-[85%] h-[85%] rounded-full transition-all duration-300`}
                    style={{
                      transform: gameState.gravity_flipped ? "rotate(180deg)" : "",
                      backgroundColor: getPlayerColor(cell),
                      boxShadow: isWinningCell(rowIndex, colIndex) 
                        ? "0 0 10px 2px rgba(255, 255, 255, 0.7), inset 0 2px 4px 0 rgba(0, 0, 0, 0.1)" 
                        : "inset 0 2px 4px 0 rgba(0, 0, 0, 0.1)",
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
