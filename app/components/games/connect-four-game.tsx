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
function PlayAgainButton() {
  const router = useRouter()

  return (
    <button
      onClick={() => router.push('/explore')}
      className="mt-2 px-4 py-2 rounded-lg flex items-center mx-auto transition-all duration-300 transform hover:scale-105 bg-black text-white hover:bg-gray-800"
    >
      <FaRedo className="mr-2" />
      Play Another Game
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
  const [winner, setWinner] = useState<string | null>(null)
  const [gameOver, setGameOver] = useState(false)
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
    
    // Function to check if coordinates are within bounds
    const isValidPosition = (r: number, c: number) => 
      r >= 0 && r < rows && c >= 0 && c < cols
    
    // Function to check a line of four cells
    const checkLine = (startR: number, startC: number, deltaR: number, deltaC: number) => {
      if (!isValidPosition(startR, startC)) return false
      
      const player = board[startR][startC]
      if (player === 0) return false
      
      const positions: Array<[number, number]> = []
      
      for (let i = 0; i < 4; i++) {
        const r = startR + deltaR * i
        const c = startC + deltaC * i
        
        if (!isValidPosition(r, c) || board[r][c] !== player) {
          return false
        }
        
        positions.push([r, c])
      }
      
      // If we found a winning line, add all positions to winningCells
      winningCells.push(...positions)
      return true
    }
    
    // Check all possible winning lines
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        // Skip empty cells
        if (board[r][c] === 0) continue
        
        checkLine(r, c, 0, 1)
        
        checkLine(r, c, 1, 0)
        
        checkLine(r, c, 1, 1)
        
        checkLine(r, c, -1, 1)
      }
    }
    
    if (winningCells.length > 0) {
      // Remove any duplicate winning cells
      const uniqueWinningCells = Array.from(new Set(winningCells.map(cell => JSON.stringify(cell))))
        .map(cell => JSON.parse(cell) as [number, number])
      setWinningCells(uniqueWinningCells)
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
    if (!gameState || gameOver) return;

    // Check if it's the user's turn
    if (gameState.current_player !== currentUser?.id) {
      return;
    }

    // Check if column is full
    if (isColumnFull(columnIndex)) {
      setInvalidMoveColumn(columnIndex);
      setTimeout(() => setInvalidMoveColumn(null), 800);
      return;
    }

    try {
      console.log(`Making move in column ${columnIndex}`);

      // Make the move with THE EXACT column index without any adjustment
      const { error } = await supabase.rpc("make_move", {
        game_state_id: gameState.id,
        column_index: columnIndex
      });

      if (error) {
        console.error("Error making move:", error);
      } else {
        // Wait for move to be processed
        await fetchLatestGameState();
      }
    } catch (err) {
      console.error("Error making move:", err);
    }
  }

  async function handleGravityFlip() {
    if (!gameState || !currentUser || !isMyTurn()) return;
    
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
            : { player2_used_flip: true }),
          // Change turns after flip
          current_player: gameState.player1 === currentUser.id 
            ? gameState.player2 
            : gameState.player1
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
            <PlayAgainButton/>
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
          {/* Preview piece when hovering */}
          {isMyTurn() && hoverColumn !== null && !gameOver && !isColumnFull(hoverColumn) && (
            <div
              className="absolute top-0 w-[14.28%] transition-all duration-200 z-10"
              style={{
                left: `${hoverColumn * 14.28}%`,
                transform: `translateY(${gameState.gravity_flipped ? '0' : '-100%'})`,
              }}
            >
              <div className="aspect-square p-1 md:p-2">
                <div 
                  className="w-full h-full rounded-full transition-transform duration-200 transform hover:scale-105"
                  style={{ 
                    backgroundColor: myColor,
                    opacity: 0.8,
                    boxShadow: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.1)',
                    transform: gameState.gravity_flipped ? 'rotate(180deg)' : '',
                  }}
                ></div>
              </div>
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
                  onClick={() => handleColumnClick(colIndex)} // Pass the raw colIndex without adjustments
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
