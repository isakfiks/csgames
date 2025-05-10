"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"

type UsernameModalProps = {
  isOpen: boolean
  onClose: () => void
  initialUsername?: string
  isFirstTime?: boolean
  onUsernameSet?: (username: string) => void
}

export default function UsernameModal({
  isOpen,
  onClose,
  initialUsername = "",
  isFirstTime = true,
  onUsernameSet,
}: UsernameModalProps) {
  const [username, setUsername] = useState(initialUsername)
  const [isAvailable, setIsAvailable] = useState(true)
  const [isChecking, setIsChecking] = useState(false)
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const supabase = createClientComponentClient()

  useEffect(() => {
    // Reset state when it opens
    if (isOpen) {
      setUsername(initialUsername)
      setIsAvailable(true)
      setError("")
    }
  }, [isOpen, initialUsername])

  // Check username availability 
  useEffect(() => {
    if (!username || username === initialUsername) {
      setIsAvailable(true)
      setError("")
      return
    }

    // Confirm format
    if (username.length < 3) {
      setIsAvailable(false)
      setError("Username must be at least 3 characters")
      return
    }

    if (username.length > 20) {
      setIsAvailable(false)
      setError("Username must be less than 20 characters")
      return
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      setIsAvailable(false)
      setError("Username can only contain letters, numbers, and underscores")
      return
    }

    const checkAvailability = async () => {
      setIsChecking(true)
      try {
        // Check username availability
        const { data, error } = await supabase
          .from("profiles")
          .select("username")
          .eq("username", username)
          .maybeSingle()

        if (error) {
          console.error("Error checking username availability:", error)
          setError("Error checking username availability")
          setIsAvailable(false)
        } else if (data) {
          // Username does exist
          setIsAvailable(false)
          setError("Username is already taken")
        } else {
          // Username is available
          setIsAvailable(true)
          setError("")
        }
      } catch (err) {
        console.error("Error checking username:", err)
        setError("Error checking username availability")
        setIsAvailable(false)
      } finally {
        setIsChecking(false)
      }
    }

    const timer = setTimeout(() => {
      checkAvailability()
    }, 500)

    return () => clearTimeout(timer)
  }, [username, initialUsername, supabase])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!isAvailable || isChecking || !username) {
      return
    }

    setIsSubmitting(true)
    try {
      const { data: userData } = await supabase.auth.getUser()

      if (!userData.user) {
        throw new Error("User not authenticated")
      }

      const { error } = await supabase.from("profiles").update({ username }).eq("id", userData.user.id)

      if (error) {
        console.error("Error updating username:", error)
        if (error.message.includes("Username can only be changed once every 7 days")) {
          setError("You can only change your username once every 7 days")
        } else {
          setError(error.message || "Failed to update username")
        }
        return
      }

      // Call the callback
      if (onUsernameSet) {
        onUsernameSet(username)
      }

      onClose()
    } catch (err: any) {
      console.error("Error in handleSubmit:", err)
      setError(err.message || "An error occurred")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 max-w-md w-full">
        <div className="text-black text-center mb-6">
          <h2 className="text-2xl font-bold text-black">{isFirstTime ? "Welcome to CSGames!" : "Change Username"}</h2>
          <p className="text-gray-600 mt-2">
            {isFirstTime ? "Please choose a username to continue" : "Usernames can only be changed once every 7 days"}
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
              Username
            </label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className={`text-black w-full p-3 border-2 rounded-lg ${
                !isAvailable && username ? "border-red-500" : "border-gray-300"
              }`}
              placeholder="Enter a username"
              autoComplete="off"
            />
            {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
            {isChecking && <p className="mt-1 text-sm text-gray-500">Checking availability...</p>}
            {isAvailable && username && !isChecking && !error && (
              <p className="mt-1 text-sm text-green-600">Username is available</p>
            )}
          </div>

          <div className="flex gap-3 mt-6">
            {!isFirstTime && (
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2 px-4 border border-gray-300 rounded-lg text-black"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={!isAvailable || isChecking || isSubmitting || !username}
              className={`flex-1 py-2 px-4 rounded-lg ${
                !isAvailable || isChecking || isSubmitting || !username
                  ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                  : "bg-black text-white"
              }`}
            >
              {isSubmitting ? "Saving..." : "Save Username"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
