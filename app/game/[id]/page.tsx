"use client"

import { use, useCallback } from "react"
import { useEffect, useState } from "react"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import type { User } from "@supabase/supabase-js"
import { useRouter } from "next/navigation"
import ConnectFourGame from "@/app/components/games/connect-four-game"
import TicTacToeGame from "@/app/components/games/tic-tac-toe-game"
import MinesweeperGame from "@/app/components/games/minesweep"
import BattleshipGame from "@/app/components/games/battleship"
import BalloonGame from "@/app/components/games/balloon-game"
import GameLoading from "@/app/components/games/game-loading"
import Link from "next/link"
import { FaGamepad, FaArrowLeft } from "react-icons/fa"
import TicTacToeAIOpponent from "@/app/components/games/tic-tac-toe-opponent"
import SlidingPuzzle from "@/app/components/games/sliding-puzzle"
import WordleGame from "@/app/components/games/wordle-game"

interface TicTacToeGameState {
  id: string
  lobby_id: string
  board: (string | null)[][]
  current_player: string
  player1: string
  player2: string
  status: "waiting" | "playing" | "completed"
  winner: string | null
  ai_opponent: boolean
}

interface Game {
  id: string
  title: string
  singlePlayer?: boolean
  [key: string]: unknown
}

interface Lobby {
  id: string
  game_id: string
  [key: string]: unknown
}

interface GameState {
  id: string
  lobby_id: string
  ai_opponent?: boolean
  started_at?: string
  ended_at?: string
  [key: string]: unknown
}

