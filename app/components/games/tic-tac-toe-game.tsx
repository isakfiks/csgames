"use client"

import { useEffect, useState, useRef } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { FaArrowLeft, FaRedo, FaSync } from "react-icons/fa"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import type { User, RealtimeChannel } from "@supabase/supabase-js"
import { motion } from "framer-motion"

interface GameState {
  id: string
  lobby_id: string
  board: (string | number)[][]
  status: "pending" | "playing" | "finished"
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

interface TicTacToeGameProps {
  lobbyId: string
  currentUser: User | null
}

// Colors for the pieces
const PLAYER1_COLOR = "#e53e3e" // Red
const PLAYER2_COLOR = "#3182ce" // Blue
const POLLING_INTERVAL = 3000

function GameLoading() {
  return <div>Loading...</div>
}

function GameError({ error }: { error: string }) {
  return <div>Error: {error}</div>
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
            const newData = payload.new as any
            setPlayAgainStatus(newData)

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
      className={`mt-2 px-4 py-2 rounded-lg flex items-center mx-auto ${
        hasRequested ? "bg-gray-300 text-gray-700" : "bg-black text-white hover:bg-gray-800"
      }`}
    >
      <FaRedo className="mr-2" />
      {isLoading ? "Loading..." : hasRequested ? `Waiting for opponent (${requestCount}/2)` : "Play Again"}
    </button>
  )
}

