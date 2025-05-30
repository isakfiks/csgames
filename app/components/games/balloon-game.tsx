"use client"

import Link from "next/link"
import { FaArrowLeft, FaSync } from "react-icons/fa"
import type { User } from "@supabase/supabase-js"
import { useState, useCallback, useEffect } from "react"

interface BalloonGameProps {
  lobbyId: string
  currentUser: User | null
}

export default function BalloonGame({ lobbyId, currentUser }: BalloonGameProps) {
  const [size, setSize] = useState(24)
  const [score, setScore] = useState(0)
  const [highScore, setHighScore] = useState(0)
  const [isPopped, setIsPopped] = useState(false)
  const [popThreshold] = useState(() => Math.floor(Math.random() * 100) + 50) // Increased threshold
  const [isPlayerTurn, setIsPlayerTurn] = useState(true)
  const [remainingPumps, setRemainingPumps] = useState(3)
  const [turnTimer, setTurnTimer] = useState(10)

  const resetGame = useCallback(() => {
    setSize(24)
    setScore(0)
    setIsPopped(false)
    setIsPlayerTurn(true)
    setRemainingPumps(3)
    setTurnTimer(10)
  }, [])

  const performBotTurn = useCallback(() => {
    if (!isPopped) {
      const pumps = Math.floor(Math.random() * 3) + 1
      let currentPump = 0

      const doPump = () => {
        const newSize = size + 4
        if (newSize >= popThreshold) {
          setIsPopped(true)
          if (score > highScore) {
            setHighScore(score)
          }
        } else {
          setSize(newSize)
          setScore(prev => prev + 1)
          currentPump++
          
          if (currentPump < pumps) {
            setTimeout(doPump, 300)
          } else {
            setIsPlayerTurn(true)
            setRemainingPumps(3)
          }
        }
      }

      setTimeout(doPump, 300)
    }
  }, [size, score, highScore, isPopped, popThreshold])

  useEffect(() => {
    let timer: NodeJS.Timeout
    if (!isPopped && turnTimer > 0) {
      timer = setTimeout(() => {
        setTurnTimer(prev => prev - 1)
      }, 1000)
    } else if (turnTimer === 0) {
      setIsPlayerTurn(prev => !prev)
      setTurnTimer(10)
      if (isPlayerTurn) {
        setTimeout(performBotTurn, 300)
      }
    }
    return () => clearTimeout(timer)
  }, [turnTimer, isPopped, isPlayerTurn, performBotTurn])

  const handleEndTurn = useCallback(() => {
    setIsPlayerTurn(false)
    setTurnTimer(10)
    setTimeout(performBotTurn, 300)
  }, [performBotTurn])

  const handlePump = useCallback(() => {
    if (isPopped || !isPlayerTurn) return
    
    const newSize = size + 4
    if (newSize >= popThreshold) {
      setIsPopped(true)
      if (score > highScore) {
        setHighScore(score)
      }
    } else {
      setSize(newSize)
      setScore(prev => prev + 1)
      const newRemainingPumps = remainingPumps - 1
      setRemainingPumps(newRemainingPumps)
      
      if (newRemainingPumps === 0) {
        handleEndTurn()
      }
    }
  }, [size, score, highScore, isPopped, popThreshold, isPlayerTurn, remainingPumps, handleEndTurn])

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
              onClick={resetGame}
              className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-all duration-300"
              aria-label="Reset game"
            >
              <FaSync className="text-black" />
            </button>
            <div className="bg-gray-100 px-4 py-2 rounded-lg">
              <span className="font-mono">Score: {score}</span>
            </div>
            <div className="bg-gray-100 px-4 py-2 rounded-lg">
              <span className="font-mono">Time: {turnTimer}s</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center space-y-8">
          <div className="relative">
            {!isPopped ? (
              <>
                <div 
                  className="rounded-full shadow-lg transition-all duration-200" 
                  style={{ 
                    background: "radial-gradient(circle at 30% 30%, #f87171, #dc2626)",
                    width: `${size}px`,
                    height: `${size}px`,
                  }} 
                />
                <div className="w-2 h-8 bg-gray-400 absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-full" />
              </>
            ) : (
              <div className="text-4xl">💥</div>
            )}
          </div>

          <div className="flex space-x-4">
            <button
              onClick={handlePump}
              disabled={isPopped || !isPlayerTurn}
              className={`px-6 py-3 rounded-lg text-white font-bold transition-all duration-200 transform 
                ${(isPopped || !isPlayerTurn)
                  ? 'bg-gray-400 cursor-not-allowed' 
                  : 'bg-black hover:bg-gray-800 hover:scale-105 active:scale-95'
                }`}
            >
              {isPopped 
                ? 'Game Over! 💥' 
                : isPlayerTurn 
                  ? `Pump! 🎈 (${remainingPumps} max)` 
                  : 'Opponent is playing...'}
            </button>
            {isPlayerTurn && !isPopped && (
              <button
                onClick={handleEndTurn}
                className="px-6 py-3 rounded-lg text-white font-bold bg-blue-500 hover:bg-blue-600"
              >
                End Turn
              </button>
            )}
          </div>

          {isPopped && (
            <div className="text-center">
              <p className="text-lg font-bold">High Score: {highScore}</p>
              <button
                onClick={resetGame}
                className="mt-2 text-blue-600 hover:underline"
              >
                Play Again
              </button>
            </div>
          )}
          {!isPopped && !isPlayerTurn && (
            <p className="text-lg font-bold text-gray-600">Opponent is playing...</p>
          )}
        </div>
      </main>
    </div>
  )
}