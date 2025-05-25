"use client"
import Link from "next/link"
import { FaInfoCircle, FaCompass, FaDiscord, FaGoogle, FaGamepad, FaHandshake } from "react-icons/fa"
import { useState, useEffect } from "react"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import type { User } from "@supabase/auth-helpers-nextjs"
import { motion, AnimatePresence } from "framer-motion"

const supabase = createClientComponentClient()

export default function Home() {
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingDiscord, setIsLoadingDiscord] = useState(false)
  const [isLoadingGoogle, setIsLoadingGoogle] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [showAboutModal, setShowAboutModal] = useState(false)

  // Check if user is logged in
  useEffect(() => {
    const checkUser = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      setUser(session?.user || null)

      // Listen for changes
      const {
        data: { subscription },
      } = await supabase.auth.onAuthStateChange((_event, session) => {
        setUser(session?.user || null)
      })

      return () => subscription.unsubscribe()
    }

    checkUser()
  }, [])

  async function signInWithDiscord() {
    try {
      setIsLoading(true)
      setIsLoadingDiscord(true)

      // Use the api
      const response = await fetch("/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ provider: "discord" }),
      })

      const data = await response.json()

      if (data.error) {
        throw new Error(data.error)
      }

      // Redirect to the oauth
      window.location.href = data.url
    } catch (error) {
      console.error("Login error:", error)
      alert("Failed to login with Discord. Please try again.")
    } finally { 
      setIsLoading(false)
    }
  }

  async function signInWithGoogle() {
    try {
      setIsLoading(true)
      setIsLoadingGoogle(true)

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      console.log(data)
      console.log(error)
      if (error) throw error

      // Redirect happens automatically
    } catch (error) {
      console.error("Login error:", error)
      alert("Failed to login with Google. Please try again.")
      setIsLoading(false)
    }
  }

  async function signOut() {
    try {
      setIsLoading(true)
      await supabase.auth.signOut()
    } catch (error) {
      console.error("Sign out error:", error)
    } finally {
      setIsLoading(false)
    }
  }

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2,
      },
    },
  }

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        type: "spring",
        stiffness: 100,
        damping: 12,
      },
    },
  }

  const buttonVariants = {
    rest: { scale: 1 },
    hover: {
      scale: 1.03,
      transition: {
        type: "spring",
        stiffness: 400,
        damping: 10,
      },
    },
    tap: { scale: 0.97 },
  }

  const logoVariants = {
    hidden: { opacity: 0, y: -20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        type: "spring",
        stiffness: 200,
        damping: 20,
        delay: 0.1,
      },
    },
  }

  const gameIcons = [
    { icon: "♟️", x: "10%", y: "15%", size: "2rem", rotation: -15, delay: 0 },
    { icon: "🎮", x: "85%", y: "20%", size: "2.5rem", rotation: 10, delay: 0.2 },
    { icon: "🎲", x: "75%", y: "75%", size: "2rem", rotation: -5, delay: 0.4 },
    { icon: "🎯", x: "15%", y: "80%", size: "2.2rem", rotation: 15, delay: 0.6 },
    { icon: "🎪", x: "50%", y: "10%", size: "2.3rem", rotation: 0, delay: 0.8 },
    { icon: "🎨", x: "20%", y: "40%", size: "1.8rem", rotation: -10, delay: 1 },
    { icon: "🏆", x: "80%", y: "50%", size: "2rem", rotation: 5, delay: 1.2 },
  ]

  return (
    <div className="min-h-screen font-[family-name:var(--font-geist-sans)] relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-white via-gray-50 to-gray-100 z-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(0,0,0,0.02)_0%,transparent_50%)] animate-pulse"></div>
      </div>

      {gameIcons.map((icon, index) => (
        <motion.div
          key={index}
          className="absolute text-gray-300 opacity-30 pointer-events-none z-0"
          style={{
            left: icon.x,
            top: icon.y,
            fontSize: icon.size,
          }}
          initial={{ opacity: 0, rotate: icon.rotation }}
          animate={{
            opacity: [0.2, 0.3, 0.2],
            y: [0, -10, 0],
            rotate: icon.rotation,
          }}
          transition={{
            delay: icon.delay,
            duration: 5,
            repeat: Number.POSITIVE_INFINITY,
            repeatType: "reverse",
          }}
        >
          {icon.icon}
        </motion.div>
      ))}

      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAwIDEwIEwgNDAgMTAgTSAxMCAwIEwgMTAgNDAgTSAwIDIwIEwgNDAgMjAgTSAyMCAwIEwgMjAgNDAgTSAwIDMwIEwgNDAgMzAgTSAzMCAwIEwgMzAgNDAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iI2UwZTBlMCIgb3BhY2l0eT0iMC4yIiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-30 z-0"></div>

      <motion.button
        onClick={() => setShowAboutModal(true)}
        className="absolute top-4 right-4 p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors shadow-sm z-10"
        aria-label="About"
        whileHover={{ scale: 1.1, rotate: 5 }}
        whileTap={{ scale: 0.95 }}
      >
        <FaInfoCircle className="text-black text-xl" />
      </motion.button>

      <AnimatePresence>
        {showAboutModal && (
          <motion.div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowAboutModal(false)}
          >
            <motion.div
              className="text-black bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl"
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-black text-xl font-bold">About CSGames.dev</h2>
                <motion.button
                  onClick={() => setShowAboutModal(false)}
                  className="text-gray-500 hover:text-gray-700"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  X
                </motion.button>
              </div>
              <div className="mb-4">
                <p className="mb-2">CSGames.dev is a platform for playing classic games online with friends.</p>
                <p>Developed by:</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  <Link href="https://github.com/isakfiks" className="text-blue-600 hover:underline">
                    isakfiks
                  </Link>
                  ,
                  <Link href="https://github.com/nopedal" className="text-blue-600 hover:underline">
                    nopedal
                  </Link>
                  ,
                  <Link href="https://github.com/NightStealPea" className="text-blue-600 hover:underline">
                    nightstealpea
                  </Link>
                </div>
              </div>
              <motion.button
                onClick={() => setShowAboutModal(false)}
                className="w-full bg-black text-white py-2 rounded-lg"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                Close
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid place-items-center min-h-screen p-8 relative z-10">
        <motion.main
          className="text-center flex flex-col items-center max-w-md w-full"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <motion.div className="relative mb-6" variants={logoVariants}>
            <motion.div
              className="absolute -inset-4 rounded-full bg-gradient-to-r from-purple-100 via-blue-100 to-green-100 opacity-70 blur-lg"
              animate={{
                rotate: [0, 360],
                scale: [0.9, 1.1, 0.9],
              }}
              transition={{
                duration: 15,
                repeat: Number.POSITIVE_INFINITY,
                repeatType: "loop",
              }}
            />
            <motion.div className="relative flex items-center">
              <motion.h1
                className="text-5xl font-bold text-black"
                animate={{
                  scale: [1, 1.02, 1],
                  transition: {
                    repeat: Number.POSITIVE_INFINITY,
                    repeatType: "reverse",
                    duration: 2,
                  },
                }}
              >
                CSGames
              </motion.h1>
              <span className="text-black text-5xl">.dev</span>
              <motion.div
                className="absolute -top-2 -right-6 text-yellow-500"
                animate={{
                  rotate: [0, 10, 0],
                  y: [0, -3, 0],
                }}
                transition={{
                  duration: 2,
                  repeat: Number.POSITIVE_INFINITY,
                  repeatType: "reverse",
                }}
              >
                <FaGamepad size={20} />
              </motion.div>
            </motion.div>
          </motion.div>

          <motion.p className="text-gray-600 mb-6 text-lg" variants={itemVariants}>
            Play classic games online with friends
          </motion.p>

          <motion.div className="flex justify-center gap-4 mb-10" variants={itemVariants}>
            {["♟️", "🎮", "🎲", "🎯", "🎪"].map((icon, index) => (
              <motion.span
                key={index}
                className="text-2xl"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  delay: index * 0.1,
                  type: "spring",
                  stiffness: 100,
                }}
                whileHover={{
                  scale: 1.2,
                  rotate: [0, 10, -10, 0],
                  transition: { duration: 0.5 },
                }}
              >
                {icon}
              </motion.span>
            ))}
          </motion.div>

          {user ? (
            <motion.div className="w-full space-y-4" variants={containerVariants}>
              <motion.div variants={itemVariants}>
                <Link href="/explore" className="w-full block">
                  <motion.button
                    className="w-full flex items-center justify-center bg-black text-white p-3 rounded-lg hover:bg-gray-800 transition-colors shadow-sm"
                    variants={buttonVariants}
                    whileHover="hover"
                    whileTap="tap"
                  >
                    <FaCompass className="mr-2" />
                    Explore Games
                  </motion.button>
                </Link>
              </motion.div>

              <motion.div variants={itemVariants}>
                <Link href="/join" className="w-full block">
                  <motion.button
                    className="w-full flex items-center justify-center bg-gradient-to-r from-indigo-500 to-purple-500 text-white p-3 rounded-lg shadow-sm"
                    variants={buttonVariants}
                    whileHover="hover"
                    whileTap="tap"
                    transition={{ type: "spring", stiffness: 300, damping: 15 }}
                  >
                    <FaHandshake className="mr-2" />
                    Join a Game
                  </motion.button>
                </Link>
              </motion.div>

              <motion.button
                onClick={signOut}
                disabled={isLoading}
                className="w-full border-2 border-gray-300 text-gray-700 p-3 rounded-lg hover:bg-gray-100 transition-colors shadow-sm"
                variants={buttonVariants}
                whileHover="hover"
                whileTap="tap"
              >
                {isLoading ? "Loading..." : "Sign Out"}
              </motion.button>
            </motion.div>
          ) : (
            <motion.div className="w-full space-y-4" variants={containerVariants}>
              <motion.div variants={itemVariants}>
                <Link href="/join" className="w-full block">
                  <motion.button
                    className="w-full flex items-center justify-center bg-gradient-to-r from-indigo-500 to-purple-500 text-white p-3 rounded-lg shadow-sm mb-4"
                    variants={buttonVariants}
                    whileHover="hover"
                    whileTap="tap"
                    transition={{ type: "spring", stiffness: 300, damping: 15 }}
                  >
                    <FaHandshake className="mr-2" />
                    Join a Game
                  </motion.button>
                </Link>
              </motion.div>

              <motion.button
                onClick={signInWithDiscord}
                disabled={isLoading}
                className="w-full flex items-center justify-center border-[#7289da] bg-[#7289da] text-white p-3 rounded-lg hover:bg-[#6a7fc9] transition-colors shadow-sm"
                variants={buttonVariants}
                whileHover="hover"
                whileTap="tap"
              >
                <FaDiscord className="mr-2" />
                {isLoadingDiscord ? "Loading..." : "Login with Discord"}
              </motion.button>

              <motion.button
                onClick={signInWithGoogle}
                disabled={isLoading}
                className="w-full flex items-center justify-center border-2 border-gray-300 p-3 rounded-lg hover:bg-gray-100 transition-colors shadow-sm"
                variants={buttonVariants}
                whileHover="hover"
                whileTap="tap"
              >
                <FaGoogle className="mr-2 text-[#4285F4]" />
                <span className="text-[#4285F4] ">{isLoadingGoogle ? "Loading..." : "Login with Google"}</span>
              </motion.button>
            </motion.div>
          )}

          <motion.div className="mt-10 text-xs text-gray-400" variants={itemVariants}>
            <p>Hint: We have singleplayer games too 😉</p>
          </motion.div>
        </motion.main>
      </div>
    </div>
  )
}