export default function GamePage({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = use(paramsPromise)
  const router = useRouter()
  const supabase = createClientComponentClient()

  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [lobby, setLobby] = useState<Lobby | null>(null)
  const [game, setGame] = useState<Game | null>(null)
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [elapsedTime, setElapsedTime] = useState<number>(0)

  const calculateElapsedTime = useCallback(() => {
    if (!gameState?.started_at) return 0
    const start = new Date(gameState.started_at).getTime()
    const end = gameState.ended_at ? new Date(gameState.ended_at).getTime() : Date.now()
    return Math.floor((end - start) / 1000)
  }, [gameState?.started_at, gameState?.ended_at])

  useEffect(() => {
    if (gameState?.started_at && !gameState?.ended_at) {
      const timer = setInterval(() => {
        setElapsedTime(calculateElapsedTime())
      }, 1000)
      return () => clearInterval(timer)
    }
  }, [gameState?.started_at, gameState?.ended_at, calculateElapsedTime])

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  // Load lobby and game data
  useEffect(() => {
    let isActive = true

    async function loadData() {
      try {
        // Get current user
        const {
          data: { session },
        } = await supabase.auth.getSession()

        if (!session) {
          setError("You must be logged in to access this game")
          router.push("/")
          return
        }

        if (isActive) setCurrentUser(session.user)

        // Fetch lobby data with better error handling
        const { data: lobbyData, error: lobbyError } = await supabase
          .from("lobbies")
          .select("*")
          .eq("id", params.id)
          .single()

        if (lobbyError) {
          if (lobbyError.code === "PGRST116") {
            throw new Error("Game session not found. It may have expired or been deleted.")
          }
          throw lobbyError
        }

        if (!lobbyData) {
          throw new Error("Unable to load game session. Please try again.")
        }

        if (isActive) setLobby(lobbyData)

        // Enhanced game data fetching
        if (lobbyData?.game_id) {
          const { data: gameData, error: gameError } = await supabase
            .from("games")
            .select("*")
            .eq("id", lobbyData.game_id)
            .single()

          if (gameError) {
            if (gameError.code === "PGRST116") {
              throw new Error("The requested game type no longer exists.")
            }
            throw gameError
          }

          if (!gameData) {
            throw new Error("Game configuration not found. Please try a different game.")
          }

          if (isActive) setGame(gameData)
        } else {
          throw new Error("Invalid game configuration. Please create a new game.")
        }

        // Enhanced game state fetching
        const { data: gameStateData, error: gameStateError } = await supabase
          .from("game_states")
          .select("*")
          .eq("lobby_id", params.id)
          .single()

        if (gameStateError) {
          if (gameStateError.code === "PGRST116") {
            throw new Error("Game progress not found. The session may have expired.")
          }
          throw gameStateError
        }

        if (!gameStateData) {
          throw new Error("Unable to load game progress. Please return to the lobby.")
        }

        if (isActive) setGameState(gameStateData)
      } catch (err: unknown) {
        console.error("Error loading game:", err)
        const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred"
        if (isActive) setError(errorMessage)
      } finally {
        if (isActive) setLoading(false)
      }
    }

    loadData()

    return () => {
      isActive = false
    }
  }, [params.id, router, supabase])

  // Handle AI moves for Tic Tac Toe
  async function handleAIMove(row: number, col: number) {
    if (!gameState || !currentUser) return

    try {
      // Make the move using a server function
      const { error } = await supabase.rpc("make_ai_tic_tac_toe_move", {
        game_state_id: gameState.id,
        row_index: row,
        col_index: col,
      })

      if (error) {
        console.error("Error making AI move:", error)
      }
    } catch (err) {
      console.error("Error in handleAIMove:", err)
    }
  }

  // Render loading state
  if (loading) {
    return <GameLoading />
  }

  // Render error state with enhanced UI
  if (error || !lobby || !game || !gameState) {
    return (
      <div className="bg-gradient-to-b from-white to-gray-50 min-h-screen font-[family-name:var(--font-geist-sans)]">
        <header className="max-w-4xl mx-auto p-8">
          <div className="flex justify-between items-center">
            <Link href="/explore" className="flex items-center text-black hover:text-gray-600 transition-colors duration-200 text-sm sm:text-base">
              <FaArrowLeft className="mr-2" />
              <span>Back to Games</span>
            </Link>
            <div className="flex items-center">
              <h1 className="text-xl sm:text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600">CSGames</h1>
              <span className="text-black text-xl sm:text-2xl">.dev</span>
            </div>
          </div>
        </header>

        <main className="max-w-4xl mx-auto p-8">
          <div className="text-center animate-fadeIn">
            <div className="mb-8 relative">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-100 to-purple-100 rounded-full blur-xl opacity-70"></div>
              <svg
                className="mx-auto h-24 w-24 text-gray-400 relative transform transition-transform hover:scale-110 duration-300"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h2 className="text-4xl font-bold text-gray-900 mb-4 tracking-tight">Game Not Found</h2>
            <p className="text-gray-600 mb-8 max-w-md mx-auto text-lg">
              {error || "We couldn't find the lobby you're looking for. It may have expired or been deleted."}
            </p>

            <div className="space-y-6">
              <div className="bg-white shadow-lg rounded-2xl p-8 max-w-md mx-auto transform hover:scale-[1.02] transition-all duration-300">
                <h3 className="text-xl font-semibold mb-6 text-gray-900">What you can do:</h3>
                <ul className="text-left space-y-4">
                  <li className="flex items-center p-2 hover:bg-gray-50 rounded-lg transition-colors duration-200">
                    <div className="rounded-full bg-green-100 p-2 mr-4">
                      <svg
                        className="h-5 w-5 text-green-600"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    </div>
                    <span className="text-gray-700">Check if you entered the correct game ID</span>
                  </li>
                  <li className="flex items-center p-2 hover:bg-gray-50 rounded-lg transition-colors duration-200">
                    <div className="rounded-full bg-green-100 p-2 mr-4">
                      <svg
                        className="h-5 w-5 text-green-600"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    </div>
                    <span className="text-gray-700">Create a new game lobby</span>
                  </li>
                </ul>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center max-w-md mx-auto">
                <Link
                  href="/explore"
                  className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-3 rounded-xl flex items-center justify-center hover:opacity-90 transition-all duration-300 shadow-md hover:shadow-xl"
                >
                  <FaGamepad className="mr-2" />
                  Browse Games
                </Link>
                <Link
                  href="/"
                  className="w-full sm:w-auto bg-white text-gray-900 px-8 py-3 rounded-xl flex items-center justify-center hover:bg-gray-50 transition-all duration-300 shadow-md border border-gray-200"
                >
                  <FaArrowLeft className="mr-2" />
                  Return Home
                </Link>
              </div>
            </div>
          </div>
        </main>
      </div>
    )
  }

  // Render the appropriate game based on game.title and whether it's an AI opp
  return (
    <div className="relative">
      <div className="absolute top-4 right-4 bg-black text-white px-3 py-1 rounded-lg font-mono z-10">
        Time: {formatTime(elapsedTime)}
      </div>
      {game.title === "Balloon Game" && <BalloonGame lobbyId={lobby.id} currentUser={currentUser} />}

      {game.title === "Connect Four" && <ConnectFourGame lobbyId={lobby.id} currentUser={currentUser} />}

      {game.title === "Tic Tac Toe" && (
        <>
          <TicTacToeGame lobbyId={lobby.id} currentUser={currentUser} />
          {gameState.ai_opponent && (
            <TicTacToeAIOpponent
              gameState={gameState as unknown as TicTacToeGameState}
              currentUser={currentUser}
              onMove={handleAIMove}
            />
          )}
        </>
      )}

      {game.title === "Minesweeper" && <MinesweeperGame lobbyId={lobby.id} currentUser={currentUser} />}
      {game.title === "Battleship" && <BattleshipGame lobbyId={lobby.id} currentUser={currentUser} />}
      {game.title === "Sliding Puzzle" && <SlidingPuzzle lobbyId={lobby.id} currentUser={currentUser} />}
      {game.title === "Corruptle" && <WordleGame />}
    </div>
  )
}
