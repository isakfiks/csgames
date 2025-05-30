"use client"

import Link from "next/link"
import { FaArrowLeft, FaSync } from "react-icons/fa"
import type { User } from "@supabase/supabase-js"

interface BalloonGameProps {
  lobbyId: string
  currentUser: User | null
}

export default function BalloonGame({ lobbyId, currentUser }: BalloonGameProps) {
  return (
    <div className="bg-white min-h-screen p-4 md:p-8 font-[family-name:var(--font-geist-sans)]">
      <header className="max-w-4xl mx-auto mb-4 md:mb-8">
        <div className="flex justify-between items-center">
          <Link 
            href="/explore" 
            className="flex items-center text-black transition-transform duration-200 hover:translate-x-[-4px]"
          >
            <FaArrowLeft className="mr-2" />
            <span>Back to Games</span>
          </Link>
          <div className="flex">
            <h1 className="text-xl md:text-2xl font-bold text-black">CSGames</h1>
            <span className="text-black text-xl md:text-2xl">.dev</span>
          </div>
        </div>
      </header>

      <main className="text-black max-w-4xl mx-auto">
        <div className="mb-4 md:mb-6 flex flex-col md:flex-row justify-between items-center">
          <h2 className="text-2xl md:text-3xl font-bold text-black mb-2 md:mb-0">
            Pump Till It Pops
          </h2>

          <div className="flex items-center space-x-4">
            <button
              className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-all duration-300"
              aria-label="Reset game"
            >
              <FaSync className="text-black" />
            </button>
            <div className="bg-gray-100 px-4 py-2 rounded-lg">
              <span className="font-mono">Score: 0</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center space-y-8">
          <div className="relative">
            <div 
              className="w-24 h-24 rounded-full bg-red-500 shadow-lg" 
              style={{ 
                background: "radial-gradient(circle at 30% 30%, #f87171, #dc2626)" 
              }} 
            />
            <div className="w-2 h-8 bg-gray-400 absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-full" />
          </div>

          <button
            className="px-6 py-3 rounded-lg text-white font-bold transition-all duration-200 transform 
              bg-black hover:bg-gray-800 hover:scale-105 active:scale-95"
          >
            Pump! 🎈
          </button>
        </div>
      </main>
    </div>
  )
}