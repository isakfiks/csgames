"use client"

import SlidingPuzzle from "@/app/components/games/sliding-puzzle"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { useEffect, useState } from "react"

export default function PuzzleDemo() {
  const [currentUser, setCurrentUser] = useState(null)
  const supabase = createClientComponentClient()

  useEffect(() => {
    const loadUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setCurrentUser(user)
    }
    loadUser()
  }, [supabase])

  return <SlidingPuzzle lobbyId="demo" currentUser={currentUser} />
}
