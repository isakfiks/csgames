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

export default function ProfileContent() {
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
            <Link href="/explore">
            <div className="flex">
              <h1 className="text-2xl font-bold text-black">CSGames</h1>
              <span className="text-black text-2xl">.dev</span>
            </div>
            </Link>
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
                      "Saving..."
                    ) : (
                      <>
                        <FaSave /> Save
                      </>
                    )}
                  </motion.button>
                ) : null}
              </div>

              <div className="flex flex-col md:flex-row gap-6">
                <div className="w-full md:w-1/3">
                  <div className="bg-gray-100 p-4 rounded-lg">
                    <div className="mb-4">
                      {isEditing ? (
                        <div className="space-y-2">
                          <label className="block text-sm font-medium text-gray-700">Avatar URL</label>
                          <input
                            type="text"
                            value={editForm.avatar_url}
                            onChange={(e) => setEditForm({ ...editForm, avatar_url: e.target.value })}
                            placeholder="https://example.com/avatar.png"
                            className="w-full p-2 border border-gray-300 rounded"
                          />
                        </div>
                      ) : (
                        <img
                          src={avatarUrl}
                          alt={`${profile?.username}'s avatar`}
                          className="w-full h-auto aspect-square rounded-lg border-2 border-black"
                        />
                      )}
                    </div>

                    <h3 className="text-xl font-bold text-black mb-1">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editForm.username}
                          onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                          placeholder="Username"
                          className="w-full p-2 border border-gray-300 rounded"
                          maxLength={20}
                        />
                      ) : (
                        profile?.username || "Username not set"
                      )}
                    </h3>

                    <div className="text-gray-700 mb-4">
                      Joined {profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : "recently"}
                    </div>

                    <div className="flex items-center mb-3">
                      <FaClock className="text-gray-500 mr-2" />
                      <span className="text-black">{profile?.playtime || 0} minutes played</span>
                    </div>

                    <div className="flex items-center">
                      <FaGamepad className="text-gray-500 mr-2" />
                      <span className="text-black">{profile?.games_played || 0} games played</span>
                    </div>
                  </div>
                </div>

                <div className="w-full md:w-2/3">
                  <div className="bg-gray-100 p-4 rounded-lg mb-6">
                    <h3 className="text-lg font-bold text-black mb-2">Bio</h3>
                    {isEditing ? (
                      <textarea
                        value={editForm.bio}
                        onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                        placeholder="Tell others about yourself"
                        className="w-full p-2 border border-gray-300 rounded"
                        rows={4}
                        maxLength={300}
                      />
                    ) : (
                      <p className="text-black">{profile?.bio || "No bio yet"}</p>
                    )}
                  </div>

                  <div className="bg-gray-100 p-4 rounded-lg">
                    <h3 className="text-lg font-bold text-black mb-2">Favorite Game</h3>
                    {isEditing ? (
                      <input
                        type="text"
                        value={editForm.favorite_game}
                        onChange={(e) => setEditForm({ ...editForm, favorite_game: e.target.value })}
                        placeholder="What's your favorite game?"
                        className="w-full p-2 border border-gray-300 rounded"
                        maxLength={50}
                      />
                    ) : (
                      <p className="text-black">{profile?.favorite_game || "No favorite game set"}</p>
                    )}
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
