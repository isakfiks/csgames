"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { FaArrowLeft } from "react-icons/fa"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"

const supabase = createClientComponentClient()

export default function LobbyPage({ params }: { params: { id: string } }) {
  const [lobby, setLobby] = useState<any>(null)
  const [game, setGame] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchLobbyData() {
      try {
        // Fetch lobby (data)
        const { data: lobbyData, error: lobbyError } = await supabase
          .from("lobbies")
          .select("*")
          .eq("id", params.id)
          .single()

        if (lobbyError) throw lobbyError

        // If lobby data is found, fetch the creators info
        let creatorData = null
        if (lobbyData && lobbyData.created_by) {
          const { data: userData, error: userError } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", lobbyData.created_by)
            .single()

          if (!userError) {
            creatorData = userData
          }
        }

        // Add creator data to lobby object
        if (lobbyData && creatorData) {
          lobbyData.creator = creatorData
        }

        setLobby(lobbyData)

        // Fetch game data
        if (lobbyData?.game_id) {
          const { data: gameData, error: gameError } = await supabase
            .from("games")
            .select("*")
            .eq("id", lobbyData.game_id)
            .single()

          if (gameError) throw gameError
          setGame(gameData)
        }
      } catch (err: any) {
        console.error("Error fetching lobby data:", err)
        setError(err.message || "Failed to load lobby data")
      } finally {
        setLoading(false)
      }
    }

    fetchLobbyData()
  }, [params.id])

  if (loading) {
    return (
      <div className="bg-white min-h-screen p-8 flex items-center justify-center font-[family-name:var(--font-geist-sans)]">
        <p className="text-black">Loading lobby...</p>
      </div>
    )
  }

  if (error || !lobby) {
    return (
      <div className="bg-white min-h-screen p-8 flex flex-col items-center justify-center font-[family-name:var(--font-geist-sans)]">
        <p className="text-black mb-4">Error: {error || "Lobby not found"}</p>
        <Link href="/explore" className="text-black underline">
          Return to Explore Games
        </Link>
      </div>
    )
  }

  return (
    <div className="bg-white min-h-screen p-8 font-[family-name:var(--font-geist-sans)]">
      <header className="max-w-4xl mx-auto mb-8">
        <div className="flex justify-between items-center">
          <Link href="/explore" className="flex items-center text-black">
            <FaArrowLeft className="mr-2" />
            <span>Back to Games</span>
          </Link>
          <div className="flex">
            <h1 className="text-2xl font-bold text-black">CSGames</h1>
            <span className="text-black text-2xl">.dev</span>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto">
        <div className="border-2 border-black rounded-lg p-6">
          <h2 className="text-3xl font-bold text-black mb-4">{game?.title || "Game"} Lobby</h2>

          <div className="mb-6">
            <p className="text-black mb-2">
              <strong>Lobby ID:</strong> {params.id}
            </p>
            <p className="text-black mb-2">
              <strong>Status:</strong> {lobby.status || "Open"}
            </p>
            <p className="text-black">
              <strong>Created by:</strong> {lobby.creator?.name || lobby.creator?.email || "Unknown player"}
            </p>
          </div>

          <div className="mb-6">
            <h3 className="text-xl font-bold text-black mb-2">Players</h3>
            {/* Will be replaced with actual player data from Supabase in the near future! */}
            <div className="border border-gray-300 rounded p-4">
              <p className="text-gray-700">Waiting for players to join...</p>
            </div>
          </div>

          <div className="flex justify-end">
            <button className="bg-black text-white px-4 py-2 rounded-lg">Start Game</button>
          </div>
        </div>
      </main>
    </div>
  )
}
