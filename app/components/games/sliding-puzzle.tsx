"use client"

import { useState, useCallback, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import Link from "next/link"
import { FaArrowLeft, FaRedo, FaSync, FaUndo } from "react-icons/fa"
import type { User } from "@supabase/supabase-js"

interface Tile {
  value: number
  row: number
  col: number
}

interface SoundEffects {
  move: HTMLAudioElement
  win: HTMLAudioElement
}

interface GameStats {
  bestTime: number
  fewestMoves: number
}

interface SlidingPuzzleProps {
  lobbyId: string
  currentUser: User | null
}

function isSolvable(tiles: Tile[]): boolean {
  const inversions = tiles.reduce((acc, tile, i) => {
    if (tile.value === 0) return acc
    return acc + tiles.slice(i + 1).filter(t => t.value !== 0 && t.value < tile.value).length
  }, 0)
  
  // If number of inversions is even, it means the puzzle is solvable 
  return inversions % 2 === 0
}

function isWinningPosition(board: Tile[]): boolean {
  return board.every((tile) => 
    tile.value === 0 ||
    (tile.row * 3 + tile.col === tile.value - 1) // Check if tile is in correct position
  )
}

export default function SlidingPuzzle({ lobbyId }: SlidingPuzzleProps) {
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isShuffling, setIsShuffling] = useState(false)
  const [moves, setMoves] = useState(0)
  const [startTime, setStartTime] = useState<number | null>(null)
  const [time, setTime] = useState(0)
  const [hasWon, setHasWon] = useState(false)
  const [sounds, setSounds] = useState<SoundEffects | null>(null)
  const [stats, setStats] = useState<GameStats>(() => {
    // Load stats from localStorage (might use supabase later)
    const savedStats = localStorage.getItem('slidingPuzzleStats')
    return savedStats ? JSON.parse(savedStats) : {
      bestTime: Number.POSITIVE_INFINITY,
      fewestMoves: Number.POSITIVE_INFINITY
    }
  })
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
  const [moveHistory, setMoveHistory] = useState<Tile[][]>([])
  const [currentHistoryIndex, setCurrentHistoryIndex] = useState(-1)

  // Initialize sfx
  useEffect(() => {
    setSounds({
      move: new Audio("/sounds/slide.wav"),
      win: new Audio("/sounds/win.wav"),
    })
  }, [])

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null

    if (startTime && !hasWon) {
      interval = setInterval(() => {
        setTime(Math.floor((Date.now() - startTime) / 1000))
      }, 1000)
    }

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [startTime, hasWon])

  const shuffleBoard = useCallback(async () => {
    if (isShuffling) return
    setIsShuffling(true)
    setMoves(0)
    setTime(0)
    setStartTime(null)
    setHasWon(false)
    setMoveHistory([])
    setCurrentHistoryIndex(-1)
    
    let values = Array.from({ length: 9 }, (_, i) => i)
    do {
      for (let i = values.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [values[i], values[j]] = [values[j], values[i]]
      }
    } while (!isSolvable(values.map((v, i) => ({ 
      value: v, 
      row: Math.floor(i / 3), 
      col: i % 3 
    }))))

    // Create the final board state
    const finalBoard = values.map((value, i) => ({
      value,
      row: Math.floor(i / 3),
      col: i % 3
    }))

    // Set the board immediately to the final state
    setBoard(finalBoard)
    
    // Give time for the animation to complete
    await new Promise(resolve => setTimeout(resolve, 500))
    setStartTime(Date.now())
    setIsShuffling(false)
  }, [])

  const handleManualRefresh = useCallback(async () => {
    if (isRefreshing || isShuffling) return
    setIsRefreshing(true)
    await shuffleBoard()
    setIsRefreshing(false)
  }, [shuffleBoard, isRefreshing, isShuffling])

  const handleTileClick = useCallback((tile: Tile) => {
    if (isShuffling || hasWon) return

    const emptyTile = board.find((t) => t.value === 0)
    if (!emptyTile) return

    const isAdjacent =
      (Math.abs(tile.row - emptyTile.row) === 1 && tile.col === emptyTile.col) ||
      (Math.abs(tile.col - emptyTile.col) === 1 && tile.row === emptyTile.row)

    if (!isAdjacent) return

    // Start timer on first move if not started
    if (!startTime) {
      setStartTime(Date.now())
    }

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
    setMoves(m => m + 1)
    sounds?.move.play()

    const newHistory = moveHistory.slice(0, currentHistoryIndex + 1)
    setMoveHistory([...newHistory, newBoard])
    setCurrentHistoryIndex(currentHistoryIndex + 1)    // Check for win after move
    if (isWinningPosition(newBoard)) {
      setHasWon(true)
      sounds?.win.play()

      // Update stats
      const currentTime = Math.floor((Date.now() - (startTime || Date.now())) / 1000)
      const currentMoves = moves + 1
      setStats(prevStats => {
        const newStats = {
          bestTime: Math.min(prevStats.bestTime, currentTime),
          fewestMoves: Math.min(prevStats.fewestMoves, currentMoves)
        }
        localStorage.setItem('slidingPuzzleStats', JSON.stringify(newStats))
        return newStats
      })
    }
  }, [board, isShuffling, startTime, hasWon, sounds, moveHistory, currentHistoryIndex])

  const handleUndo = useCallback(() => {
    if (currentHistoryIndex <= 0 || isShuffling || hasWon) return
    const prevBoard = moveHistory[currentHistoryIndex - 1]
    setBoard(prevBoard)
    setCurrentHistoryIndex(currentHistoryIndex - 1)
    setMoves(m => m - 1)
    sounds?.move.play()
  }, [currentHistoryIndex, moveHistory, isShuffling, hasWon, sounds])

  const handleRedo = useCallback(() => {
    if (currentHistoryIndex >= moveHistory.length - 1 || isShuffling || hasWon) return
    const nextBoard = moveHistory[currentHistoryIndex + 1]
    setBoard(nextBoard)
    setCurrentHistoryIndex(currentHistoryIndex + 1)
    setMoves(m => m + 1)
    sounds?.move.play()
  }, [currentHistoryIndex, moveHistory, isShuffling, hasWon, sounds])

  // Initial shuffle
  useEffect(() => {
    shuffleBoard()
  }, [shuffleBoard])

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (isShuffling || hasWon) return

      // Undo on ctrl + z
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault()
        handleUndo()
      }
      
      // Redo on ctrl + y
      if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
        e.preventDefault()
        handleRedo()
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [handleUndo, handleRedo, isShuffling, hasWon])

  const undoCount = currentHistoryIndex
  const redoCount = moveHistory.length - 1 - currentHistoryIndex

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
            <div className="relative group">
              <button
                onClick={handleUndo}
                className={`p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors
                          ${(currentHistoryIndex <= 0 || isShuffling || hasWon) ? "opacity-50 cursor-not-allowed" : ""}`}
                disabled={currentHistoryIndex <= 0 || isShuffling || hasWon}
                aria-label="Undo move"
              >
                <FaUndo className="text-black" />
              </button>
              {undoCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-black text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {undoCount}
                </span>
              )}
              <span className="absolute left-1/2 -translate-x-1/2 -bottom-8 bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                Undo (Ctrl+Z)
              </span>
            </div>
            <div className="relative group">
              <button
                onClick={handleRedo}
                className={`p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors
                          ${(currentHistoryIndex >= moveHistory.length - 1 || isShuffling || hasWon) ? "opacity-50 cursor-not-allowed" : ""}`}
                disabled={currentHistoryIndex >= moveHistory.length - 1 || isShuffling || hasWon}
                aria-label="Redo move"
              >
                <FaRedo className="text-black" />
              </button>
              {redoCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-black text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {redoCount}
                </span>
              )}
              <span className="absolute left-1/2 -translate-x-1/2 -bottom-8 bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                Redo (Ctrl+Y)
              </span>
            </div>
            <button
              onClick={handleManualRefresh}
              className={`p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors ${isRefreshing || isShuffling ? "animate-spin" : ""}`}
              aria-label="Shuffle puzzle"
              disabled={isRefreshing || isShuffling}
            >
              <FaSync className="text-black" />
            </button>
          </div>
        </div>

        <div className="flex justify-between items-center w-full max-w-md mx-auto mb-4 bg-gray-100 p-3 rounded-lg">
          <div className="bg-black text-white px-3 py-1 rounded font-mono">
            {moves.toString().padStart(3, "0")}
          </div>
          <div className="bg-black text-white px-3 py-1 rounded font-mono">
            {time.toString().padStart(3, "0")}s
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 w-full max-w-md mx-auto mb-4">
          <div className="bg-gray-100 p-3 rounded-lg">
            <div className="text-sm text-gray-600 mb-1">Best Time</div>
            <div className="font-mono text-lg font-bold">
              {stats.bestTime === Number.POSITIVE_INFINITY ? "---" : `${stats.bestTime}s`}
            </div>
          </div>
          <div className="bg-gray-100 p-3 rounded-lg">
            <div className="text-sm text-gray-600 mb-1">Fewest Moves</div>
            <div className="font-mono text-lg font-bold">
              {stats.fewestMoves === Number.POSITIVE_INFINITY ? "---" : stats.fewestMoves}
            </div>
          </div>
          <button
            onClick={() => {
              if (confirm("Are you sure you want to reset your stats?")) {
                const resetStats = {
                  bestTime: Number.POSITIVE_INFINITY,
                  fewestMoves: Number.POSITIVE_INFINITY
                }
                setStats(resetStats)
                localStorage.setItem('slidingPuzzleStats', JSON.stringify(resetStats))
              }
            }}
            className="col-span-2 text-xs text-gray-500 hover:text-gray-700 transition-colors mt-1"
          >
            Reset Stats
          </button>
        </div>
        
        {hasWon && (
          <div className="mb-4 p-4 bg-green-100 rounded-lg text-center animate-fadeIn max-w-md mx-auto">
            <p className="text-lg font-bold text-green-600">
              Puzzle solved! 🎉 
            </p>
            <p className="text-sm text-green-600">
              Completed in {moves} moves and {time} seconds
            </p>
            <button
              onClick={handleManualRefresh}
              className="mt-2 bg-black text-white px-4 py-2 rounded-lg flex items-center mx-auto"
            >
              <FaRedo className="mr-2" />
              Play Again
            </button>
          </div>
        )}

        <div 
          className="bg-gray-100 p-4 rounded-lg mx-auto max-w-md relative"
          style={{
            boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
          }}
        >
          <div className="aspect-square bg-gray-100 rounded-xl p-3 relative">
            <AnimatePresence>
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
                    initial={isShuffling ? { scale: 0.8, opacity: 0 } : false}
                    animate={{
                      left: `calc(${tile.col} * 33.333% + 4px)`,
                      top: `calc(${tile.row} * 33.333% + 4px)`,
                      scale: 1,
                      opacity: 1
                    }}
                    exit={{ scale: 0.8, opacity: 0 }}
                    transition={{
                      type: "spring",
                      stiffness: 300,
                      damping: 25,
                      opacity: { duration: 0.2 }
                    }}
                    whileHover={isShuffling ? {} : { scale: 1.02 }}
                    whileTap={isShuffling ? {} : { scale: 0.95 }}
                  >
                    {tile.value}
                  </motion.button>
                )
              ))}
            </AnimatePresence>
          </div>
        </div>
      </main>
    </div>
  )
}