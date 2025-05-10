"use client"
import Link from "next/link"
import { FaInfoCircle, FaCompass, FaDiscord, FaGoogle } from "react-icons/fa"
import { useState, useEffect } from "react"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"

const supabase = createClientComponentClient()

export default function Home() {
  const [isLoading, setIsLoading] = useState(false)
  const [user, setUser] = useState(null)
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

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      })

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

  return (
    <div className="bg-white min-h-screen font-[family-name:var(--font-geist-sans)] relative">
      <button
        onClick={() => setShowAboutModal(true)}
        className="absolute top-4 right-4 p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
        aria-label="About"
      >
        <FaInfoCircle className="text-black text-xl" />
      </button>

      {showAboutModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="text-black bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-black text-xl font-bold">About CSGames.dev</h2>
              <button onClick={() => setShowAboutModal(false)} className="text-gray-500 hover:text-gray-700">
                X
              </button>
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
            <button onClick={() => setShowAboutModal(false)} className="w-full bg-black text-white py-2 rounded-lg">
              Close
            </button>
          </div>
        </div>
      )}

      <div className="grid place-items-center min-h-screen p-8">
        <main className="text-center flex flex-col items-center max-w-md w-full">
          <div className="flex mb-6">
            <h1 className="text-4xl font-bold text-black">CSGames</h1>
            <span className="text-black text-4xl">.dev</span>
          </div>

          <p className="text-gray-600 mb-10">Play classic games online with friends</p>

          {user ? (
            <div className="w-full space-y-4">
              <Link href="/explore" className="w-full">
                <button className="w-full flex items-center justify-center bg-black text-white p-3 rounded-lg hover:bg-gray-800 transition-colors">
                  <FaCompass className="mr-2" />
                  Explore Games
                </button>
              </Link>

              <button
                onClick={signOut}
                disabled={isLoading}
                className="w-full border-2 border-gray-300 text-gray-700 p-3 rounded-lg hover:bg-gray-100 transition-colors"
              >
                {isLoading ? "Loading..." : "Sign Out"}
              </button>
            </div>
          ) : (
            <div className="w-full space-y-4">
              <button
                onClick={signInWithDiscord}
                disabled={isLoading}
                className="w-full flex items-center justify-center border-[#7289da] bg-[#7289da] text-white p-3 rounded-lg hover:bg-[#6a7fc9] transition-colors"
              >
                <FaDiscord className="mr-2" />
                {isLoading ? "Loading..." : "Login with Discord"}
              </button>

              <button
                onClick={signInWithGoogle}
                disabled={isLoading}
                className="w-full flex items-center justify-center border-2 border-gray-300 p-3 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <FaGoogle className="mr-2 text-[#4285F4]" />
                <span className="text-black">Login with Google</span>
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