export default function TicTacToeGame({ lobbyId, currentUser }: TicTacToeGameProps) {
  const router = useRouter()
  const supabase = createClientComponentClient()
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [players, setPlayers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [winner, setWinner] = useState<string | null>(null)
  const [gameOver, setGameOver] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastMove, setLastMove] = useState<{ row: number; col: number } | null>(null)
  const [winningLine, setWinningLine] = useState<number[][] | null>(null)
  const [animatedCells, setAnimatedCells] = useState<Set<string>>(new Set())

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
        console.log("Game status:", gameStateData.status)

        if (isActive) {
          // Initialize empty board if needed
          if (!gameStateData.board || !Array.isArray(gameStateData.board) || gameStateData.board.length !== 3) {
            console.log("Initializing empty board")
            gameStateData.board = [
              ["", "", ""],
              ["", "", ""],
              ["", "", ""],
            ]
          } else {
            // Ensure each cell is properly initialized
            for (let i = 0; i < 3; i++) {
              if (!Array.isArray(gameStateData.board[i]) || gameStateData.board[i].length !== 3) {
                gameStateData.board[i] = ["", "", ""]
              } else {
                // Convert null or undefined values to empty strings
                for (let j = 0; j < 3; j++) {
                  if (gameStateData.board[i][j] === null || gameStateData.board[i][j] === undefined) {
                    gameStateData.board[i][j] = ""
                  }
                }
              }
            }
            console.log("Board after initialization:", gameStateData.board)
          }

          setGameState(gameStateData)
          gameStateIdRef.current = gameStateData.id

          // Check for winning line
          if (gameStateData.status === "finished" && gameStateData.winner) {
            const winLine = findWinningLine(gameStateData.board)
            if (winLine) setWinningLine(winLine)
          }
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

              const newState = payload.new as GameState
              const oldState = payload.old as GameState

              // Find the difference between old and new board
              if (oldState && oldState.board && newState.board) {
                findBoardDifference(oldState.board, newState.board)
              }

              // Always update the state
              setGameState(newState)

              // Check if the game is over
              if (newState.status === "finished") {
                setGameOver(true)
                if (newState.winner) {
                  setWinner(newState.winner)

                  // Find winning line
                  const winLine = findWinningLine(newState.board)
                  if (winLine) setWinningLine(winLine)
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
  }, [lobbyId, router, supabase, currentUser])

  // Find the difference between old and new board
  function findBoardDifference(oldBoard: (string | number)[][], newBoard: (string | number)[][]) {
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        const oldCell = oldBoard[row][col]
        const newCell = newBoard[row][col]

        if (oldCell !== newCell && !isCellEmpty(newCell)) {
          console.log(`Cell changed at [${row},${col}]: ${oldCell} -> ${newCell}`)

          setLastMove({ row, col })

          const cellKey = `${row}-${col}`
          setAnimatedCells((prev) => new Set(prev).add(cellKey))

          return
        }
      }
    }
  }

  function findWinningLine(board: (string | number)[][]) {
    const lines = [
      // Rows
      [
        [0, 0],
        [0, 1],
        [0, 2],
      ],
      [
        [1, 0],
        [1, 1],
        [1, 2],
      ],
      [
        [2, 0],
        [2, 1],
        [2, 2],
      ],
      // Columns
      [
        [0, 0],
        [1, 0],
        [2, 0],
      ],
      [
        [0, 1],
        [1, 1],
        [2, 1],
      ],
      [
        [0, 2],
        [1, 2],
        [2, 2],
      ],
      // Diagonals
      [
        [0, 0],
        [1, 1],
        [2, 2],
      ],
      [
        [0, 2],
        [1, 1],
        [2, 0],
      ],
    ]

    for (const line of lines) {
      const [a, b, c] = line
      if (board[a[0]][a[1]] && board[a[0]][a[1]] === board[b[0]][b[1]] && board[a[0]][a[1]] === board[c[0]][c[1]]) {
        return line
      }
    }

    return null
  }

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

      // Compare with previous board to find the changes
      if (gameState && gameState.board) {
        findBoardDifference(gameState.board, data.board)
      }

      // Update state
      setGameState(data)

      // Check if the game is over
      if (data.status === "finished") {
        setGameOver(true)
        if (data.winner) {
          setWinner(data.winner)

          // Find winning line
          const winLine = findWinningLine(data.board)
          if (winLine) setWinningLine(winLine)
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

  // Function to handle cell click
  async function handleCellClick(rowIndex: number, colIndex: number) {
    console.log(`Cell clicked: row ${rowIndex}, col ${colIndex}`)
    if (!gameState) {
      console.log("No game state available")
      return
    }
    console.log(`Cell value: "${gameState.board[rowIndex][colIndex]}"`, typeof gameState.board[rowIndex][colIndex])
    console.log("Game status:", gameState.status)

    if (!gameState || gameOver) {
      console.log("Game is over or no game state")
      return
    }

    // Check if game is in progress (status is "playing")
    if (gameState.status !== "playing") {
      console.log("Game is not in playing state")
      return
    }

    // Check if cell is already filled
    const cellValue = gameState.board[rowIndex][colIndex]
    if (cellValue !== "" && cellValue !== 0 && cellValue !== null && cellValue !== undefined) {
      console.log("Cell is already filled")
      return
    }

    // Check if it's the user's turn
    if (gameState.current_player !== currentUser?.id) {
      console.log("Not your turn")
      return
    }

    try {
      console.log(`Making move at row ${rowIndex}, column ${colIndex}`)

      // Update board locally first for immediate feedback
      updateBoardLocally(rowIndex, colIndex)

      // Make the move using a server function
      const { error } = await supabase.rpc("make_tic_tac_toe_move", {
        game_state_id: gameState.id,
        row_index: rowIndex,
        col_index: colIndex,
      })

      if (error) {
        console.error("Error making move:", error)
        // Don't alert the user, just log the error
        // Revert the local change by fetching the latest state
        fetchLatestGameState()
      } else {
        console.log("Move successful")
        // Fetch game state after moving
        fetchLatestGameState()
      }
    } catch (err: unknown) {
      console.error("Error making move:", err)
      // Revert the local change by fetching the latest state
      fetchLatestGameState()
    }
  }

  // Add this function after handleCellClick
  function updateBoardLocally(rowIndex: number, colIndex: number) {
    if (!gameState || !currentUser) return

    console.log("Updating board locally")

    // Create a deep copy of the current board
    const newBoard = JSON.parse(JSON.stringify(gameState.board))

    // Ensure the board has the correct structure
    if (!Array.isArray(newBoard) || newBoard.length !== 3) {
      console.error("Invalid board structure:", newBoard)
      return
    }

    // Update the board with the player's symbol
    newBoard[rowIndex][colIndex] = currentUser.id

    console.log("Updated board:", newBoard)

    // Update the game state
    setGameState({
      ...gameState,
      board: newBoard,
      current_player: gameState.current_player === gameState.player1 ? gameState.player2 : gameState.player1,
    })

    // Set last move for animation
    setLastMove({ row: rowIndex, col: colIndex })

    // Add to animated cells
    const cellKey = `${rowIndex}-${colIndex}`
    setAnimatedCells((prev) => new Set(prev).add(cellKey))
  }

  function getPlayerName(playerId: string) {
    if (!playerId) return "Unknown"

    const player = players.find((p) => p.id === playerId)
    return player?.username || "Unknown player"
  }

  function getPlayerSymbol(playerId: string) {
    return playerId === gameState?.player1 ? "X" : "O"
  }

  function getPlayerColor(playerId: string) {
    return playerId === gameState?.player1 ? PLAYER1_COLOR : PLAYER2_COLOR
  }

  function isMyTurn() {
    return gameState && gameState.current_player === currentUser?.id
  }

  function isCellInWinningLine(rowIndex: number, colIndex: number) {
    if (!winningLine) return false

    return winningLine.some(([row, col]) => row === rowIndex && col === colIndex)
  }

  function isCellEmpty(cell: string | number | null | undefined) {
    return cell === "" || cell === 0 || cell === null || cell === undefined
  }

  function shouldAnimateCell(rowIndex: number, colIndex: number) {
    // Only animate if this is the last move or part of the winning line
    const isLastMoveCell = lastMove?.row === rowIndex && lastMove?.col === colIndex
    const isWinningCell = isCellInWinningLine(rowIndex, colIndex)
    const cellKey = `${rowIndex}-${colIndex}`
    const isNewlyPlaced = animatedCells.has(cellKey)

    return isLastMoveCell || isWinningCell || isNewlyPlaced
  }

  if (loading) {
    return <GameLoading />
  }

  if (error || !gameState) {
    return <GameError error={error || "Game not found"} />
  }

  const board = gameState.board || Array(3).fill(Array(3).fill(""))
  const isPlaying = gameState.status === "playing"

  return (
    <div className="bg-white min-h-screen p-4 md:p-8 font-[family-name:var(--font-geist-sans)]">
      <header className="max-w-4xl mx-auto mb-4 md:mb-8">
        <div className="flex justify-between items-center">
          <Link href={`/lobby/${lobbyId}`} className="flex items-center text-black">
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
          <h2 className="text-2xl md:text-3xl font-bold text-black mb-2 md:mb-0">Tic Tac Toe</h2>

          <div className="flex items-center space-x-4">
            <button
              onClick={handleManualRefresh}
              className={`p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors ${isRefreshing ? "animate-spin" : ""}`}
              aria-label="Refresh game"
              disabled={isRefreshing}
            >
              <FaSync className="text-black" />
            </button>

            <div className={`flex items-center ${isMyTurn() && !gameOver && isPlaying ? "animate-pulse" : ""}`}>
              <div
                className="w-8 h-8 rounded-md mr-2 flex items-center justify-center font-bold text-white"
                style={{
                  backgroundColor: getPlayerColor(gameState.current_player),
                }}
              >
                {getPlayerSymbol(gameState.current_player)}
              </div>
              <span className="text-sm md:text-base">
                {gameOver
                  ? "Game Over"
                  : !isPlaying
                    ? "Waiting..."
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
            <PlayAgainButton lobbyId={lobbyId} gameStateId={gameState.id} currentUser={currentUser} />
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div
            className={`p-3 rounded-lg border-2 ${gameState.current_player === gameState.player1 && !gameOver && isPlaying ? "border-black" : "border-gray-200"}`}
          >
            <div className="flex items-center">
              <div
                className="w-8 h-8 rounded-md mr-2 flex items-center justify-center font-bold text-white"
                style={{ backgroundColor: PLAYER1_COLOR }}
              >
                X
              </div>
              <div>
                <p className="font-bold">{getPlayerName(gameState.player1)}</p>
                <p className="text-xs text-gray-500">{gameState.player1 === currentUser?.id ? "(You)" : ""}</p>
              </div>
            </div>
          </div>
          <div
            className={`p-3 rounded-lg border-2 ${gameState.current_player === gameState.player2 && !gameOver && isPlaying ? "border-black" : "border-gray-200"}`}
          >
            <div className="flex items-center">
              <div
                className="w-8 h-8 rounded-md mr-2 flex items-center justify-center font-bold text-white"
                style={{ backgroundColor: PLAYER2_COLOR }}
              >
                O
              </div>
              <div>
                <p className="font-bold">{getPlayerName(gameState.player2)}</p>
                <p className="text-xs text-gray-500">{gameState.player2 === currentUser?.id ? "(You)" : ""}</p>
              </div>
            </div>
          </div>
        </div>

        <div
          ref={boardRef}
          className="bg-gray-100 p-4 rounded-lg mx-auto max-w-md relative"
          style={{
            boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
          }}
        >
          <div className="grid grid-cols-3 gap-3">
            {Array.isArray(board) && board.length === 3
              ? board.map((row: (string | number)[], rowIndex: number) =>
                  row.map((cell: string | number, colIndex: number) => {
                    const isWinningCell = isCellInWinningLine(rowIndex, colIndex)
                    const isEmpty = isCellEmpty(cell)
                    const shouldAnimate = shouldAnimateCell(rowIndex, colIndex)

                    return (
                      <motion.div
                        key={`${rowIndex}-${colIndex}`}
                        className={`aspect-square bg-white rounded-md flex items-center justify-center relative overflow-hidden border-2 ${
                          isWinningCell ? "border-green-500" : "border-gray-200"
                        }`}
                        onClick={() => handleCellClick(rowIndex, colIndex)}
                        whileHover={
                          isMyTurn() && isEmpty && !gameOver && isPlaying
                            ? { scale: 1.05, backgroundColor: "#f9fafb" }
                            : {}
                        }
                        whileTap={isMyTurn() && isEmpty && !gameOver && isPlaying ? { scale: 0.95 } : {}}
                        style={{ cursor: isMyTurn() && isEmpty && !gameOver && isPlaying ? "pointer" : "default" }}
                      >
                        {!isEmpty && (
                          <div
                            className={`w-full h-full flex items-center justify-center font-bold text-3xl md:text-5xl ${
                              shouldAnimate ? "animate-cell" : ""
                            } ${isWinningCell ? "animate-winning-cell" : ""}`}
                            style={{
                              color: cell === gameState.player1 || cell === 1 ? PLAYER1_COLOR : PLAYER2_COLOR,
                            }}
                          >
                            {cell === gameState.player1 || cell === 1 ? "X" : "O"}
                          </div>
                        )}
                      </motion.div>
                    )
                  }),
                )
              : // Fallback if board is not properly structured
                Array(3)
                  .fill(null)
                  .map((_, rowIndex) =>
                    Array(3)
                      .fill(null)
                      .map((_, colIndex) => (
                        <motion.div
                          key={`${rowIndex}-${colIndex}`}
                          className="aspect-square bg-white rounded-md flex items-center justify-center relative overflow-hidden border-2 border-gray-200"
                          onClick={() => handleCellClick(rowIndex, colIndex)}
                          whileHover={
                            isMyTurn() && !gameOver && isPlaying ? { scale: 1.05, backgroundColor: "#f9fafb" } : {}
                          }
                          style={{ cursor: isMyTurn() && !gameOver && isPlaying ? "pointer" : "default" }}
                        />
                      )),
                  )}
          </div>

          {/* Winning line animation */}
          {winningLine && (
            <motion.div
              className="absolute top-0 left-0 w-full h-full pointer-events-none"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              <svg className="w-full h-full absolute top-0 left-0">
                <motion.line
                  x1={`${(winningLine[0][1] * 100) / 3 + 100 / 6}%`}
                  y1={`${(winningLine[0][0] * 100) / 3 + 100 / 6}%`}
                  x2={`${(winningLine[2][1] * 100) / 3 + 100 / 6}%`}
                  y2={`${(winningLine[2][0] * 100) / 3 + 100 / 6}%`}
                  stroke="rgba(34, 197, 94, 0.6)"
                  strokeWidth="8"
                  strokeLinecap="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.5, delay: 0.3 }}
                />
              </svg>
            </motion.div>
          )}
        </div>
      </main>
    </div>
  )
}
