"use client"

import Link from "next/link"
import { useState } from "react"
import { FaArrowLeft, FaPlus } from "react-icons/fa"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"

const supabase = createClientComponentClient()

// Currently we're just using demo games, because we don't have any actual functioning games implemented yet (keep in mind the "yet", they are being worked on as we speak)
const currentGames = [
  {
    id: 1,
    title: "Chess",
    description: "Classic strategy board game for two players.",
    image: "/placeholder.svg?height=200&width=300",
    players: "2 players",
  },
  {
    id: 2,
    title: "Tic Tac Toe",
    description: "Simple game of X's and O's on a 3x3 grid.",
    image: "/placeholder.svg?height=200&width=300",
    players: "2 players",
  },
  {
    id: 3,
    title: "Connect Four",
    description: "Vertical strategy game where players drop colored discs.",
    image: "/placeholder.svg?height=200&width=300",
    players: "2 players",
  },
  {
    id: 4,
    title: "Battleship",
    description: "Naval combat strategy game with hidden ship placement.",
    image: "/placeholder.svg?height=200&width=300",
    players: "2 players",
  },
]

export default function ExplorePage() {
  const [searchTerm, setSearchTerm] = useState("")

  // Filter the games based on search term
  const filteredGames = currentGames.filter((game) => game.title.toLowerCase().includes(searchTerm.toLowerCase()))

  async function createLobby(gameId: number) {
    const { data: session } = await supabase.auth.getSession()

    if (!session.session) {
      // Redirect to login if user isnt authenticated
      window.location.href = "/"
      return
    }

    const userId = session.session.user.id

    // Create a new lobby within Supabase
    const { data, error } = await supabase
      .from("lobbies")
      .insert([
        {
          game_id: gameId,
          created_by: userId,
          status: "open",
        },
      ])
      .select()

    if (error) {
      console.error("Error creating lobby:", error)
      alert("Failed to create lobby. Please try again.")
    } else if (data) {
      // Redirect the user to the lobby page
      window.location.href = `/lobby/${data[0].id}`
    }
  }

  return (
    <div className="bg-white min-h-screen p-8 font-[family-name:var(--font-geist-sans)]">
      <header className="max-w-6xl mx-auto mb-8">
        <div className="flex justify-between items-center">
          <Link href="/" className="flex items-center text-black">
            <FaArrowLeft className="mr-2" />
            <span>Back to Home</span>
          </Link>
          <div className="flex">
            <h1 className="text-2xl font-bold text-black">CSGames</h1>
            <span className="text-black text-2xl">.dev</span>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-black mb-4">Explore Games</h2>
          <div className="relative">
            <input
              type="text"
              placeholder="Search games..."
              className="text-black placeholder-black w-full p-3 border-2 border-black rounded-lg"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredGames.map((game) => (
            <div key={game.id} className="border-2 border-black rounded-lg overflow-hidden">
              <img src={game.image || "/placeholder.svg"} alt={game.title} className="w-full h-48 object-cover" />
              <div className="p-4">
                <h3 className="text-xl font-bold text-black">{game.title}</h3>
                <p className="text-gray-700 mb-2">{game.description}</p>
                <p className="text-sm text-gray-500 mb-4">{game.players}</p>
                <button
                  onClick={() => createLobby(game.id)}
                  className="w-full flex items-center justify-center bg-black text-white p-2 rounded-lg"
                >
                  <FaPlus className="mr-2" />
                  Create Lobby
                </button>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
