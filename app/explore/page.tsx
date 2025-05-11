"use client"

import Link from "next/link"
import { useState, useEffect } from "react"
import { FaArrowLeft, FaPlus } from "react-icons/fa"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import UsernameModal from "@/comps/set-username"

const supabase = createClientComponentClient()

// Currently we're just using demo games, because we don't have any actual functioning games implemented yet (keep in mind the "yet", they are being worked on as we speak)
const currentGames = [
  {
    id: 3,
    title: "Connect Four",
    description: "Vertical strategy game where players drop colored discs.",
    image: "/placeholder.svg?height=200&width=300",
    players: "2 players",
  },
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
    id: 4,
    title: "Battleship",
    description: "Naval combat strategy game with hidden ship placement.",
    image: "/placeholder.svg?height=200&width=300",
    players: "2 players",
  },
]

export default function ExplorePage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [showUsernameModal, setShowUsernameModal] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [userProfile, setUserProfile] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [activeLobbies, setActiveLobbies] = useState<any[]>([])

  // Filter games based on search
  const filteredGames = currentGames.filter((game) => game.title.toLowerCase().includes(searchTerm.toLowerCase()))

  // Check if user is logged in and if they have a username
  useEffect(() => {
    async function checkUserAndUsername() {
      try {
        setIsLoading(true)

        const {
          data: { session },
        } = await supabase.auth.getSession()

        if (!session) {
          // Redirect to login if no auth is found
          window.location.href = "/"
          return
        }

        setUser(session.user)

        // Check if user has profile (w/username)
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", session.user.id)
          .maybeSingle()

        if (profileError) {
          console.error("Error fetching profile:", profileError)
        }

        // If no profile exists, make one
        if (!profile) {
          console.log("No profile found, creating one...")
          const { error: insertError } = await supabase.from("profiles").insert([
            {
              id: session.user.id,
              email: session.user.email,
              name: session.user.user_metadata?.full_name || null,
              avatar_url: session.user.user_metadata?.avatar_url || null,
            },
          ])

          if (insertError) {
            console.error("Error creating profile:", insertError)
          }

          // Show username component for new users
          setShowUsernameModal(true)
          setUserProfile({
            id: session.user.id,
            email: session.user.email,
            username: null,
          })
        } else {
          setUserProfile(profile)

          if (!profile.username) {
            setShowUsernameModal(true)
          }
        }

        // Fetch all active lobbies
        fetchActiveLobbies()

        // Set up sub for lobby changes
        const lobbySubscription = supabase
          .channel("public:lobbies")
          .on("postgres_changes", { event: "*", schema: "public", table: "lobbies" }, () => {
            fetchActiveLobbies()
          })
          .on("postgres_changes", { event: "*", schema: "public", table: "game_states" }, () => {
            fetchActiveLobbies()
          })
          .subscribe()

        return () => {
          lobbySubscription.unsubscribe()
        }
      } catch (err) {
        console.error("Error checking user:", err)
      } finally {
        setIsLoading(false)
      }
    }

    checkUserAndUsername()
  }, [])

  async function fetchActiveLobbies() {
    try {
      console.log("Fetching active lobbies...")

      // Get lobbies with game states that are waiting for more plrs
      const { data, error } = await supabase
        .from("game_states")
        .select(`
          id,
          lobby_id,
          status,
          player1,
          player2,
          lobbies!inner(
            id,
            game_id,
            created_by,
            created_at
          )
        `)
        .eq("status", "waiting")
        .order("created_at", { ascending: false })
        .limit(10)

      if (error) {
        console.error("Error fetching lobbies:", error)
        return
      }

      console.log("Active lobbies data:", data)

      if (!data || data.length === 0) {
        setActiveLobbies([])
        return
      }

      // Get player info
      const playerIds = data.flatMap((gs) => [gs.player1, gs.player2]).filter(Boolean)

      let playerProfiles: { id: string; username: string | null }[] = []
      if (playerIds.length > 0) {
        const { data: profiles } = await supabase.from("profiles").select("id, username").in("id", playerIds)

        playerProfiles = profiles || []
      }

      // Get game info
      const gameIds = [...new Set(data.map((gs) => gs.lobbies?.[0]?.game_id).filter(Boolean))]

      interface Game {
        id: number;
        title: string;
      }
      let games: Game[] = []
      if (gameIds.length > 0) {
        const { data: gamesData } = await supabase.from("games").select("id, title").in("id", gameIds)

        games = gamesData || []
      }

      // Combine data
      const lobbies = data.map((gs) => {
        const game = games.find((g) => g.id === gs.lobbies?.[0]?.game_id)
        const player1 = playerProfiles.find((p) => p.id === gs.player1)

        return {
          id: gs.lobby_id,
          gameStateId: gs.id,
          gameId: gs.lobbies?.[0]?.game_id,
          gameTitle: game?.title || "Connect Four", // Default to Connect Four if game not found
          player1: player1?.username || "Unknown Player",
          player1Id: gs.player1,
          player2Id: gs.player2,
          needsPlayer: !gs.player2,
          createdAt: gs.lobbies?.[0]?.created_at,
        }
      })

      console.log("Processed lobbies:", lobbies)
      setActiveLobbies(lobbies)
    } catch (err) {
      console.error("Error in fetchActiveLobbies:", err)
    }
  }

  // Handle username setting
  function handleUsernameSet(username: string) {
    // Update the local state with new username
    setUserProfile((prev: any) => ({
      ...prev,
      username,
    }))
  }

  async function createLobby(gameId: number) {
    if (!user) {
      // Redirect to login if the user isnt authed
      window.location.href = "/"
      return
    }

    // Check if user has a username
    if (!userProfile?.username) {
      setShowUsernameModal(true)
      return
    }

    try {
      // Use the new function to create a lobby with game state in one go
      const { data, error } = await supabase.rpc("create_lobby_with_game_state", { game_id: gameId })

      if (error) {
        console.error("Error creating lobby:", error)
        alert("Failed to create lobby. Please try again.")
        return
      }

      // Redirect to the lobby page
      window.location.href = `/lobby/${data}`
    } catch (err) {
      console.error("Error creating lobby:", err)
      alert("Failed to create lobby. Please try again.")
    }
  }

  if (isLoading) {
    return (
      <div className="bg-white min-h-screen p-8 flex items-center justify-center font-[family-name:var(--font-geist-sans)]">
        <p className="text-black">Loading...</p>
      </div>
    )
  }

  return (
    <div className="bg-white min-h-screen p-8 font-[family-name:var(--font-geist-sans)]">
      {/* Username Modal */}
      <UsernameModal
        isOpen={showUsernameModal}
        onClose={() => setShowUsernameModal(false)}
        initialUsername={userProfile?.username || ""}
        isFirstTime={!userProfile?.username}
        onUsernameSet={handleUsernameSet}
      />

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

      <main className="text-black max-w-6xl mx-auto">
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-3xl font-bold text-black">Explore Games</h2>
            {userProfile?.username && (
              <Link href="/settings" className="text-blue-600 hover:underline">
                Settings
              </Link>
            )}
          </div>
          <div className="relative">
            <input
              type="text"
              placeholder="Search games..."
              className="w-full p-3 border-2 border-black rounded-lg"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Active lobbies section */}
        {activeLobbies.length > 0 && (
          <div className="mb-12">
            <h3 className="text-2xl font-bold text-black mb-4">Active Lobbies</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {activeLobbies.map((lobby) => (
                <div key={lobby.id} className="border-2 border-black rounded-lg overflow-hidden">
                  <div className="bg-gray-100 p-3 border-b-2 border-black">
                    <h4 className="font-bold">{lobby.gameTitle}</h4>
                  </div>
                  <div className="p-4">
                    <p className="text-gray-700 mb-2">Created by: {lobby.player1}</p>
                    <p className="text-sm text-gray-500 mb-4">
                      {lobby.needsPlayer ? "Waiting for opponent" : "Ready to start"}
                    </p>
                    <Link href={`/lobby/${lobby.id}`}>
                      <button className="w-full flex items-center justify-center bg-black text-white p-2 rounded-lg">
                        {lobby.needsPlayer ? "Join Game" : "View Lobby"}
                      </button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <h3 className="text-2xl font-bold text-black mb-4">All Games</h3>
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
