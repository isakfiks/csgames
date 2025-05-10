"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { FaArrowLeft, FaClock } from "react-icons/fa"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import UsernameModal from "@/comps/set-username"

const supabase = createClientComponentClient()

export default function SettingsPage() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showUsernameModal, setShowUsernameModal] = useState(false)
  const [cooldownRemaining, setCooldownRemaining] = useState<string | null>(null)

  useEffect(() => {
    async function loadUserData() {
      try {
        setIsLoading(true)

        // Get current user
        const {
          data: { session },
        } = await supabase.auth.getSession()

        if (!session) {
          // Redirect to login if not authenticated
          window.location.href = "/"
          return
        }

        setUser(session.user)

        // Get user profile
        const { data: profileData, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", session.user.id)
          .single()

        if (error) {
          console.error("Error fetching profile:", error)
          return
        }

        setProfile(profileData)

        // Calculate cooldown if username was recently changed
        if (profileData.username_updated_at) {
          const lastUpdate = new Date(profileData.username_updated_at)
          const cooldownEnd = new Date(lastUpdate.getTime() + 7 * 24 * 60 * 60 * 1000) // 7 days
          const now = new Date()

          if (cooldownEnd > now) {
            const diffTime = Math.abs(cooldownEnd.getTime() - now.getTime())
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
            const diffHours = Math.floor((diffTime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))

            setCooldownRemaining(`${diffDays}d ${diffHours}h`)
          } else {
            setCooldownRemaining(null)
          }
        }
      } catch (err) {
        console.error("Error loading user data:", err)
      } finally {
        setIsLoading(false)
      }
    }

    loadUserData()
  }, [])

  async function handleSignOut() {
    try {
      await supabase.auth.signOut()
      window.location.href = "/"
    } catch (error) {
      console.error("Error signing out:", error)
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
        onClose={() => { 
          setShowUsernameModal(false)
          // Refresh profile data after modal closes 
          window.location.reload() 
        }}
        initialUsername={profile?.username || ""}
        isFirstTime={false}
      />

      <div className="max-w-2xl mx-auto">
        <header className="mb-8">
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

        <main>
          <h2 className="text-3xl font-bold text-black mb-6">Settings</h2>

          <div className="bg-white border-2 border-black rounded-lg p-6 mb-6">
            <h3 className="text-xl font-bold text-black mb-4">Profile</h3>

            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-500">Email</p>
                <p className="text-black">{user?.email || "No email"}</p>
              </div>

              <div>
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm text-gray-500">Username</p>
                    <p className="text-black">{profile?.username || "Not set"}</p>
                  </div>

                  <button
                    onClick={() => setShowUsernameModal(true)}
                    disabled={!!cooldownRemaining}
                    className={`px-4 py-2 rounded-lg ${
                      cooldownRemaining ? "bg-gray-200 text-gray-500 cursor-not-allowed" : "bg-black text-white"
                    }`}
                  >
                    Change
                  </button>
                </div>

                {cooldownRemaining && (
                  <div className="flex items-center text-sm text-orange-500 mt-2">
                    <FaClock className="mr-1" />
                    <span>You can change your username again in {cooldownRemaining}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white border-2 border-black rounded-lg p-6 mb-6">
            <h3 className="text-xl font-bold text-black mb-4">Account</h3>

            <button
              onClick={handleSignOut}
              className="w-full py-2 px-4 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
            >
              Sign Out
            </button>
          </div>
        </main>
      </div>
    </div>
  )
}
