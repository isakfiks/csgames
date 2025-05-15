"use client"

import { useEffect, useState, useRef } from "react"
import Link from "next/link"
import { FaArrowLeft, FaRedo, FaSync } from "react-icons/fa"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import type { User } from "@supabase/supabase-js"

// Basic types for our Minesweeper game
type CellValue = number | "mine"
type CellState = "hidden" | "revealed" | "flagged"

interface Cell {
  value: CellValue
  state: CellState
}

// Initial difficulty settings
const DIFFICULTY = {
  beginner: {
    rows: 9,
    cols: 9,
    mines: 10,
  },
}

function GameLoading() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-white">
      <div className="text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-black border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"></div>
        <p className="mt-4 text-lg font-medium text-gray-700">Loading game...</p>
      </div>
    </div>
  )
}

function GameError({ error }: { error: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-white p-4">
      <div className="text-center max-w-md">
        <h1 className="text-2xl font-bold text-red-600 mb-4">Error</h1>
        <p className="text-gray-700 mb-6">{error}</p>
        <Link
          href="/explore"
          className="inline-block bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors"
        >
          Return to Games
        </Link>
      </div>
    </div>
  )
}

export default function MinesweeperGame({ lobbyId, currentUser }: { lobbyId: string; currentUser: User | null }) {
  const supabase = createClientComponentClient()
  const [grid, setGrid] = useState<Cell[][]>([])
  const [gameStatus, setGameStatus] = useState<"playing" | "won" | "lost">("playing")
  const [minesLeft, setMinesLeft] = useState(DIFFICULTY.beginner.mines)
  const [startTime, setStartTime] = useState<number | null>(null)
  const [time, setTime] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Initialize the game
  useEffect(() => {
    initializeGame()
  }, [])

  // Timer logic
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null

    if (startTime && gameStatus === "playing") {
      interval = setInterval(() => {
        setTime(Math.floor((Date.now() - startTime) / 1000))
      }, 1000)
    }

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [startTime, gameStatus])

  // Initialize a new game
  const initializeGame = () => {
    const { rows, cols, mines } = DIFFICULTY.beginner

    // Create empty grid
    const newGrid: Cell[][] = Array(rows)
      .fill(null)
      .map(() =>
        Array(cols)
          .fill(null)
          .map(() => ({
            value: 0,
            state: "hidden",
          })),
      )

    // Place mines randomly
    let minesPlaced = 0
    while (minesPlaced < mines) {
      const row = Math.floor(Math.random() * rows)
      const col = Math.floor(Math.random() * cols)

      if (newGrid[row][col].value !== "mine") {
        newGrid[row][col].value = "mine"
        minesPlaced++

        // Update adjacent cell values
        for (let r = Math.max(0, row - 1); r <= Math.min(rows - 1, row + 1); r++) {
          for (let c = Math.max(0, col - 1); c <= Math.min(cols - 1, col + 1); c++) {
            if (newGrid[r][c].value !== "mine") {
              newGrid[r][c].value = (newGrid[r][c].value as number) + 1
            }
          }
        }
      }
    }

    setGrid(newGrid)
    setGameStatus("playing")
    setMinesLeft(mines)
    setStartTime(null)
    setTime(0)
  }

  // Handle cell click
  const handleCellClick = (row: number, col: number) => {
    if (gameStatus !== "playing" || grid[row][col].state !== "hidden") {
      return
    }

    // Start timer on first click
    if (startTime === null) {
      setStartTime(Date.now())
    }

    const newGrid = [...grid]

    // If clicked on a mine, game over
    if (newGrid[row][col].value === "mine") {
      revealAllMines(newGrid)
      setGameStatus("lost")
      return
    }

    // Reveal the clicked cell
    revealCell(newGrid, row, col)

    // Check if player has won
    if (checkWinCondition(newGrid)) {
      setGameStatus("won")
    }

    setGrid(newGrid)
  }

  // Handle right-click (flag)
  const handleCellRightClick = (e: React.MouseEvent, row: number, col: number) => {
    e.preventDefault()

    if (gameStatus !== "playing" || grid[row][col].state === "revealed") {
      return
    }

    const newGrid = [...grid]

    if (newGrid[row][col].state === "hidden") {
      newGrid[row][col].state = "flagged"
      setMinesLeft(minesLeft - 1)
    } else {
      newGrid[row][col].state = "hidden"
      setMinesLeft(minesLeft + 1)
    }

    setGrid(newGrid)
  }

  // Reveal a cell and its adjacent cells if it's empty
  const revealCell = (grid: Cell[][], row: number, col: number) => {
    const { rows, cols } = DIFFICULTY.beginner

    if (row < 0 || row >= rows || col < 0 || col >= cols || grid[row][col].state !== "hidden") {
      return
    }

    grid[row][col].state = "revealed"

    // If cell is empty (0), reveal adjacent cells
    if (grid[row][col].value === 0) {
      for (let r = Math.max(0, row - 1); r <= Math.min(rows - 1, row + 1); r++) {
        for (let c = Math.max(0, col - 1); c <= Math.min(cols - 1, col + 1); c++) {
          revealCell(grid, r, c)
        }
      }
    }
  }

  // Reveal all mines when game is lost
  const revealAllMines = (grid: Cell[][]) => {
    for (let row = 0; row < grid.length; row++) {
      for (let col = 0; col < grid[0].length; col++) {
        if (grid[row][col].value === "mine") {
          grid[row][col].state = "revealed"
        }
      }
    }
  }

  // Check if player has won
  const checkWinCondition = (grid: Cell[][]) => {
    for (let row = 0; row < grid.length; row++) {
      for (let col = 0; col < grid[0].length; col++) {
        if (grid[row][col].value !== "mine" && grid[row][col].state !== "revealed") {
          return false
        }
      }
    }
    return true
  }

  // Get cell content based on its state and value
  const getCellContent = (cell: Cell) => {
    if (cell.state === "hidden") {
      return null
    }

    if (cell.state === "flagged") {
      return "🚩"
    }

    if (cell.value === "mine") {
      return "💣"
    }

    return cell.value > 0 ? cell.value : null
  }

  // Get cell color based on its value
  const getCellColor = (cell: Cell) => {
    if (cell.state !== "revealed") {
      return ""
    }

    if (cell.value === "mine") {
      return "bg-red-500"
    }

    if (cell.value === 0) {
      return "bg-gray-200"
    }

    const colors = [
      "", // 0 - not used
      "text-blue-600", // 1
      "text-green-600", // 2
      "text-red-600", // 3
      "text-purple-600", // 4
      "text-yellow-600", // 5
      "text-pink-600", // 6
      "text-gray-600", // 7
      "text-black", // 8
    ]

    return colors[cell.value as number] || ""
  }

  const handleManualRefresh = () => {
    setIsRefreshing(true)
    setTimeout(() => setIsRefreshing(false), 500)
  }

  return (
    <div className="bg-white min-h-screen p-4 md:p-8 font-[family-name:var(--font-geist-sans)]">
      <header className="max-w-4xl mx-auto mb-4 md:mb-8">
        <div className="flex justify-between items-center">
          <Link href="/explore" className="flex items-center text-black">
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
          <h2 className="text-2xl md:text-3xl font-bold text-black mb-2 md:mb-0">Minesweeper</h2>

          <div className="flex items-center space-x-4">
            <button
              onClick={handleManualRefresh}
              className={`p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors ${
                isRefreshing ? "animate-spin" : ""
              }`}
              aria-label="Refresh game"
              disabled={isRefreshing}
            >
              <FaSync className="text-black" />
            </button>
          </div>
        </div>

        <div className="flex justify-between items-center w-full max-w-md mx-auto mb-4 bg-gray-100 p-3 rounded-lg">
          <div className="bg-black text-white px-3 py-1 rounded font-mono">{minesLeft}</div>
          <button
            onClick={initializeGame}
            className="bg-black text-white px-3 py-1 rounded hover:bg-gray-800 transition-colors"
          >
            New Game
          </button>
          <div className="bg-black text-white px-3 py-1 rounded font-mono">{time}s</div>
        </div>

        {gameStatus === "won" && (
          <div className="mb-6 p-4 bg-gray-100 rounded-lg text-center">
            <p className="text-lg font-bold text-green-600">You won! 🎉</p>
            <button
              onClick={initializeGame}
              className="mt-2 bg-black text-white px-4 py-2 rounded-lg flex items-center mx-auto"
            >
              <FaRedo className="mr-2" />
              Play Again
            </button>
          </div>
        )}

        {gameStatus === "lost" && (
          <div className="mb-6 p-4 bg-gray-100 rounded-lg text-center">
            <p className="text-lg font-bold text-red-600">Game Over! 💥</p>
            <button
              onClick={initializeGame}
              className="mt-2 bg-black text-white px-4 py-2 rounded-lg flex items-center mx-auto"
            >
              <FaRedo className="mr-2" />
              Try Again
            </button>
          </div>
        )}

        <div className="flex justify-center">
          <div
            className="border-2 border-gray-400 inline-block rounded-lg overflow-hidden"
            style={{
              boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
            }}
          >
            {grid.map((row, rowIndex) => (
              <div key={rowIndex} className="flex">
                {row.map((cell, colIndex) => (
                  <button
                    key={`${rowIndex}-${colIndex}`}
                    className={`w-8 h-8 flex items-center justify-center border border-gray-300 font-bold ${
                      cell.state === "hidden" ? "bg-gray-300 hover:bg-gray-400" : "bg-gray-100"
                    } ${getCellColor(cell)} transition-colors`}
                    onClick={() => handleCellClick(rowIndex, colIndex)}
                    onContextMenu={(e) => handleCellRightClick(e, rowIndex, colIndex)}
                    disabled={gameStatus !== "playing"}
                  >
                    {getCellContent(cell)}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 text-sm text-gray-600 text-center">
          <p>Left-click to reveal a cell, right-click to place a flag.</p>
        </div>
      </main>
    </div>
  )
}
