"use client"
import Link from "next/link"
import { FaInfoCircle, FaCompass, FaDiscord, FaGoogle } from "react-icons/fa"
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

  return (
    <div className="bg-gradient-to-b from-white to-gray-50 min-h-screen font-[family-name:var(--font-geist-sans)] relative">
      <motion.button
        onClick={() => setShowAboutModal(true)}
        className="absolute top-4 right-4 p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors shadow-sm"
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

      <div className="grid place-items-center min-h-screen p-8">
        <motion.main
          className="text-center flex flex-col items-center max-w-md w-full"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <motion.div className="flex mb-6" variants={logoVariants}>
            <motion.h1
              className="text-4xl font-bold text-black"
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
            <span className="text-black text-4xl">.dev</span>
          </motion.div>

          <motion.p className="text-gray-600 mb-10" variants={itemVariants}>
            Play classic games online with friends
          </motion.p>

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
                {isLoadingGoogle ? "Loading..." : "Login with Google"}
              </motion.button>
            </motion.div>
          )}
        </motion.main>
      </div>
    </div>
  )
}
