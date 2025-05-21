"use client"

import { useState, useEffect, useRef } from "react"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import type { User } from "@supabase/supabase-js"
import { makeAIMove } from "./tic-tac-toe-bot"

interface TicTacToeAIOpponentProps {
  gameState: any
  currentUser: User | null
  onMove: (row: number, col: number) => Promise<void>
}

export default function TicTacToeAIOpponent({ gameState, currentUser, onMove }: TicTacToeAIOpponentProps) {
  const supabase = createClientComponentClient()
  const [isAIThinking, setIsAIThinking] = useState(false)
  const aiTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Make AI move when it's the AI's turn
  useEffect(() => {
    // Clean up any existing timeout
    if (aiTimeoutRef.current) {
      clearTimeout(aiTimeoutRef.current)
    }

    async function performAIMove() {
      if (!gameState || gameState.status !== "playing") {
        return
      }

      // Check if it's AI's turn (player2 is the AI)
      if (gameState.current_player === gameState.player2 && gameState.ai_opponent) {
        // Set AI thinking state
        setIsAIThinking(true)

        const thinkingTime = Math.random() * 1000 + 500 // Purely for the visuals of it (thinking time those who know)

        aiTimeoutRef.current = setTimeout(async () => {
          try {
            // Convert the board format if needed
            const board = gameState.board.map((row: any) => row.map((cell: any) => cell || null))

            // Get the AI move
            const aiPlayer = gameState.player2
            const humanPlayer = gameState.player1
            const move = makeAIMove(board, aiPlayer, humanPlayer)

            if (!move) {
              console.log("AI couldn't find a move")
              setIsAIThinking(false)
              return
            }

            const [row, col] = move
            console.log(`AI making move at row ${row}, column ${col}`)

            // Execute the move
            await onMove(row, col)
          } catch (err) {
            console.error("Error in AI move:", err)
          } finally {
            setIsAIThinking(false)
          }
        }, thinkingTime)
      }
    }

    performAIMove()

    // Clean up on unmount
    return () => {
      if (aiTimeoutRef.current) {
        clearTimeout(aiTimeoutRef.current)
      }
    }
  }, [gameState, onMove])

  return (
    <div className="ai-status">
      {isAIThinking && <div className="text-sm text-gray-600 animate-pulse">AI is thinking...</div>}
    </div>
  )
}
