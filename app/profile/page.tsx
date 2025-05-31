"use client"

import { useState, useEffect } from "react"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import type { User } from "@supabase/auth-helpers-nextjs"
import type { UserProfile } from "@/app/types/supabase"
import { useRouter } from "next/navigation"

const supabase = createClientComponentClient()

export default function ProfilePage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [editForm, setEditForm] = useState({
    username: "",
    bio: "",
    favorite_game: "",
    avatar_url: "",
  })

  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        
        if (!session) {
          router.push("/")
          return
        }
        
        setUser(session.user)
      } catch (error) {
        console.error("Error checking session:", error)
        router.push("/")
      } finally {
        setIsLoading(false)
      }
    }

    checkSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!session) {
          router.push("/")
          return
        }
        setUser(session.user)
      }
    )

    return () => subscription.unsubscribe()
  }, [router])

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return

      try {
        setIsLoading(true)
        const response = await fetch("/api/profile")
        if (response.ok) {
          const profileData = await response.json()
          setProfile(profileData)
          setEditForm({
            username: profileData.username || "",
            bio: profileData.bio || "",
            favorite_game: profileData.favorite_game || "",
            avatar_url: profileData.avatar_url || "",
          })
        } else {
          throw new Error("Failed to fetch profile")
        }
      } catch (error) {
        console.error("Error fetching profile:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchProfile()
  }, [user])

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
        console.error("Failed to update profile")
      }
    } catch (error) {
      console.error("Error updating profile:", error)
    } finally {
      setIsSaving(false)
    }
  }

  return null
}
