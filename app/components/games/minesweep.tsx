"use client"

import type React from "react"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { FaArrowLeft, FaRedo, FaSync, FaChartBar, FaQuestionCircle } from "react-icons/fa"
import type { User } from "@supabase/supabase-js"

// Basic types for our Minesweeper game
type CellValue = number | "mine"
type CellState = "hidden" | "revealed" | "flagged"
type GameDifficulty = "beginner" | "intermediate" | "expert"

interface Cell {
  value: CellValue
  state: CellState
  exploded?: boolean
  x: number
  y: number
}

// Difficulty settings
const DIFFICULTY = {
  beginner: {
    rows: 9,
    cols: 9,
    mines: 10,
    name: "Beginner",
  },
  intermediate: {
    rows: 16,
    cols: 16,
    mines: 40,
    name: "Intermediate",
  },
  expert: {
    rows: 16,
    cols: 30,
    mines: 99,
    name: "Expert",
  },
}

// Emoji faces for game status
const FACES = {
  playing: "😊",
  won: "😎",
  lost: "😵",
}

interface SoundEffects {
  reveal: HTMLAudioElement;
  flag: HTMLAudioElement;
  explosion: HTMLAudioElement;
  win: HTMLAudioElement;
}

type TutorialStep = {
  title: string;
  description: string;
  demo?: Cell[][];
  action: string;
};

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    title: "Welcome to Minesweeper!",
    description: "Let's learn how to play this classic game step by step.",
    action: "Next",
  },
  {
    title: "The Basics",
    description: "The goal is to clear the field without hitting any mines. Numbers show how many mines are nearby.",
    demo: [
      [{ value: 1, state: "revealed", x: 0, y: 0 }, { value: "mine", state: "flagged", x: 1, y: 0 }],
      [{ value: 1, state: "revealed", x: 0, y: 1 }, { value: 1, state: "revealed", x: 1, y: 1 }],
    ],
    action: "Try it!",
  },
  {
    title: "Left Click",
    description: "Left click to reveal a cell. Try revealing the safe cells!",
    demo: [
      [{ value: 1, state: "hidden", x: 0, y: 0 }, { value: 1, state: "hidden", x: 1, y: 0 }],
      [{ value: 0, state: "hidden", x: 0, y: 1 }, { value: 1, state: "hidden", x: 1, y: 1 }],
    ],
    action: "Practice",
  },
  {
    title: "Right Click",
    description: "Right click (or long press) to place a flag where you think a mine is.",
    demo: [
      [{ value: 2, state: "revealed", x: 0, y: 0 }, { value: "mine", state: "hidden", x: 1, y: 0 }],
      [{ value: "mine", state: "hidden", x: 0, y: 1 }, { value: 2, state: "revealed", x: 1, y: 1 }],
    ],
    action: "Try flagging",
  },
];

