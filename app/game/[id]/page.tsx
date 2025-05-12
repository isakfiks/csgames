"use client"

import { use } from "react"
import { useEffect, useState } from "react"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import type { User } from "@supabase/supabase-js"
import { useRouter } from "next/navigation"
import ConnectFourGame from "@/app/components/games/connect-four-game"
import TicTacToeGame from "@/app/components/games/tic-tac-toe-game"
import GameLoading from "@/app/components/games/game-loading"
import GameError from "@/app/components/games/game-error"

interface Game {
  id: string
  title: string
  [key: string]: unknown
}

interface Lobby {
  id: string
  game_id: string
  [key: string]: unknown
}

export default function GamePage({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = use(paramsPromise)
  const router = useRouter()
  const supabase = createClientComponentClient()

  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [lobby, setLobby] = useState<Lobby | null>(null)
  const [game, setGame] = useState<Game | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
          router.push("/")
          return
        }

        if (isActive) setCurrentUser(session.user)

        // Fetch lobby data
        const { data: lobbyData, error: lobbyError } = await supabase
          .from("lobbies")
          .select("*")
          .eq("id", params.id)
          .single()

        if (lobbyError) throw lobbyError
        if (isActive) setLobby(lobbyData)

        // Fetch game data based on lobby's game_id
        if (lobbyData?.game_id) {
          const { data: gameData, error: gameError } = await supabase
            .from("games")
            .select("*")
            .eq("id", lobbyData.game_id)
            .single()

          if (gameError) throw gameError
          if (isActive) setGame(gameData)
        }
      } catch (err: unknown) {
        console.error("Error loading data:", err)
        if (isActive) setError((err as Error).message || "Failed to load game data")
      } finally {
        if (isActive) setLoading(false)
      }
    }

    loadData()

    return () => {
      isActive = false
    }
  }, [params.id, router, supabase])

  // Render loading state
  if (loading) {
    return <GameLoading />
  }

  // Render error state
  if (error || !lobby || !game) {
    return <GameError error={error || "Game or lobby not found"} />
  }

  // Render the appropriate game based on game.title
  return (
    <>
      {game.title === "Connect Four" && <ConnectFourGame lobbyId={lobby.id} currentUser={currentUser} />}

      {game.title === "Tic Tac Toe" && <TicTacToeGame lobbyId={lobby.id} currentUser={currentUser} />}
    </>
  )
}
