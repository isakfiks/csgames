"use client"

import { useState, useCallback } from "react"
import { motion } from "framer-motion"
import Link from "next/link"
import { FaArrowLeft, FaRedo, FaSync } from "react-icons/fa"
import type { User } from "@supabase/supabase-js"

interface Tile {
  value: number
  row: number
  col: number
}

interface SlidingPuzzleProps {
  lobbyId: string
  currentUser: User | null
}

export default function SlidingPuzzle({ lobbyId }: SlidingPuzzleProps) {
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [board, setBoard] = useState<Tile[]>(() => {
    const tiles: Tile[] = []
    for (let i = 0; i < 8; i++) {
      tiles.push({
        value: i + 1,
        row: Math.floor(i / 3),
        col: i % 3,
      })
    }

    tiles.push({
      value: 0,
      row: 2,
      col: 2,
    })
    return tiles
  })

  const handleManualRefresh = useCallback(() => {
    setIsRefreshing(true)
    setTimeout(() => setIsRefreshing(false), 500)
  }, [])

  const handleTileClick = (tile: Tile) => {
    const emptyTile = board.find((t) => t.value === 0)
    if (!emptyTile) return

    const isAdjacent =
      (Math.abs(tile.row - emptyTile.row) === 1 && tile.col === emptyTile.col) ||
      (Math.abs(tile.col - emptyTile.col) === 1 && tile.row === emptyTile.row)

    if (!isAdjacent) return

    // Swaps the positions
    const newBoard = board.map((t) => {
      if (t.value === tile.value) {
        return { ...t, row: emptyTile.row, col: emptyTile.col }
      }
      if (t.value === 0) {
        return { ...t, row: tile.row, col: tile.col }
      }
      return t
    })

    setBoard(newBoard)
  }

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
          <h2 className="text-2xl md:text-3xl font-bold text-black mb-2 md:mb-0">Sliding Puzzle</h2>

          <div className="flex items-center space-x-4">
            <button
              onClick={handleManualRefresh}
              className={`p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors ${isRefreshing ? "animate-spin" : ""}`}
              aria-label="Refresh game"
              disabled={isRefreshing}
            >
              <FaSync className="text-black" />
            </button>
          </div>
        </div>

        <div 
          className="bg-gray-100 p-4 rounded-lg mx-auto max-w-md relative"
          style={{
            boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
          }}
        >
          <div className="aspect-square bg-gray-100 rounded-xl p-3 relative">
            {board.map((tile) => (
              tile.value !== 0 && (
                <motion.button
                  key={tile.value}
                  className="absolute bg-white rounded-lg text-2xl font-bold shadow-lg 
                           hover:bg-gray-50 active:bg-gray-100 transition-colors
                           flex items-center justify-center cursor-pointer
                           border-2 border-gray-200"
                  style={{
                    width: "calc(33.333% - 8px)",
                    height: "calc(33.333% - 8px)",
                    left: `calc(${tile.col} * 33.333% + 4px)`,
                    top: `calc(${tile.row} * 33.333% + 4px)`,
                  }}
                  onClick={() => handleTileClick(tile)}
                  animate={{
                    left: `calc(${tile.col} * 33.333% + 4px)`,
                    top: `calc(${tile.row} * 33.333% + 4px)`,
                  }}
                  transition={{
                    type: "spring",
                    stiffness: 200,
                    damping: 20
                  }}
                  whileHover={{
                    scale: 1.02,
                  }}
                  whileTap={{
                    scale: 0.95,
                  }}
                >
                  {tile.value}
                </motion.button>
              )
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}