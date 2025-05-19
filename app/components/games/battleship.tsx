"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { FaArrowLeft } from "react-icons/fa"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import type { User } from "@supabase/supabase-js"

interface BattleshipGameProps {
  lobbyId: string
  currentUser: User | null
}

const BOARD_SIZE = 10

function GameLoading() {
  return (
    <div className="flex items-center justify-center h-screen">
      <div className="animate-pulse flex flex-col items-center">
        <div className="w-16 h-16 rounded-full bg-blue-600 mb-4 animate-bounce"></div>
        <p className="text-xl font-bold">Loading game...</p>
      </div>
    </div>
  )
}

function GameError({ error }: { error: string }) {
  return (
    <div className="flex items-center justify-center h-screen">
      <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded shadow-md max-w-md">
        <p className="font-bold">Error</p>
        <p>{error}</p>
      </div>
    </div>
  )
}

export default function BattleshipGame({ lobbyId, currentUser }: BattleshipGameProps) {
  const router = useRouter()
  const supabase = createClientComponentClient()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const [myBoard, setMyBoard] = useState<number[][]>(
    Array(BOARD_SIZE).fill(0).map(() => Array(BOARD_SIZE).fill(0))
  )
  const [opponentBoard, setOpponentBoard] = useState<number[][]>(
    Array(BOARD_SIZE).fill(0).map(() => Array(BOARD_SIZE).fill(0))
  )

  useEffect(() => {
    let isActive = true

    async function loadGameData() {
      try {
        if (!currentUser) {
          router.push("/")
          return
        }
        
        setTimeout(() => {
          if (isActive) setLoading(false)
        }, 1000)
      } catch (err: unknown) {
        console.error("Error loading game data:", err)
        if (isActive) setError((err as Error).message || "Failed to load game data")
      }
    }

    loadGameData()

    return () => {
      isActive = false
    }
  }, [lobbyId, router, supabase, currentUser])

  if (loading) {
    return <GameLoading />
  }

  if (error) {
    return <GameError error={error} />
  }

  return (
    <div className="bg-white min-h-screen p-4 md:p-8">
      <header className="max-w-4xl mx-auto mb-4 md:mb-8">
        <div className="flex justify-between items-center">
          <Link href={`/lobby/${lobbyId}`} className="flex items-center text-black transition-transform duration-200 hover:translate-x-[-4px]">
            <FaArrowLeft className="mr-2" />
            <span>Back to Lobby</span>
          </Link>
          <div className="flex">
            <h1 className="text-xl md:text-2xl font-bold text-black">CSGames</h1>
            <span className="text-black text-xl md:text-2xl">.dev</span>
          </div>
        </div>
      </header>

      <main className="text-black max-w-4xl mx-auto">
        <div className="mb-4 md:mb-6">
          <h2 className="text-2xl md:text-3xl font-bold text-black mb-2">Battleship</h2>
          <p className="text-gray-600">Place your ships and attack your opponent's fleet!</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <h3 className="text-lg font-bold mb-2">Your Fleet</h3>
            <div className="bg-blue-100 p-2 rounded-lg">
              <div className="grid grid-cols-10 gap-1">
                {myBoard.map((row, rowIndex) =>
                  row.map((cell, colIndex) => (
                    <div
                      key={`my-${rowIndex}-${colIndex}`}
                      className="aspect-square bg-blue-200 rounded-sm flex items-center justify-center"
                    ></div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-bold mb-2">Enemy Waters</h3>
            <div className="bg-red-100 p-2 rounded-lg">
              <div className="grid grid-cols-10 gap-1">
                {opponentBoard.map((row, rowIndex) =>
                  row.map((cell, colIndex) => (
                    <div
                      key={`opponent-${rowIndex}-${colIndex}`}
                      className="aspect-square bg-red-200 rounded-sm flex items-center justify-center"
                    ></div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
