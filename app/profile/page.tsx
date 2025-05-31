"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { FaEdit, FaGamepad, FaClock, FaSave, FaArrowLeft } from "react-icons/fa"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import type { User } from "@supabase/auth-helpers-nextjs"
import type { UserProfile } from "@/app/types/supabase"
import Link from "next/link"
import { useSearchParams } from "next/navigation"

const supabase = createClientComponentClient()

export default function ProfilePage() {
  const searchParams = useSearchParams()
  const userId = searchParams.get('userId')
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({
    username: "",
    bio: "",
    favorite_game: "",
    avatar_url: "",
  })

  // Check for user session
  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        setUser(session?.user || null)
      } catch (error) {
        console.error("Error checking session:", error)
      } finally {
        setIsLoading(false)
      }
    }

    checkSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setUser(session?.user || null)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  // Fetch profile data when user changes or userId changes
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setIsLoading(true)
        setError(null)
        
        const url = userId ? `/api/profile?userId=${userId}` : '/api/profile'
        const response = await fetch(url)
        
        if (!response.ok) {
          if (response.status === 404) {
            setError("Profile not found")
          } else {
            throw new Error("Failed to fetch profile")
          }
          return
        }

        const profileData = await response.json()
        setProfile(profileData)
        
        // Only set edit form if it's the user's own profile
        if (!userId || userId === user?.id) {
          setEditForm({
            username: profileData.username || "",
            bio: profileData.bio || "",
            favorite_game: profileData.favorite_game || "",
            avatar_url: profileData.avatar_url || "",
          })
        }
      } catch (error) {
        console.error("Error fetching profile:", error)
        setError("Error loading profile")
      } finally {
        setIsLoading(false)
      }
    }

    fetchProfile()
  }, [user, userId])

  const handleSave = async () => {
    if (!user) return
    setIsSaving(true)
    try {
      const response = await fetch("/api/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(editForm),
      })

      if (response.ok) {
        const updatedProfile = await response.json()
        setProfile(updatedProfile)
        setIsEditing(false)
      } else {
        const errorData = await response.json()
        if (response.status === 429) {
          setError(errorData.error || "Username can only be changed every 7 days")
        } else {
          setError("Failed to update profile")
        }
      }
    } catch (error) {
      console.error("Error updating profile:", error)
      setError("Error updating profile")
    } finally {
      setIsSaving(false)
    }
  }

  const isOwnProfile = !userId || userId === user?.id
  const avatarUrl = profile?.avatar_url || "https://api.dicebear.com/7.x/pixel-art/svg?seed=" + profile?.username

  if (isLoading) {
    return (
      <div className="bg-white min-h-screen p-8 flex items-center justify-center font-[family-name:var(--font-geist-sans)]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-black border-t-transparent rounded-full animate-spin"></div>
          <p className="text-black">Loading profile...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white min-h-screen p-8 flex items-center justify-center font-[family-name:var(--font-geist-sans)]">
        <div className="flex flex-col items-center gap-4 text-center">
          <h2 className="text-2xl font-bold text-black">Error</h2>
          <p className="text-black">{error}</p>
          <Link href="/explore" className="text-blue-600 hover:underline">
            Return to Games
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white min-h-screen p-8 font-[family-name:var(--font-geist-sans)]">
      <div className="max-w-4xl mx-auto">
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
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="bg-white border-2 border-black rounded-lg p-6"
          >
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-3xl font-bold text-black">
                  {isOwnProfile ? "Profile" : `${profile?.username}'s Profile`}
                </h2>
                {isOwnProfile && !isEditing ? (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setIsEditing(true)}
                    className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-lg"
                  >
                    <FaEdit /> Edit Profile
                  </motion.button>
                ) : isOwnProfile && isEditing ? (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleSave}
                    disabled={isSaving}
                    className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg disabled:opacity-50"
                  >
                    {isSaving ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                        Saving...
                      </>
                    ) : (
                      <>
                        <FaSave /> Save Changes
                      </>
                    )}
                  </motion.button>
                ) : null}
              </div>

              <div className="text-black flex flex-col md:flex-row gap-8">
                <div className="flex-shrink-0">
                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    className="relative w-48 h-48 rounded-2xl overflow-hidden border-2 border-black"
                  >
                    <img
                      src={avatarUrl}
                      alt={profile?.username}
                      className="w-full h-full object-cover"
                    />
                  </motion.div>
                </div>

                <div className="flex-grow space-y-4">
                  <div>
                    <label className="text-sm text-gray-500 mb-1 block">Username</label>
                    {isOwnProfile && isEditing ? (
                      <input
                        type="text"
                        value={editForm.username}
                        onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                        className="w-full px-4 py-2 rounded-lg border-2 border-black focus:outline-none focus:ring-2 focus:ring-black"
                        placeholder="Enter your username"
                      />
                    ) : (
                      <h2 className="text-2xl font-semibold text-black">{profile?.username}</h2>
                    )}
                  </div>

                  <div>
                    <label className="text-sm text-gray-500 mb-1 block">Bio</label>
                    {isOwnProfile && isEditing ? (
                      <textarea
                        value={editForm.bio || ""}
                        onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                        className="w-full px-4 py-2 rounded-lg border-2 border-black focus:outline-none focus:ring-2 focus:ring-black"
                        placeholder="Tell us about yourself"
                        rows={3}
                      />
                    ) : (
                      <p className="text-gray-600">{profile?.bio || "No bio yet"}</p>
                    )}
                  </div>

                  <div>
                    <label className="text-sm text-gray-500 mb-1 block">Favorite Game</label>
                    {isOwnProfile && isEditing ? (
                      <input
                        type="text"
                        value={editForm.favorite_game || ""}
                        onChange={(e) => setEditForm({ ...editForm, favorite_game: e.target.value })}
                        className="w-full px-4 py-2 rounded-lg border-2 border-black focus:outline-none focus:ring-2 focus:ring-black"
                        placeholder="What's your favorite game?"
                      />
                    ) : (
                      <div className="flex items-center gap-2">
                        <FaGamepad className="text-gray-400" />
                        <span>{profile?.favorite_game || "Not set"}</span>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="text-sm text-gray-500 mb-1 block">Hours Played</label>
                    <div className="flex items-center gap-2">
                      <FaClock className="text-gray-400" />
                      <span>{profile?.hours_played || 0} hours</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </main>
      </div>
    </div>
  )
}
