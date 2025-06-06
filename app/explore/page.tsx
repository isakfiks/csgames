"use client"

import Link from "next/link"
import { useState, useEffect } from "react"
import { FaArrowLeft, FaPlus, FaTrophy, FaHandshake, FaLightbulb, FaSearch } from "react-icons/fa"
import { createClientComponentClient, type User } from "@supabase/auth-helpers-nextjs"
import UsernameModal from "@/comps/set-username"
import SuggestionModal from "@/comps/SuggestionModal"
import { motion } from "framer-motion"
import { useRouter } from "next/navigation"

type UserProfile = {
  id: string
  email: string | undefined
  name: string | null
  avatar_url: string | null
  username?: string | null
}

type Lobby = {
  id: string
  gameStateId: string
  gameId: number
  gameTitle: string
  player1: string
  player1Id: string
  player2Id: string | null
  needsPlayer: boolean
  createdAt: string
  singlePlayer?: boolean
}

type ActiveGame = {
  gameStateId: string
  lobbyId: string
  gameTitle: string
  opponent: string | null
  yourTurn: boolean
}

type GameState = {
  id: string
  lobby_id: string
  status: string
  player1: string
  player2: string | null
  current_player: string
  lobbies: {
    id: string
    game_id: number
    games: {
      id: number
      title: string
      singlePlayer: boolean
    }
  }
}

const supabase = createClientComponentClient()

// Currently we're just using demo games, because we don't have any actual functioning games implemented yet (keep in mind the "yet", they are being worked on as we speak)
const currentGames = [
  {
    id: 3,
    title: "Connect Four",
    description: "Vertical strategy game where players drop colored discs.",
    image: "/connect.svg?height=200&width=300",
    players: "2 players",
    singlePlayer: false,
  },
  {
    id: 2,
    title: "Tic Tac Toe",
    description: "Simple game of X's and O's on a 3x3 grid.",
    image: "/tictac.svg?height=200&width=300",
    players: "2 players",
    singlePlayer: false,
  },
  {
    id: 7,
    title: "Balloon Game",
    description: "Take turns pumping a balloon - but don't let it pop!",
    image: "/balloon.svg?height=200&width=300",
    players: "2 players", 
    singlePlayer: false,
  },
  {
    id: 4,
    title: "Battleship",
    description: "Naval combat strategy game with hidden ship placement.",
    image: "/battleship.svg?height=200&width=300",
    players: "2 players",
    singlePlayer: false,
  },
  {
    id: 5,
    title: "Minesweeper",
    description: "Classic puzzle game where you clear a minefield without detonating any mines.",
    image: "/minesweeper.svg?height=200&width=300",
    players: "1 player",
    singlePlayer: true,
  },
  {
    id: 6,
    title: "Sliding Puzzle",
    description: "Classic sliding tile puzzle. Rearrange the tiles to solve the puzzle.",
    image: "/sliding.svg?height=200&width=300",
    players: "1 player",
    singlePlayer: true,
  },
  {
    id: 8,
    title: "Corruptle",
    description: "Guess the daily five-letter word in six tries. Each guess gives you hints!",
    image: "/corrupt.svg?height=200&width=300",
    players: "1 player",
    singlePlayer: true,
  },
]

