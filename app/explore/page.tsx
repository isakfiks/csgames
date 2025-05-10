"use client"

import Link from "next/link"
import { useState } from "react"
import { FaArrowLeft, FaPlus } from "react-icons/fa"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import UsernameModal from "@/comps/set-username"
import { useEffect } from "react"

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
  const [showUsernameModal, setShowUsernameModal] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [userProfile, setUserProfile] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)

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

        const { error: tableCheckError } = await supabase.from("profiles").select("count").limit(1)

        if (tableCheckError) {
          console.error("Error checking profiles table:", tableCheckError)
          if (tableCheckError.code === "PGRST116") {
            // Create if table doesnt exist
            await createProfilesTable(session.user.id)
          }
        }

        // Check if user has profile (w/username)
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", session.user.id)
          .maybeSingle()

        if (profileError && profileError.code !== "PGRST116") {
          console.error("Error fetching profile:", profileError)
        }

        // If no profile exists, make one
        if (!profile) {
          console.log("No profile found, creating one...")
          await createUserProfile(session.user)

          // Show username component for new users
          setShowUsernameModal(true)
          setUserProfile(null)
        } else {
          setUserProfile(profile)

          // Show username component if user doesn't have a linked username
          if (!profile.username) {
            setShowUsernameModal(true)
          }
        }
      } catch (err) {
        console.error("Error checking user:", err)
      } finally {
        setIsLoading(false)
      }
    }

    checkUserAndUsername()
  }, [])

  // Function to create profiles table if it doesn't exist
  async function createProfilesTable(userId: string) {
    try {
      // Create the profiles table
      const { error: createTableError } = await supabase.rpc("create_profiles_table")

      if (createTableError) {
        console.error("Error creating profiles table:", createTableError)
        return false
      }

      return true
    } catch (err) {
      console.error("Error in createProfilesTable funct:", err)
      return false
    }
  }

  // Function to create user profile
  async function createUserProfile(user: any) {
    try {
      const { error } = await supabase.from("profiles").insert([
        {
          id: user.id,
          email: user.email,
          name: user.user_metadata?.full_name || null,
          avatar_url: user.user_metadata?.avatar_url || null,
        },
      ])

      if (error) {
        console.error("Error creating user profile:", error)
        return false
      }

      return true
    } catch (err) {
      console.error("Error in createUserProfile:", err)
      return false
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

    // Check if user has username
    if (!userProfile?.username) {
      setShowUsernameModal(true)
      return
    }

    // Create a new lobby within Supabase 
    const { data, error } = await supabase
      .from("lobbies")
      .insert([
        {
          game_id: gameId,
          created_by: user.id,
          status: "open",
        },
      ])
      .select()

    if (error) {
      console.error("Error creating lobby:", error)
      alert("Failed to create lobby. Please try again.")
    } else if (data) {
      // Redirect to lobby page
      window.location.href = `/lobby/${data[0].id}` 
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

      <main className="max-w-6xl mx-auto">
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
              className="text-black w-full p-3 border-2 border-black rounded-lg"
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
