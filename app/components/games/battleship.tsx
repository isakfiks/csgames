"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { FaArrowLeft, FaRedo, FaSync, FaRandom, FaCheck } from "react-icons/fa"
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
      if (isActive) {
        setPlayAgainStatus({
          requestedBy: [],
          newGameId: null,
        })
      }
    }

    fetchPlayAgainStatus()

    return () => {
      isActive = false
    }
  }, [gameStateId, supabase, currentUser])

  const handlePlayAgain = async () => {
    if (!currentUser) return

    setIsLoading(true)
    // Simulate request
    setTimeout(() => {
      setPlayAgainStatus({
        requestedBy: [currentUser.id],
        newGameId: null,
      })
      setIsLoading(false)
    }, 1000)
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
  const [lastMoveTime, setLastMoveTime] = useState<number>(0)
  const [lastHitCoords, setLastHitCoords] = useState<{ row: number; col: number } | null>(null)
  const [hitAnimation, setHitAnimation] = useState<{ row: number; col: number; isHit: boolean } | null>(null)

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
  const [myShipHealth, setMyShipHealth] = useState<{ [key: number]: number }>(
    SHIPS.reduce((acc, ship, index) => ({ ...acc, [index]: ship.size }), {}),
  )
  const [opponentShipHealth, setOpponentShipHealth] = useState<{ [key: number]: number }>(
    SHIPS.reduce((acc, ship, index) => ({ ...acc, [index]: ship.size }), {}),
  )

  // Ship cells mapping
  const [myShipCells, setMyShipCells] = useState<{ [key: string]: number }>({})
  const [opponentShipCells, setOpponentShipCells] = useState<{ [key: string]: number }>({})

  // Load game data
  useEffect(() => {
    let isActive = true
    let gameStateSubscription: RealtimeChannel | null = null

    async function loadGameData() {
      try {
        if (!currentUser) {
          router.push("/")
          return
        }

        // Mock game state
        const mockGameState: GameState = {
          id: "mock-id",
          lobby_id: lobbyId,
          player1: currentUser.id,
          player2: "opponent-id",
          player1_board: Array(BOARD_SIZE)
            .fill(0)
            .map(() => Array(BOARD_SIZE).fill(0)),
          player2_board: Array(BOARD_SIZE)
            .fill(0)
            .map(() => Array(BOARD_SIZE).fill(0)),
          player1_shots: Array(BOARD_SIZE)
            .fill(0)
            .map(() => Array(BOARD_SIZE).fill(0)),
          player2_shots: Array(BOARD_SIZE)
            .fill(0)
            .map(() => Array(BOARD_SIZE).fill(0)),
          player1_ready: false,
          player2_ready: false,
          current_player: currentUser.id,
          status: "setup",
          winner: null,
        }

        if (isActive) {
          setGameState(mockGameState)
          setPlayers([
            { id: currentUser.id, username: "You" },
            { id: "opponent-id", username: "Opponent" },
          ])
        }

        gameStateSubscription = supabase
          .channel("game_state_changes")
          .on("broadcast", { event: "game_update" }, (payload) => {
            if (!isActive) return
            console.log("Game state updated:", payload)
          })
          .subscribe()

        setTimeout(() => {
          if (isActive) setLoading(false)
        }, 1000)
      } catch (err: unknown) {
        console.error("Error loading game data:", err)
        if (isActive) setError((err as Error).message || "Failed to load game data")
      }
    }

    loadGameData()

    return () => {
      isActive = false
      if (gameStateSubscription) gameStateSubscription.unsubscribe()
    }
  }, [lobbyId, router, supabase, currentUser])

  // Handle ship placement
  function handleCellClick(row: number, col: number, isOpponentBoard = false) {
    if (isOpponentBoard) {
      if (placementPhase || waitingForOpponent) return
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
  function markAsReady() {
    if (!gameState || placedShips.length < SHIPS.length) return

    setIsReady(true)

    // Update game state
    const updatedGameState = {
      ...gameState,
      player1_ready: true,
    }
    setGameState(updatedGameState)

    setWaitingForOpponent(true)
    setTimeout(() => {
      if (gameState) {
        // Create a random opponent board
        const opponentBoardData = createRandomBoard()
        setOpponentBoard(opponentBoardData)

        // Update game state
        const updatedGameState = {
          ...gameState,
          player1_ready: true,
          player2_ready: true,
          status: "in_progress" as const,
        }
        setGameState(updatedGameState)
        setWaitingForOpponent(false)
        setPlacementPhase(false)
      }
    }, 2000)
  }

  // Create a random board for the opponent
  function createRandomBoard(): number[][] {
    const board = Array(BOARD_SIZE)
      .fill(0)
      .map(() => Array(BOARD_SIZE).fill(0))
    const shipCells: { [key: string]: number } = {}

    for (let shipIndex = 0; shipIndex < SHIPS.length; shipIndex++) {
      const ship = SHIPS[shipIndex]
      let placed = false

      while (!placed) {
        const orientation = Math.random() > 0.5 ? "horizontal" : "vertical"
        const row = Math.floor(Math.random() * BOARD_SIZE)
        const col = Math.floor(Math.random() * BOARD_SIZE)

        if (isValidPlacementOnBoard(row, col, ship.size, orientation, board)) {
          if (orientation === "horizontal") {
            for (let i = 0; i < ship.size; i++) {
              board[row][col + i] = SHIP
              shipCells[`${row},${col + i}`] = shipIndex
            }
          } else {
            for (let i = 0; i < ship.size; i++) {
              board[row + i][col] = SHIP
              shipCells[`${row + i},${col}`] = shipIndex
            }
          }
          placed = true
        }
      }
    }

    setOpponentShipCells(shipCells)
    return board
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
  function handleShot(row: number, col: number) {
    if (placementPhase || gameOver || waitingForOpponent) return
    if (!gameState || gameState.current_player !== currentUser?.id) return

    // Check if cell was already shot
    if (myShots[row][col] !== EMPTY) return

    // Update shots
    const newShots = [...myShots]
    const isHit = opponentBoard[row][col] === SHIP
    newShots[row][col] = isHit ? HIT : MISS
    setMyShots(newShots)

    // Update opponent board display
    const newOpponentBoard = [...opponentBoard]
    if (isHit) {
      newOpponentBoard[row][col] = HIT
      setLastHitCoords({ row, col })

      // Update ship health
      const shipIndex = opponentShipCells[`${row},${col}`]
      if (shipIndex !== undefined) {
        const newHealth = { ...opponentShipHealth }
        newHealth[shipIndex] = newHealth[shipIndex] - 1
        setOpponentShipHealth(newHealth)
      }
    } else {
      newOpponentBoard[row][col] = MISS
    }
    setOpponentBoard(newOpponentBoard)

    // Show hit animation
    setHitAnimation({ row, col, isHit })
    setTimeout(() => setHitAnimation(null), 1000)

    // Check for win
    if (checkForWin(opponentShipHealth)) {
      handleWin(currentUser?.id || "")
    } else {
      // Switch turns
      setWaitingForOpponent(true)
      setTimeout(() => {
        simulateOpponentTurn()
      }, 1500)
    }
  }

  // Simulate opponent's turn
  function simulateOpponentTurn() {
    if (!gameState) return

    // Update current player
    const updatedGameState = {
      ...gameState,
      current_player: gameState.player2,
    }
    setGameState(updatedGameState)

    // Simulate opponent thinking
    setTimeout(() => {
      let row, col

      if (lastHitCoords) {
        // Try to hit adjacent cells
        const directions = [
          [-1, 0], // up
          [1, 0], // down
          [0, -1], // left
          [0, 1], // right
        ]

        // Shuffle directions
        for (let i = directions.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1))
          ;[directions[i], directions[j]] = [directions[j], directions[i]]
        }

        let validMove = false

        for (const [dr, dc] of directions) {
          const newRow = lastHitCoords.row + dr
          const newCol = lastHitCoords.col + dc

          if (
            newRow >= 0 &&
            newRow < BOARD_SIZE &&
            newCol >= 0 &&
            newCol < BOARD_SIZE &&
            opponentShots[newRow][newCol] === EMPTY
          ) {
            row = newRow
            col = newCol
            validMove = true
            break
          }
        }

        if (!validMove) {
          // If no valid adjacent moves, reset lastHitCoords and make a random move
          setLastHitCoords(null)
          do {
            row = Math.floor(Math.random() * BOARD_SIZE)
            col = Math.floor(Math.random() * BOARD_SIZE)
          } while (opponentShots[row][col] !== EMPTY)
        }
      } else {
        // Random shot
        do {
          row = Math.floor(Math.random() * BOARD_SIZE)
          col = Math.floor(Math.random() * BOARD_SIZE)
        } while (opponentShots[row][col] !== EMPTY)
      }

      // Update opponent shots
      const newOpponentShots = [...opponentShots]
      const isHit = myBoard[row][col] === SHIP
      newOpponentShots[row][col] = isHit ? HIT : MISS
      setOpponentShots(newOpponentShots)

      // Update my board display
      const newMyBoard = [...myBoard]
      if (isHit) {
        newMyBoard[row][col] = HIT
        setLastHitCoords({ row, col })

        // Update ship health
        const shipIndex = myShipCells[`${row},${col}`]
        if (shipIndex !== undefined) {
          const newHealth = { ...myShipHealth }
          newHealth[shipIndex] = newHealth[shipIndex] - 1
          setMyShipHealth(newHealth)
        }
      } else {
        newMyBoard[row][col] = MISS
        setLastHitCoords(null)
      }
      setMyBoard(newMyBoard)

      // Show hit animation
      setHitAnimation({ row, col, isHit })
      setTimeout(() => setHitAnimation(null), 1000)

      // Check for opponent win
      if (checkForWin(myShipHealth)) {
        handleWin(gameState.player2)
      } else {
        // Switch turns back to player
        const updatedGameState = {
          ...gameState,
          current_player: gameState.player1,
        }
        setGameState(updatedGameState)
        setWaitingForOpponent(false)
      }
    }, 1000)
  }

  // Check if all ships are sunk
  function checkForWin(shipHealth: { [key: number]: number }): boolean {
    return Object.values(shipHealth).every((health) => health <= 0)
  }

  // Handle win
  function handleWin(winnerId: string) {
    if (!gameState) return

    setGameOver(true)
    setWinner(winnerId)
    setWaitingForOpponent(false)

    const updatedGameState = {
      ...gameState,
      status: "finished",
      winner: winnerId,
    }
    setGameState(updatedGameState)

    setTimeout(() => {
      setShowWinnerMessage(true)
    }, 500)
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

      while (!placed) {
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
    }

    setMyBoard(newBoard)
    setPlacedShips(newPlacedShips)
    setMyShipCells(newShipCells)
    setCurrentShipIndex(SHIPS.length)
  }

  // Get ship color for a cell
  function getShipColor(row: number, col: number, isOpponentBoard = false): string {
    const cellKey = `${row},${col}`
    const shipIndex = isOpponentBoard ? opponentShipCells[cellKey] : myShipCells[cellKey]

    if (shipIndex === undefined) return "#4B5563" 
    return SHIPS[shipIndex].color
  }

  function resetGame() {
    setPlacementPhase(true)
    setCurrentShipIndex(0)
    setPlacedShips([])
    setIsReady(false)
    setWaitingForOpponent(false)
    setGameOver(false)
    setWinner(null)
    setShowWinnerMessage(false)
    setMyBoard(
      Array(BOARD_SIZE)
        .fill(0)
        .map(() => Array(BOARD_SIZE).fill(0)),
    )
    setOpponentBoard(
      Array(BOARD_SIZE)
        .fill(0)
        .map(() => Array(BOARD_SIZE).fill(0)),
    )
    setMyShots(
      Array(BOARD_SIZE)
        .fill(0)
        .map(() => Array(BOARD_SIZE).fill(0)),
    )
    setOpponentShots(
      Array(BOARD_SIZE)
        .fill(0)
        .map(() => Array(BOARD_SIZE).fill(0)),
    )
    setMyShipHealth(SHIPS.reduce((acc, ship, index) => ({ ...acc, [index]: ship.size }), {}))
    setOpponentShipHealth(SHIPS.reduce((acc, ship, index) => ({ ...acc, [index]: ship.size }), {}))
    setMyShipCells({})
    setOpponentShipCells({})
    setLastHitCoords(null)
  }

  async function handleManualRefresh() {
    setIsRefreshing(true)
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
          <div>
            {/* My Board */}
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

          <div>
            {/* Opponent's Board */}
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
                      } ${cell === HIT ? "bg-red-500" : cell === MISS ? "bg-gray-300" : "bg-red-200"} ${
                        hitAnimation && hitAnimation.row === rowIndex && hitAnimation.col === colIndex
                          ? hitAnimation.isHit
                            ? "animate-hit"
                            : "animate-miss"
                          : ""
                      }`}
                      onClick={() => handleCellClick(rowIndex, colIndex, true)}
                    >
                      {cell === HIT && <div className="w-2 h-2 bg-white rounded-full"></div>}
                      {cell === MISS && <div className="w-2 h-2 bg-gray-500 rounded-full"></div>}
                    </div>
                  )),
                )}
              </div>
            </div>

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
      </main>
    </div>
  )
}