export default function ExplorePage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [showUsernameModal, setShowUsernameModal] = useState(false)
  const [showSuggestionModal, setShowSuggestionModal] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [activeLobbies, setActiveLobbies] = useState<Lobby[]>([])
  const [activeGames, setActiveGames] = useState<ActiveGame[]>([])
  const [showLobbies, setShowLobbies] = useState(false)
  const [showAllGames, setShowAllGames] = useState(true)
  const [lobbiesToShow, setLobbiesToShow] = useState(3)
  const router = useRouter()

  // Filter games based on search
  const filteredGames = currentGames.filter((game) => game.title.toLowerCase().includes(searchTerm.toLowerCase()))

  useEffect(() => {
    async function runCleanup() {
      try {
        const { error } = await supabase.rpc('run_periodic_lobby_cleanup')
        if (error) {
          console.error('Error running lobby cleanup:', error)
        }
      } catch (err) {
        console.error('Error in cleanup:', err)
      }
    }

    runCleanup()

    const interval = setInterval(runCleanup, 5 * 60 * 1000)

    return () => clearInterval(interval)
  }, [])

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
              email: session.user.email || "",
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
            email: session.user.email || "",
            name: session.user.user_metadata?.full_name || null,
            avatar_url: session.user.user_metadata?.avatar_url || null,
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

  async function fetchActiveLobbiesWithoutRPC() {
    try {
      console.log("Falling back to direct query method...")

      // First, get all games to have their data available
      const { data: allGames, error: gamesError } = await supabase.from("games").select("id, title, singlePlayer")

      if (gamesError) {
        console.error("Error fetching games:", gamesError)
        return
      }

      console.log("All games data:", allGames)

      // Get lobbies with game states that are waiting for more players
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

      // Process lobbies and filter out single-player games
      const processedLobbies: Lobby[] = []

      for (const gs of data) {
        const gameId = gs.lobbies?.[0]?.game_id

        // Find the game in our fetched games data
        const game = allGames.find((g) => Number(g.id) === Number(gameId))

        // Skip this lobby if it's a single-player game
        if (game?.singlePlayer === true) {
          console.log(`Filtering out single-player game: ${game.title} (ID: ${game.id})`)
          continue
        }

        const player1 = playerProfiles.find((p) => p.id === gs.player1)

        processedLobbies.push({
          id: gs.lobby_id,
          gameStateId: gs.id,
          gameId: gameId,
          gameTitle: game?.title || "Unknown Game",
          player1: player1?.username || "Unknown Player",
          player1Id: gs.player1,
          player2Id: gs.player2,
          needsPlayer: !gs.player2,
          createdAt: gs.lobbies?.[0]?.created_at,
          singlePlayer: false, // We've already filtered out single-player games
        })
      }

      console.log("Processed lobbies:", processedLobbies)
      setActiveLobbies(processedLobbies)
    } catch (err) {
      console.error("Error in fetchActiveLobbiesWithoutRPC:", err)
    }
  }

  // Fall back
  async function fetchActiveLobbies() {
    try {
      console.log("Fetching active lobbies with direct query...")

      // Use a direct SQL query to get only multiplayer game lobbies with all the data we need
      const { data, error } = await supabase.rpc("get_active_multiplayer_lobbies")

      if (error) {
        console.error("Error fetching active lobbies:", error)
        // Fall back to the original method
        await fetchActiveLobbiesWithoutRPC()
        return
      }

      console.log("Active lobbies data from RPC:", data)

      if (!data || data.length === 0) {
        setActiveLobbies([])
        return
      }

      //  Had to make a custom one for the rpc
      type RpcLobbyItem = {
        lobby_id: string
        game_state_id: string
        game_id: number
        game_title: string
        player1_username: string | null
        player1_id: string
        player2_id: string | null
        created_at: string
      }

      // Transform the data into our Lobby type
      const lobbies = (data as RpcLobbyItem[]).map((item) => ({
        id: item.lobby_id,
        gameStateId: item.game_state_id,
        gameId: item.game_id,
        gameTitle: item.game_title,
        player1: item.player1_username || "Unknown Player",
        player1Id: item.player1_id,
        player2Id: item.player2_id,
        needsPlayer: !item.player2_id,
        createdAt: item.created_at,
        singlePlayer: false, // We're only getting multiplayer games from the query
      }))

      console.log("Processed lobbies:", lobbies)
      setActiveLobbies(lobbies)
    } catch (err) {
      console.error("Error in fetchActiveLobbies:", err)
      // Fall back to the original method
      await fetchActiveLobbiesWithoutRPC()
    }
  }

  // Handle username setting
  function handleUsernameSet(username: string) {
    // Update the local state with new username
    setUserProfile((prev: UserProfile | null) => {
      if (!prev) return prev
      return {
        ...prev,
        username,
      }
    })
  }

  // Update the createLobby function to handle single-player games
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

    // Find the game to check if it's single-player
    const game = currentGames.find((g) => g.id === gameId)

    try {
      // Use the new function to create a lobby with game state in one go
      const { data, error } = await supabase.rpc("create_lobby_with_game_state", { game_id: gameId })

      if (error) {
        console.error("Error creating lobby:", error)
        alert("Failed to create lobby. Please try again.")
        return
      }

      // For single-player games, go directly to the game page
      if (game?.singlePlayer) {
        window.location.href = `/game/${data}`
      } else {
        // For multiplayer games, go to the lobby page
        window.location.href = `/lobby/${data}`
      }
    } catch (err) {
      console.error("Error creating lobby:", err)
      alert("Failed to create lobby. Please try again.")
    }
  }

  useEffect(() => {
    async function fetchActiveGames() {
      if (!user?.id) return

      const { data, error } = await supabase
        .from("game_states")
        .select(`
          id,
          lobby_id,
          status,
          player1,
          player2,
          current_player,
          lobbies (
            id,
            game_id,
            games (
              id,
              title,
              singlePlayer
            )
          )
        `)
        .or(`player1.eq.${user.id},player2.eq.${user.id}`)
        .in("status", ["active", "waiting"])
        .filter('lobbies.games.singlePlayer', 'eq', false)

      if (error) {
        console.error("Error fetching active games:", error)
        return
      }

      const typedData = data as unknown as GameState[]

      // Get usernames for opponents
      const opponentIds = typedData.map((game) => (game.player1 === user.id ? game.player2 : game.player1)).filter(Boolean)

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, username")
        .in("id", opponentIds)

      // Update the processed games mapping
      const processedGames = typedData.map((game) => ({
        gameStateId: game.id,
        lobbyId: game.lobby_id,
        gameTitle: game.lobbies?.games?.title || "Battleship",
        opponent: profiles?.find(
          (p) => p.id === (game.player1 === user.id ? game.player2 : game.player1)
        )?.username || (!game.player2 ? "Waiting for opponent" : "Unknown Player"),
        yourTurn: game.current_player === user.id,
      }))

      setActiveGames(processedGames)
    }

    if (user) {
      fetchActiveGames()

      // Set up subscription for game state changes
      const gameStateSubscription = supabase
        .channel("game_states_changes")
        .on("postgres_changes", { event: "*", schema: "public", table: "game_states" }, () => fetchActiveGames())
        .subscribe()

      return () => {
        gameStateSubscription.unsubscribe()
      }
    }
  }, [user])
  async function handleGameClick(gameStateId: string) {
    try {
      const { data: gameState, error } = await supabase
        .from("game_states")
        .select(`
          id,
          status,
          lobby_id
        `)
        .eq("id", gameStateId)
        .single()
      
      if (error || !gameState) {
        // Remove expired game from list
        setActiveGames(prev => prev.filter(g => g.gameStateId !== gameStateId))
        alert("This game session has expired or been deleted.")
        return
      }

      // Decide whether to go to /lobby or /game
      if (gameState.status === 'waiting') {
        window.location.href = `/lobby/${gameState.lobby_id}`
      } else {
        window.location.href = `/game/${gameState.id}`
      }
    } catch (err) {
      console.error("Error checking game state:", err)
      alert("Unable to join game. Please try again.")
    }
  }

  if (isLoading) {
    return (
      <motion.div
        className="bg-white min-h-screen p-4 sm:p-6 md:p-8 font-[family-name:var(--font-geist-sans)]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <div className="max-w-6xl mx-auto mb-4 sm:mb-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-0">
            <div className="h-8 w-32 bg-gray-200 rounded animate-pulse"></div>
            <div className="h-8 w-40 bg-gray-200 rounded animate-pulse"></div>
            <div className="flex space-x-2">
              <div className="h-10 w-10 bg-gray-200 rounded-full animate-pulse"></div>
              <div className="h-10 w-10 bg-gray-200 rounded-full animate-pulse"></div>
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto">
          <div className="mb-6 sm:mb-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-2 sm:gap-0">
              <div className="h-10 w-48 bg-gray-200 rounded animate-pulse"></div>
              <div className="h-6 w-24 bg-gray-200 rounded animate-pulse"></div>
            </div>
            <div className="h-12 w-full bg-gray-200 rounded-lg animate-pulse"></div>
          </div>

          {/* Skeleton for games grid */}
          <div className="mb-6 sm:mb-8">
            <div className="h-8 w-40 bg-gray-200 rounded mb-4 animate-pulse"></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="border-2 border-gray-200 rounded-lg overflow-hidden">
                  <div className="h-48 bg-gray-200 animate-pulse"></div>
                  <div className="p-4">
                    <div className="h-6 w-3/4 bg-gray-200 rounded mb-2 animate-pulse"></div>
                    <div className="h-4 w-full bg-gray-200 rounded mb-2 animate-pulse"></div>
                    <div className="h-4 w-1/2 bg-gray-200 rounded mb-4 animate-pulse"></div>
                    <div className="h-10 w-full bg-gray-200 rounded animate-pulse"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      className="bg-white min-h-screen p-4 sm:p-6 md:p-8 font-[family-name:var(--font-geist-sans)]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Username Modal */}
      <UsernameModal
        isOpen={showUsernameModal}
        onClose={() => setShowUsernameModal(false)}
        initialUsername={userProfile?.username || ""}
        isFirstTime={!userProfile?.username}
        onUsernameSet={handleUsernameSet}
      />

      <SuggestionModal
        isOpen={showSuggestionModal}
        onClose={() => setShowSuggestionModal(false)}
        username={userProfile?.username}
        userId={user?.id}
      />

      <motion.header
        className="max-w-6xl mx-auto mb-6 sm:mb-8"
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
      >
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-0">
          <Link href="/" className="flex items-center text-black">
            <motion.div className="flex" whileHover={{ x: -3 }} whileTap={{ scale: 0.95 }}>
              <FaArrowLeft className="mr-2" />
              <span>Back to Home</span>
            </motion.div>
          </Link>
          <motion.div
            className="flex order-first sm:order-none mb-2 sm:mb-0"
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
          >
            <form 
              onSubmit={(e) => {
                e.preventDefault()
                const searchInput = e.currentTarget.querySelector('input')
                if (searchInput && searchInput.value.trim()) {
                  router.push(`/search?q=${encodeURIComponent(searchInput.value.trim())}`)
                }
              }}
              className="relative flex items-center"
            >
              <input
                type="text"
                placeholder="Search users..."
                className="text-black placeholder-gray-400 w-48 px-4 py-2 pr-10 text-sm rounded-lg border-2 border-black focus:outline-none focus:ring-2 focus:ring-black"
                aria-label="Search users"
              />
              <button
                type="submit"
                className="absolute right-3 text-gray-500 hover:text-black"
                aria-label="Search"
                title="Search"
              >
                <FaSearch size={16} />
              </button>
            </form>
            <h1 className="text-2xl font-bold text-black ml-4">CSGames</h1>
            <span className="text-black text-2xl">.dev</span>
          </motion.div>
          <div className="flex space-x-2">
            <Link href="/join">
              <motion.div
                className="flex items-center justify-center w-10 h-10 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-full"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                title="Join Game"
              >
                <FaHandshake />
              </motion.div>
            </Link>
            <Link href="/leaderboard">
              <motion.div
                className="flex items-center justify-center w-10 h-10 bg-black text-white rounded-full"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                title="Leaderboard"
              >
                <FaTrophy />
              </motion.div>
            </Link>
          </div>
        </div>
      </motion.header>

      <motion.div
        className="max-w-6xl mx-auto mb-10"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div className="flex flex-col gap-4">
          <button
            onClick={() => setShowSuggestionModal(true)}
            className="text-black w-full bg-gradient-to-r from-purple-100 to-indigo-100 border-2 border-black p-4 rounded-lg flex items-center justify-center gap-2 hover:from-purple-200 hover:to-indigo-200 transition-all"
          >
            <FaLightbulb className="text-yellow-500" />
            <span>Have a game idea or suggestion? Share it with us!</span>
          </button>

          {activeGames.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {activeGames.map((game) => (
                <Link
                  key={game.gameStateId}
                  href="#"
                  onClick={(e) => {
                    e.preventDefault()
                    handleGameClick(game.gameStateId)
                  }}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 transition-all ${
                    game.yourTurn
                      ? "border-green-500 bg-green-50 hover:bg-green-100"
                      : "border-blue-500 bg-blue-50 hover:bg-blue-100"
                  }`}
                >
                  <span className="text-black font-medium">{game.gameTitle}</span>
                  {game.yourTurn && (
                    <span className="text-xs px-2 py-1 bg-green-600 text-white rounded-full">
                      Your Turn!
                    </span>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>
      </motion.div>

      <motion.main
        className="text-black max-w-6xl mx-auto"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        <motion.div
          className="mb-10 sm:mb-12"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
        >
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-2 sm:gap-0">
            <h2 className="text-2xl sm:text-3xl font-bold text-black">Explore Games</h2>
            {userProfile?.username && (
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Link href="/settings" className="text-blue-600 hover:underline">
                  Settings
                </Link>
              </motion.div>
            )}
          </div>
          <motion.div
            className="relative"
            initial={{ width: "90%" }}
            animate={{ width: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
          >
            <motion.input
              type="text"
              placeholder="Search games..."
              className="w-full p-2 sm:p-3 border-2 border-black rounded-lg text-base sm:text-lg"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              whileFocus={{ boxShadow: "0 0 0 3px rgba(0, 0, 0, 0.1)" }}
              transition={{ duration: 0.2 }}
            />
          </motion.div>
        </motion.div>

        {/* Collapsible Active Lobbies section */}
        {activeLobbies.length > 0 && (
          <motion.div
            className="mb-12"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
          >
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <h3 className="text-xl sm:text-2xl font-bold text-black">Active Lobbies</h3>
              <button
                className="text-sm px-3 py-1 border border-black rounded hover:bg-gray-100 transition"
                onClick={() => setShowLobbies((v) => !v)}
              >
                {showLobbies ? "Hide" : "Show"}
              </button>
            </div>
            {showLobbies && (
              <motion.div
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ staggerChildren: 0.1 }}
              >
                {activeLobbies.slice(0, lobbiesToShow).map((lobby, index) => (
                  <motion.div
                    key={lobby.id}
                    className="border-2 border-black rounded-lg overflow-hidden"
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{
                      delay: index * 0.05,
                      type: "spring",
                      damping: 20,
                      stiffness: 200,
                    }}
                    whileHover={{
                      y: -5,
                      boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
                    }}
                  >
                    <div className="bg-gray-100 p-3 border-b-2 border-black">
                      <h4 className="font-bold">{lobby.gameTitle}</h4>
                    </div>
                    <div className="p-4">
                      <p className="text-gray-700 mb-2">Created by: {lobby.player1}</p>
                      <p className="text-sm text-gray-500 mb-4">
                        {lobby.needsPlayer ? "Waiting for opponent" : "Ready to start"}
                      </p>
                      <Link href={`/lobby/${lobby.id}`}>
                        <motion.button
                          className="w-full flex items-center justify-center bg-black text-white p-2 rounded-lg"
                          whileHover={{ scale: 1.02, backgroundColor: "#1f2937" }}
                          whileTap={{ scale: 0.98 }}
                          transition={{ type: "spring", stiffness: 400, damping: 17 }}
                        >
                          {lobby.needsPlayer ? "Join Game" : "View Lobby"}
                        </motion.button>
                      </Link>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            )}
            {showLobbies && activeLobbies.length > lobbiesToShow && (
              <div className="flex justify-center mt-4">
                <button
                  className="px-4 py-2 border border-black rounded hover:bg-gray-100 transition"
                  onClick={() => setLobbiesToShow((n) => n + 3)}
                >
                  Show More
                </button>
              </div>
            )}
          </motion.div>
        )}

        {/* Collapsible All Games section */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <h3 className="text-xl sm:text-2xl font-bold text-black">All Games</h3>
            <button
              className="text-sm px-3 py-1 border border-black rounded hover:bg-gray-100 transition"
              onClick={() => setShowAllGames((v) => !v)}
            >
              {showAllGames ? "Hide" : "Show"}
            </button>
          </div>
          {showAllGames && (
            <motion.div
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ staggerChildren: 0.1 }}
            >
              {filteredGames.map((game, index) => (
                <motion.div
                  key={game.id}
                  className="border-2 border-black rounded-lg overflow-hidden flex flex-col"
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{
                    delay: index * 0.05,
                    type: "spring",
                    damping: 20,
                    stiffness: 200,
                  }}
                  whileHover={{
                    y: -5,
                    boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
                  }}
                >
                  <div className="relative w-full pt-[56.25%]">
                    <img
                      src={game.image || "/placeholder.svg"}
                      alt={game.title}
                      className="absolute top-0 left-0 w-full h-full object-cover"
                    />
                  </div>
                  <div className="p-3 sm:p-4 flex-grow flex flex-col">
                    <h3 className="text-lg sm:text-xl font-bold text-black">{game.title}</h3>
                    <p className="text-sm sm:text-base text-gray-700 mb-2 min-h-[40px]">{game.description}</p>
                    <p className="text-xs sm:text-sm text-gray-500 mb-3 sm:mb-4">{game.players}</p>
                    <div className="mt-auto">
                      <motion.button
                        onClick={() => createLobby(game.id)}
                        className="w-full flex items-center justify-center bg-black text-white p-2 rounded-lg text-sm sm:text-base"
                        whileHover={{ scale: 1.02, backgroundColor: "#1f2937" }}
                        whileTap={{ scale: 0.98 }}
                        transition={{ type: "spring", stiffness: 400, damping: 17 }}
                      >
                        <FaPlus className="mr-2" />
                        Create Lobby
                      </motion.button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}
        </div>
      </motion.main>
    </motion.div>
  )
}
