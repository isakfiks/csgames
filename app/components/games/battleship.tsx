"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { FaArrowLeft, FaRedo, FaSync } from "react-icons/fa"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import type { User } from "@supabase/supabase-js"

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
  { name: "Carrier", size: 5 },
  { name: "Battleship", size: 4 },
  { name: "Cruiser", size: 3 },
  { name: "Submarine", size: 3 },
  { name: "Destroyer", size: 2 }
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
  current_player: string
  status: "setup" | "in_progress" | "finished"
  winner: string | null
  created_at?: string
}

interface Profile {
  id: string
  username: string
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

export default function BattleshipGame({ lobbyId, currentUser }: BattleshipGameProps) {
  const router = useRouter()
  const supabase = createClientComponentClient()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [players, setPlayers] = useState<Profile[]>([])
  
  // Ship placement state
  const [placementPhase, setPlacementPhase] = useState(true)
  const [currentShipIndex, setCurrentShipIndex] = useState(0)
  const [shipOrientation, setShipOrientation] = useState<"horizontal" | "vertical">("horizontal")
  const [hoverPosition, setHoverPosition] = useState<{row: number, col: number} | null>(null)
  
  const [myBoard, setMyBoard] = useState<number[][]>(
    Array(BOARD_SIZE).fill(0).map(() => Array(BOARD_SIZE).fill(0))
  )
  const [opponentBoard, setOpponentBoard] = useState<number[][]>(
    Array(BOARD_SIZE).fill(0).map(() => Array(BOARD_SIZE).fill(0))
  )
  const [myShots, setMyShots] = useState<number[][]>(
    Array(BOARD_SIZE).fill(0).map(() => Array(BOARD_SIZE).fill(0))
  )

  useEffect(() => {
    let isActive = true

    async function loadGameData() {
      try {
        if (!currentUser) {
          router.push("/")
          return
        }

        // Mock game state for now
        const mockGameState: GameState = {
          id: "mock-id",
          lobby_id: lobbyId,
          player1: currentUser.id,
          player2: "opponent-id",
          player1_board: Array(BOARD_SIZE).fill(0).map(() => Array(BOARD_SIZE).fill(0)),
          player2_board: Array(BOARD_SIZE).fill(0).map(() => Array(BOARD_SIZE).fill(0)),
          player1_shots: Array(BOARD_SIZE).fill(0).map(() => Array(BOARD_SIZE).fill(0)),
          player2_shots: Array(BOARD_SIZE).fill(0).map(() => Array(BOARD_SIZE).fill(0)),
          current_player: currentUser.id,
          status: "setup",
          winner: null
        }
        
        if (isActive) {
          setGameState(mockGameState)
          setPlayers([
            { id: currentUser.id, username: "You" },
            { id: "opponent-id", username: "Opponent" }
          ])
        }
        
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
    }
  }, [lobbyId, router, supabase, currentUser])

  // Handle ship placement
  function handleCellClick(row: number, col: number) {
    if (!placementPhase) return
    
    const currentShip = SHIPS[currentShipIndex]
    if (!currentShip) return
    
    // Check if placement is valid
    if (isValidPlacement(row, col, currentShip.size, shipOrientation)) {
      // Place the ship
      const newBoard = [...myBoard]
      
      if (shipOrientation === "horizontal") {
        for (let i = 0; i < currentShip.size; i++) {
          newBoard[row][col + i] = SHIP
        }
      } else {
        for (let i = 0; i < currentShip.size; i++) {
          newBoard[row + i][col] = SHIP
        }
      }
      
      setMyBoard(newBoard)
      
      if (currentShipIndex < SHIPS.length - 1) {
        setCurrentShipIndex(currentShipIndex + 1)
      } else {
        setPlacementPhase(false)
      }
    }
  }
  
  // Check if ship placement is valid
  function isValidPlacement(row: number, col: number, size: number, orientation: "horizontal" | "vertical"): boolean {
    // Check if ship fits on board
    if (orientation === "horizontal" && col + size > BOARD_SIZE) return false
    if (orientation === "vertical" && row + size > BOARD_SIZE) return false
    
    // Check if ship overlaps with another ship
    if (orientation === "horizontal") {
      for (let i = 0; i < size; i++) {
        if (myBoard[row][col + i] !== EMPTY) return false
      }
    } else {
      for (let i = 0; i < size; i++) {
        if (myBoard[row + i][col] !== EMPTY) return false
      }
    }
    
    return true
  }
  
  // Handle hover for ship placement preview
  function handleCellHover(row: number, col: number) {
    if (!placementPhase) return
    setHoverPosition({ row, col })
  }
  
  // Check if cell is part of current hover preview
  function isHoverCell(row: number, col: number): boolean {
    if (!placementPhase || !hoverPosition) return false
    
    const currentShip = SHIPS[currentShipIndex]
    if (!currentShip) return false
    
    if (shipOrientation === "horizontal") {
      return row === hoverPosition.row && 
             col >= hoverPosition.col && 
             col < hoverPosition.col + currentShip.size &&
             hoverPosition.col + currentShip.size <= BOARD_SIZE
    } else {
      return col === hoverPosition.col && 
             row >= hoverPosition.row && 
             row < hoverPosition.row + currentShip.size &&
             hoverPosition.row + currentShip.size <= BOARD_SIZE
    }
  }
  
  // Toggle ship orientation
  function toggleOrientation() {
    setShipOrientation(shipOrientation === "horizontal" ? "vertical" : "horizontal")
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
        <div className="mb-4 md:mb-6">
          <h2 className="text-2xl md:text-3xl font-bold text-black mb-2">Battleship</h2>
          {placementPhase ? (
            <div className="flex items-center justify-between">
              <p className="text-gray-600">Place your {SHIPS[currentShipIndex]?.name || "ships"}</p>
              <button 
                onClick={toggleOrientation}
                className="px-3 py-1 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors"
              >
                {shipOrientation === "horizontal" ? "Horizontal" : "Vertical"}
              </button>
            </div>
          ) : (
            <p className="text-gray-600">Attack your opponent's fleet!</p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <h3 className="text-lg font-bold mb-2">Your Fleet</h3>
            <div className="bg-blue-100 p-2 rounded-lg">
              <div className="grid grid-cols-10 gap-1">
                {myBoard.map((row, rowIndex) =>
                  row.map((cell, colIndex) => (
                    <div
                      key={`my-${rowIndex}-${colIndex}`}
                      className={`aspect-square rounded-sm flex items-center justify-center cursor-pointer transition-all duration-200 ${
                        placementPhase && isValidPlacement(rowIndex, colIndex, SHIPS[currentShipIndex]?.size || 0, shipOrientation) 
                          ? "hover:bg-blue-300" 
                          : ""
                      } ${
                        isHoverCell(rowIndex, colIndex) 
                          ? isValidPlacement(hoverPosition?.row || 0, hoverPosition?.col || 0, SHIPS[currentShipIndex]?.size || 0, shipOrientation)
                            ? "bg-blue-300" 
                            : "bg-red-300"
                          : cell === SHIP 
                            ? "bg-gray-600" 
                            : "bg-blue-200"
                      }`}
                      onClick={() => handleCellClick(rowIndex, colIndex)}
                      onMouseEnter={() => handleCellHover(rowIndex, colIndex)}
                    ></div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-bold mb-2">Enemy Waters</h3>
            <div className="bg-red-100 p-2 rounded-lg">
              <div className="grid grid-cols-10 gap-1">
                {opponentBoard.map((row, rowIndex) =>
                  row.map((cell, colIndex) => (
                    <div
                      key={`opponent-${rowIndex}-${colIndex}`}
                      className={`aspect-square bg-red-200 rounded-sm flex items-center justify-center ${
                        !placementPhase ? "cursor-pointer hover:bg-red-300" : ""
                      }`}
                    ></div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
