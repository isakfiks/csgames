"use client"

import { useState, useEffect, useRef } from "react"
import type { User } from "@supabase/supabase-js"
import { makeAIMove } from "./tic-tac-toe-bot"

interface TicTacToeGameState {
  id: string
  board: (string | null)[][]
  current_player: string
  player1: string
  player2: string
  status: "waiting" | "playing" | "completed"
  winner: string | null
  ai_opponent: boolean
}

interface TicTacToeAIOpponentProps {
  gameState: TicTacToeGameState
  currentUser: User | null
  onMove: (row: number, col: number) => Promise<void>
}

export default function TicTacToeAIOpponent({ gameState, onMove }: TicTacToeAIOpponentProps) {
  const [isAIThinking, setIsAIThinking] = useState(false)
  const aiTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isMountedRef = useRef(true) // To avoid setting state after unmount

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      isMountedRef.current = false
      if (aiTimeoutRef.current) clearTimeout(aiTimeoutRef.current)
    }
  }, [])

  useEffect(() => {
    if (aiTimeoutRef.current) {
      clearTimeout(aiTimeoutRef.current)
    }

    async function performAIMove() {
      // Only try if game is playing, AI opponent enabled and it's AI's turn
      if (!gameState || gameState.status !== "playing") return
      if (gameState.current_player !== gameState.player2) return
      if (!gameState.ai_opponent) return

      setIsAIThinking(true)
      const thinkingTime = Math.random() * 1000 + 500

      aiTimeoutRef.current = setTimeout(async () => {
        try {
          // Double-check current_player hasn't changed (race condition check)
          if (gameState.current_player !== gameState.player2) {
            console.log("AI move aborted: not AI's turn anymore")
            if (isMountedRef.current) setIsAIThinking(false)
            return
          }

          // Prepare board and get AI move
          const board = gameState.board.map(row => row.map(cell => cell))
          const move = makeAIMove(board, gameState.player2, gameState.player1)

          if (!move) {
            console.log("AI couldn't find a move")
            if (isMountedRef.current) setIsAIThinking(false)
            return
          }

          const [row, col] = move
          console.log(`AI making move at row ${row}, column ${col}`)

          // Await onMove call which updates game state on backend & frontend
          await onMove(row, col)
        } catch (err: unknown) {
          // Handle error specifically for "Not your turn"
          interface CustomError extends Error {
            code?: string;
          }

          if (err instanceof Error && (err as CustomError).code === "P0001" && err.message === "Not your turn") {
            console.warn("AI tried to move but it wasn't its turn yet.")
          } else if (err instanceof Error) {
            console.error("Error in AI move:", err)
          } else {
            console.error("Unexpected error in AI move:", err)
          }
        } finally {
          if (isMountedRef.current) setIsAIThinking(false)
        }
      }, thinkingTime)
    }

    performAIMove()

    // Cleanup AI timeout on dependencies change
    return () => {
      if (aiTimeoutRef.current) clearTimeout(aiTimeoutRef.current)
    }
  }, [gameState, onMove])

  return (
    <div className="ai-status">
      {isAIThinking && (
        <div className="text-sm text-gray-600 animate-pulse">
          AI is thinking...
        </div>
      )}
    </div>
  )
}