export default function MinesweeperGame({ }: { lobbyId: string; currentUser: User | null }) {
  const [grid, setGrid] = useState<Cell[][]>([])
  const [gameStatus, setGameStatus] = useState<"playing" | "won" | "lost">("playing")
  const [difficulty, setDifficulty] = useState<GameDifficulty>("beginner")
  const [minesLeft, setMinesLeft] = useState(DIFFICULTY.beginner.mines)
  const [startTime, setStartTime] = useState<number | null>(null)
  const [time, setTime] = useState(0)
  const [firstClick, setFirstClick] = useState(true)
  const [gameStats, setGameStats] = useState({
    beginner: { gamesPlayed: 0, gamesWon: 0, bestTime: Number.POSITIVE_INFINITY },
    intermediate: { gamesPlayed: 0, gamesWon: 0, bestTime: Number.POSITIVE_INFINITY },
    expert: { gamesPlayed: 0, gamesWon: 0, bestTime: Number.POSITIVE_INFINITY },
  })
  const [showStats, setShowStats] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isHovering, setIsHovering] = useState(false)
  const [lastMoveTime, setLastMoveTime] = useState<number>(0)
  const [selectedCell, setSelectedCell] = useState<[number, number] | null>(null);
  const [holdTimer, setHoldTimer] = useState<NodeJS.Timeout | null>(null);
  const [sounds, setSounds] = useState<SoundEffects | null>(null);
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [tutorialDemo, setTutorialDemo] = useState<Cell[][]>([]);

  // Initialize the game
  useEffect(() => {
    initializeGame()
  }, [difficulty])

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

  // Load game stats from localStorage
  useEffect(() => {
    const savedStats = localStorage.getItem("minesweeperStats")
    if (savedStats) {
      setGameStats(JSON.parse(savedStats))
    }
  }, [])

  // Save game stats to localStorage
  const saveGameStats = useCallback((stats: typeof gameStats) => {
    localStorage.setItem("minesweeperStats", JSON.stringify(stats))
    setGameStats(stats)
  }, [])

  // Initialize a new game
  const initializeGame = useCallback(() => {
    const { rows, cols, mines } = DIFFICULTY[difficulty]

    // Create empty grid
    const newGrid: Cell[][] = Array(rows)
      .fill(null)
      .map((_, rowIndex) =>
        Array(cols)
          .fill(null)
          .map((_, colIndex) => ({
            value: 0,
            state: "hidden",
            x: colIndex,
            y: rowIndex,
          })),
      )

    setGrid(newGrid)
    setGameStatus("playing")
    setMinesLeft(mines)
    setStartTime(null)
    setTime(0)
    setFirstClick(true)
    setLastMoveTime(Date.now())
  }, [difficulty])

  // Place mines after first click to ensure first click is never a mine
  const placeMines = useCallback(
    (grid: Cell[][], firstRow: number, firstCol: number) => {
      const { rows, cols, mines } = DIFFICULTY[difficulty]
      const newGrid = JSON.parse(JSON.stringify(grid)) as Cell[][]

      // Place mines randomly
      let minesPlaced = 0
      while (minesPlaced < mines) {
        const row = Math.floor(Math.random() * rows)
        const col = Math.floor(Math.random() * cols)

        // Don't place mine on first click or adjacent cells
        const isFirstClickArea = Math.abs(row - firstRow) <= 1 && Math.abs(col - firstCol) <= 1

        if (!isFirstClickArea && newGrid[row][col].value !== "mine") {
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

      return newGrid
    },
    [difficulty],
  )

  // Handle cell click
  const handleCellClick = useCallback(
    (row: number, col: number) => {
      if (gameStatus !== "playing" || grid[row][col].state !== "hidden") {
        return
      }

      // Start timer on first click
      if (startTime === null) {
        setStartTime(Date.now())
      }

      let newGrid = [...grid.map((row) => [...row])]

      // On first click, place mines ensuring first click is safe
      if (firstClick) {
        newGrid = placeMines(newGrid, row, col)
        setFirstClick(false)
      }

      // If clicked on a mine, game over
      if (newGrid[row][col].value === "mine") {
        newGrid[row][col].exploded = true
        revealAllMines(newGrid)
        setGameStatus("lost")

        // Update stats
        const newStats = {
          ...gameStats,
          [difficulty]: {
            ...gameStats[difficulty],
            gamesPlayed: gameStats[difficulty].gamesPlayed + 1,
          },
        }
        saveGameStats(newStats)

        return
      } else {
        sounds?.reveal.play();
      }

      // Reveal the clicked cell
      revealCell(newGrid, row, col)

      // Check if player has won
      if (checkWinCondition(newGrid)) {
        setGameStatus("won")
        flagAllMines(newGrid)

        // Update stats
        const currentTime = Math.floor((Date.now() - (startTime || Date.now())) / 1000)
        const newStats = {
          ...gameStats,
          [difficulty]: {
            gamesPlayed: gameStats[difficulty].gamesPlayed + 1,
            gamesWon: gameStats[difficulty].gamesWon + 1,
            bestTime: Math.min(gameStats[difficulty].bestTime, currentTime),
          },
        }
        saveGameStats(newStats)
      }

      setGrid(newGrid)
      setLastMoveTime(Date.now())
    },
    [gameStatus, grid, firstClick, startTime, difficulty, gameStats, placeMines, saveGameStats, sounds],
  )

  // Handle right-click (flag)
  const handleCellRightClick = useCallback(
    (e: React.MouseEvent, row: number, col: number) => {
      e.preventDefault()

      if (gameStatus !== "playing" || grid[row][col].state === "revealed") {
        return
      }

      const newGrid = [...grid.map((row) => [...row])]

      if (newGrid[row][col].state === "hidden") {
        newGrid[row][col].state = "flagged"
        setMinesLeft((prev) => prev - 1)
      } else {
        newGrid[row][col].state = "hidden"
        setMinesLeft((prev) => prev + 1)
      }

      setGrid(newGrid)
      setLastMoveTime(Date.now())
    },
    [gameStatus, grid],
  )

  // Reveal a cell and its adjacent cells if it's empty
  const revealCell = (grid: Cell[][], row: number, col: number) => {
    const { rows, cols } = DIFFICULTY[difficulty]

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
        } else if (grid[row][col].state === "flagged" && grid[row][col].value !== "mine") {
          // Show incorrectly flagged cells
          grid[row][col].state = "revealed"
          grid[row][col].exploded = true
        }
      }
    }
  }

  // Flag all mines when game is won
  const flagAllMines = (grid: Cell[][]) => {
    for (let row = 0; row < grid.length; row++) {
      for (let col = 0; col < grid[0].length; col++) {
        if (grid[row][col].value === "mine" && grid[row][col].state !== "flagged") {
          grid[row][col].state = "flagged"
        }
      }
    }
    setMinesLeft(0)
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
      return cell.exploded ? "💥" : "💣"
    }

    return cell.value > 0 ? cell.value : null
  }

  // Get cell color based on its value
  const getCellColor = (cell: Cell) => {
    if (cell.state !== "revealed") {
      return ""
    }

    if (cell.value === "mine") {
      return cell.exploded ? "bg-red-600" : "bg-red-500"
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

  // Handle difficulty change
  const handleDifficultyChange = useCallback((newDifficulty: GameDifficulty) => {
    setDifficulty(newDifficulty)
  }, [])

  const handleManualRefresh = () => {
    setIsRefreshing(true)
    setTimeout(() => setIsRefreshing(false), 500)
  }

  // Toggle stats display
  const toggleStats = useCallback(() => {
    setShowStats((prev) => !prev)
  }, [])

  // Calculate total stats
  const totalStats = {
    gamesPlayed: gameStats.beginner.gamesPlayed + gameStats.intermediate.gamesPlayed + gameStats.expert.gamesPlayed,
    gamesWon: gameStats.beginner.gamesWon + gameStats.intermediate.gamesWon + gameStats.expert.gamesWon,
  }

  // Double-click handler to reveal adjacent cells
  const handleDoubleClick = useCallback((row: number, col: number) => {
    if (gameStatus !== "playing" || grid[row][col].state !== "revealed") return;

    const cell = grid[row][col];
    if (typeof cell.value !== "number") return;

    // Count flags around cell
    const { rows, cols } = DIFFICULTY[difficulty];
    let flagCount = 0;
    for (let r = Math.max(0, row - 1); r <= Math.min(rows - 1, row + 1); r++) {
      for (let c = Math.max(0, col - 1); c <= Math.min(cols - 1, col + 1); c++) {
        if (grid[r][c].state === "flagged") flagCount++;
      }
    }

    // If flags match the number, reveal adjacent cells
    if (flagCount === cell.value) {
      const newGrid = [...grid.map(row => [...row])];
      for (let r = Math.max(0, row - 1); r <= Math.min(rows - 1, row + 1); r++) {
        for (let c = Math.max(0, col - 1); c <= Math.min(cols - 1, col + 1); c++) {
          if (newGrid[r][c].state === "hidden") {
            handleCellClick(r, c);
          }
        }
      }
    }
  }, [gameStatus, grid, difficulty, handleCellClick]);

  // Start hold timer for flagging
  const startHoldTimer = useCallback((row: number, col: number) => {
    const timer = setTimeout(() => {
      handleCellRightClick(new MouseEvent('contextmenu'), row, col);
      sounds?.flag.play();
    }, 500);
    setHoldTimer(timer);
  }, [handleCellRightClick, sounds]);

  // Clear hold timer
  const clearHoldTimer = useCallback(() => {
    if (holdTimer) {
      clearTimeout(holdTimer);
      setHoldTimer(null);
    }
  }, [holdTimer]);

  // Initialize sound effects
  useEffect(() => {
    setSounds({
      reveal: new Audio("/sounds/reveal.wav"),
      flag: new Audio("/sounds/flag.wav"),
      explosion: new Audio("/sounds/explosion.wav"),
      win: new Audio("/sounds/win.wav"),
    });
  }, []);

  // Check if it's first time playing
  useEffect(() => {
    const hasPlayedBefore = localStorage.getItem("minesweeperHasPlayed");
    if (!hasPlayedBefore) {
      setShowTutorial(true);
      localStorage.setItem("minesweeperHasPlayed", "true");
    }
  }, []);

  // Add tutorial toggle
  const toggleTutorial = useCallback(() => {
    setShowTutorial(prev => !prev);
  }, []);

  // Add tutorial navigation
  const handleNextTutorialStep = useCallback(() => {
    if (tutorialStep < TUTORIAL_STEPS.length - 1) {
      setTutorialStep(prev => prev + 1);
      setIsDemoMode(true);
    } else {
      setShowTutorial(false);
      setIsDemoMode(false);
      initializeGame();
    }
  }, [tutorialStep, initializeGame]);

  // Initialize game on difficulty change
  useEffect(() => {
    initializeGame();
  }, [difficulty, initializeGame]);

  // Initialize tutorial demo when step changes
  useEffect(() => {
    if (TUTORIAL_STEPS[tutorialStep].demo) {
      setTutorialDemo(JSON.parse(JSON.stringify(TUTORIAL_STEPS[tutorialStep].demo)));
    }
  }, [tutorialStep]);

  // Modify tutorial overlay JSX - replace the demo section
  const renderTutorial = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg p-6 max-w-lg w-full">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold">{TUTORIAL_STEPS[tutorialStep].title}</h3>
          <button 
            onClick={() => setShowTutorial(false)}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        <p className="mb-6">{TUTORIAL_STEPS[tutorialStep].description}</p>

        {tutorialDemo.length > 0 && (
          <div className="mb-6 flex justify-center">
            <div className="border-2 border-gray-300 rounded-lg p-2 bg-gray-100">
              {tutorialDemo.map((row, rowIndex) => (
                <div key={rowIndex} className="flex">
                  {row.map((cell, colIndex) => (
                    <button
                      key={`${rowIndex}-${colIndex}`}
                      className={`w-12 h-12 flex items-center justify-center border border-gray-300 font-bold
                        ${cell.state === "hidden" ? "bg-gray-300 hover:bg-gray-400" : "bg-gray-100"}
                        ${getCellColor(cell)} transition-all duration-300
                        ${cell.state === "hidden" ? "animate-pulse" : ""}`}
                      onClick={() => {
                        if (isDemoMode) {
                          const newDemo = [...tutorialDemo.map(row => [...row])];
                          newDemo[rowIndex][colIndex].state = "revealed";
                          setTutorialDemo(newDemo);
                        }
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        if (isDemoMode) {
                          const newDemo = [...tutorialDemo.map(row => [...row])];
                          newDemo[rowIndex][colIndex].state = 
                            newDemo[rowIndex][colIndex].state === "hidden" ? "flagged" : "hidden";
                          setTutorialDemo(newDemo);
                        }
                      }}
                    >
                      {getCellContent(cell)}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-between">
          <button
            onClick={() => setShowTutorial(false)}
            className="px-4 py-2 text-gray-600 hover:text-gray-800"
          >
            Skip Tutorial
          </button>
          <button
            onClick={handleNextTutorialStep}
            className="px-6 py-2 bg-black text-white rounded-lg hover:bg-gray-800"
          >
            {TUTORIAL_STEPS[tutorialStep].action}
          </button>
        </div>
      </div>
    </div>
  );

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
              onClick={toggleTutorial}
              className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
              aria-label="Show tutorial"
            >
              <FaQuestionCircle className="text-black" />
            </button>
            <button
              onClick={toggleStats}
              className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
              aria-label="Show stats"
            >
              <FaChartBar className="text-black" />
            </button>
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

        <div className="flex justify-center gap-2 mb-4">
          {(Object.keys(DIFFICULTY) as GameDifficulty[]).map((diff) => (
            <button
              key={diff}
              onClick={() => handleDifficultyChange(diff)}
              className={`px-3 py-1 rounded transition-colors ${
                difficulty === diff ? "bg-black text-white" : "bg-gray-200 hover:bg-gray-300"
              }`}
            >
              {DIFFICULTY[diff].name}
            </button>
          ))}
        </div>

        <div className="flex justify-between items-center w-full max-w-md mx-auto mb-4 bg-gray-100 p-3 rounded-lg">
          <div className="bg-black text-white px-3 py-1 rounded font-mono">{minesLeft.toString().padStart(3, "0")}</div>
          <button
            onClick={initializeGame}
            className="bg-gray-200 hover:bg-gray-300 text-black px-3 py-1 rounded-full w-10 h-10 flex items-center justify-center text-xl"
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
          >
            {isHovering ? "🔄" : FACES[gameStatus]}
          </button>
          <div className="bg-black text-white px-3 py-1 rounded font-mono">{time.toString().padStart(3, "0")}</div>
        </div>

        {gameStatus === "won" && (
          <div className="mb-6 p-4 bg-green-100 rounded-lg text-center">
            <p className="text-lg font-bold text-green-600">You won! 🎉 Time: {time}s</p>
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
          <div className="mb-6 p-4 bg-red-100 rounded-lg text-center">
            <p className="text-lg font-bold text-red-600">Game Over! 💥 Better luck next time!</p>
            <button
              onClick={initializeGame}
              className="mt-2 bg-black text-white px-4 py-2 rounded-lg flex items-center mx-auto"
            >
              <FaRedo className="mr-2" />
              Try Again
            </button>
          </div>
        )}

        {showStats && (
          <div className="mb-6 p-4 bg-gray-100 rounded-lg">
            <h3 className="font-bold mb-2">Game Statistics</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {(Object.keys(DIFFICULTY) as GameDifficulty[]).map((diff) => (
                <div key={diff} className="p-3 bg-white rounded-lg shadow">
                  <h4 className="font-bold mb-2">{DIFFICULTY[diff].name}</h4>
                  <p>Games Played: {gameStats[diff].gamesPlayed}</p>
                  <p>Games Won: {gameStats[diff].gamesWon}</p>
                  <p>
                    Win Rate:{" "}
                    {gameStats[diff].gamesPlayed > 0
                      ? Math.round((gameStats[diff].gamesWon / gameStats[diff].gamesPlayed) * 100)
                      : 0}
                    %
                  </p>
                  <p>
                    Best Time:{" "}
                    {gameStats[diff].bestTime !== Number.POSITIVE_INFINITY ? `${gameStats[diff].bestTime}s` : "N/A"}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-4 p-3 bg-black text-white rounded-lg">
              <h4 className="font-bold mb-2">Overall</h4>
              <p>Total Games: {totalStats.gamesPlayed}</p>
              <p>Total Wins: {totalStats.gamesWon}</p>
              <p>
                Overall Win Rate:{" "}
                {totalStats.gamesPlayed > 0 ? Math.round((totalStats.gamesWon / totalStats.gamesPlayed) * 100) : 0}%
              </p>
            </div>

            <button
              onClick={() => {
                if (confirm("Are you sure you want to reset all statistics?")) {
                  const resetStats = {
                    beginner: { gamesPlayed: 0, gamesWon: 0, bestTime: Number.POSITIVE_INFINITY },
                    intermediate: { gamesPlayed: 0, gamesWon: 0, bestTime: Number.POSITIVE_INFINITY },
                    expert: { gamesPlayed: 0, gamesWon: 0, bestTime: Number.POSITIVE_INFINITY },
                  }
                  saveGameStats(resetStats)
                }
              }}
              className="mt-4 px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
            >
              Reset Stats
            </button>
          </div>
        )}

        {showTutorial && renderTutorial()}

        <div className="flex justify-center">
          <div
            className="border-2 border-gray-400 inline-block rounded-lg overflow-hidden bg-gray-100 p-2"
            style={{
              boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
            }}
            key={`board-${lastMoveTime}`}
          >
            <div className="overflow-auto max-w-full">
              <div className="min-w-max">
                {grid.map((row, rowIndex) => (
                  <div key={rowIndex} className="flex">
                    {row.map((cell, colIndex) => (
                      <button
                        key={`${rowIndex}-${colIndex}`}
                        className={`w-8 h-8 flex items-center justify-center border border-gray-300 font-bold 
                          ${cell.state === "hidden" ? "bg-gray-300 hover:bg-gray-400" : "bg-gray-100"}
                          ${getCellColor(cell)} transition-colors
                          ${selectedCell?.[0] === rowIndex && selectedCell?.[1] === colIndex ? 'ring-2 ring-blue-500' : ''}
                          hover:ring-2 hover:ring-gray-400`}
                        onClick={() => handleCellClick(rowIndex, colIndex)}
                        onDoubleClick={() => handleDoubleClick(rowIndex, colIndex)}
                        onContextMenu={(e) => handleCellRightClick(e, rowIndex, colIndex)}
                        onMouseDown={() => startHoldTimer(rowIndex, colIndex)}
                        onMouseUp={clearHoldTimer}
                        onMouseLeave={clearHoldTimer}
                        onTouchStart={() => startHoldTimer(rowIndex, colIndex)}
                        onTouchEnd={clearHoldTimer}
                        onKeyDown={(e) => {
                          if (e.key === ' ' || e.key === 'Enter') {
                            handleCellClick(rowIndex, colIndex);
                          } else if (e.key === 'f') {
                            handleCellRightClick(new MouseEvent('contextmenu'), rowIndex, colIndex);
                          }
                        }}
                        disabled={gameStatus !== "playing"}
                        tabIndex={0}
                        aria-label={`Cell at row ${rowIndex + 1}, column ${colIndex + 1}, ${cell.state === 'revealed' ? 
                          `value ${cell.value}` : cell.state}`}
                      >
                        {getCellContent(cell)}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 text-sm text-gray-600 text-center">
          <p>Left-click to reveal a cell, right-click to place a flag.</p>
        </div>
      </main>
    </div>
  )
}
