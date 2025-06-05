"use client"

import { useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import confetti from 'canvas-confetti'

const WORD_LENGTH = 5
const MAX_GUESSES = 6
const ALPHABET = "QWERTYUIOPASDFGHJKLZXCVBNM".split("")

type LetterState = "correct" | "present" | "absent" | "unused"

export default function WordleGame() {
  const [answer, setAnswer] = useState<string>("")
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [guesses, setGuesses] = useState<string[]>(Array(MAX_GUESSES).fill(""))
  const [currentGuess, setCurrentGuess] = useState("")
  const [currentRow, setCurrentRow] = useState(0)
  const [keyStates, setKeyStates] = useState<{ [key: string]: LetterState }>(
    Object.fromEntries(ALPHABET.map(letter => [letter, "unused"]))
  )
  const [shake, setShake] = useState(false)
  const [gameOver, setGameOver] = useState(false)
  const [streak, setStreak] = useState(0)
  const [maxStreak, setMaxStreak] = useState(0)

  useEffect(() => {
    const savedStreak = localStorage.getItem('wordleStreak')
    if (savedStreak) {
      const { currentStreak, maxStreak: savedMaxStreak, lastWinDate } = JSON.parse(savedStreak)
      
      const today = new Date()
      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)
      const lastWin = new Date(lastWinDate)
      
      if (lastWin.toDateString() === yesterday.toDateString()) {
        setStreak(currentStreak)
      } else if (lastWin.toDateString() !== today.toDateString()) {
        // Reset streak if plr didn't play yesterday and hasn't played today
        setStreak(0)
      }
      
      setMaxStreak(savedMaxStreak)
    }
  }, [])

  const saveWin = useCallback(() => {
    const today = new Date()
    const savedStreak = localStorage.getItem('wordleStreak')
    let newStreak = 1
    let newMaxStreak = 1
    
    if (savedStreak) {
      const { currentStreak, maxStreak: savedMaxStreak, lastWinDate } = JSON.parse(savedStreak)
      const lastWin = new Date(lastWinDate)
      
      if (lastWin.toDateString() === today.toDateString()) {
        // Already won today, don't update streak
        return
      }
      
      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)
      
      if (lastWin.toDateString() === yesterday.toDateString()) {
        newStreak = currentStreak + 1
      }
      
      newMaxStreak = Math.max(savedMaxStreak, newStreak)
    }
    
    setStreak(newStreak)
    setMaxStreak(newMaxStreak)
    
    localStorage.setItem('wordleStreak', JSON.stringify({
      currentStreak: newStreak,
      maxStreak: newMaxStreak,
      lastWinDate: today.toDateString()
    }))
    
    localStorage.setItem('wordleWins', JSON.stringify({
      date: today.toDateString(),
      word: answer
    }))
  }, [answer])

  // Celebrate win with confetti and sound
  const celebrateWin = useCallback(() => {
    // Play win sound
    const audio = new Audio('/sounds/win.wav')
    audio.play()

    // Fire confetti
    const duration = 3000
    const animationEnd = Date.now() + duration
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 }

    const randomInRange = (min: number, max: number) => {
      return Math.random() * (max - min) + min
    }

    const interval: any = setInterval(() => {
      const timeLeft = animationEnd - Date.now()

      if (timeLeft <= 0) {
        return clearInterval(interval)
      }

      const particleCount = 50 * (timeLeft / duration)
        confetti(Object.assign({}, defaults, {
        particleCount: particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
      }))
      confetti(Object.assign({}, defaults, {
        particleCount: particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
      }))
    }, 250)

    return () => clearInterval(interval)
  }, [])

  // Fetch the word when component mounts
  useEffect(() => {
    const fetchWord = async () => {
      try {
        const response = await fetch('/api/wordle-word')
        const data = await response.json()
        if (response.ok) {
          setAnswer(data.word.toUpperCase())
        } else {
          setError(data.error || 'Failed to fetch word')
        }
      } catch (err) {
        setError('Failed to fetch word: ' + err)
      } finally {
        setIsLoading(false)
      }
    }
    fetchWord()
  }, [])

  // Load saved game state when the answer is loaded
  useEffect(() => {
    if (!answer || isLoading) return

    const savedState = localStorage.getItem('wordleState')
    if (savedState) {
      const { lastPlayedWord, date, guesses: savedGuesses, currentRow: savedRow, keyStates: savedKeyStates, gameOver: savedGameOver } = JSON.parse(savedState)
      
      // Only restore state if it's from today and for the same word
      const today = new Date().toDateString()
      if (date === today && lastPlayedWord === answer) {
        setGuesses(savedGuesses)
        setCurrentRow(savedRow)
        setKeyStates(savedKeyStates)
        setGameOver(savedGameOver)
      }
    }
  }, [answer, isLoading])

  // Save game state whenever it changes
  useEffect(() => {
    if (!answer || isLoading) return

    localStorage.setItem('wordleState', JSON.stringify({
      lastPlayedWord: answer,
      date: new Date().toDateString(),
      guesses,
      currentRow,
      keyStates,
      gameOver
    }))
  }, [answer, guesses, currentRow, keyStates, gameOver, isLoading])

  const checkGuess = useCallback((guess: string): LetterState[] => {
    const result: LetterState[] = Array(WORD_LENGTH).fill("absent")
    const answerArray = answer.split("")
    const guessArray = guess.split("")
    
    // Mark correct letters
    guessArray.forEach((letter, i) => {
      if (letter === answerArray[i]) {
        result[i] = "correct"
        answerArray[i] = "#"
      }
    })
    
    guessArray.forEach((letter, i) => {
      if (result[i] === "absent") {
        const index = answerArray.indexOf(letter)
        if (index !== -1) {
          result[i] = "present"
          answerArray[index] = "#"
        }
      }
    })
    
    return result
  }, [answer])

  const updateKeyStates = useCallback((guess: string, states: LetterState[]) => {
    setKeyStates(prev => {
      const newStates = { ...prev }
      guess.split("").forEach((letter, i) => {
        const currentState = newStates[letter]
        const newState = states[i]
        if (newState === "correct") {
          newStates[letter] = "correct"
        } else if (newState === "present" && currentState !== "correct") {
          newStates[letter] = "present"
        } else if (newState === "absent" && currentState === "unused") {
          newStates[letter] = "absent"
        }
      })
      return newStates
    })
  }, [])

  const submitGuess = useCallback(async () => {
    if (currentGuess.length !== WORD_LENGTH) return

    const response = await fetch('/api/wordle-validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ word: currentGuess })
    })
    const data = await response.json()

    if (!data.valid) {
      setShake(true)
      setTimeout(() => setShake(false), 500)
      return
    }

    const newGuesses = [...guesses]
    newGuesses[currentRow] = currentGuess
    setGuesses(newGuesses)

    const states = checkGuess(currentGuess)
    updateKeyStates(currentGuess, states)

    if (currentGuess === answer) {
      setGameOver(true)
      celebrateWin()
      const savedWins = localStorage.getItem('wordleWins')
      if (!savedWins || JSON.parse(savedWins).date !== new Date().toDateString()) {
        saveWin()
      }
    } else if (currentRow === MAX_GUESSES - 1) {
      setGameOver(true)
    } else {
      setCurrentRow(prev => prev + 1)
      setCurrentGuess("")
    }
  }, [currentGuess, currentRow, guesses, answer, checkGuess, updateKeyStates, saveWin, celebrateWin])

  const handleKeyInput = useCallback((key: string) => {
    if (gameOver) return
    
    if (key === "ENTER") {
      submitGuess()
    } else if (key === "BACKSPACE" || key === "DEL") {
      setCurrentGuess(prev => prev.slice(0, -1))
    } else if (ALPHABET.includes(key) && currentGuess.length < WORD_LENGTH) {
      setCurrentGuess(prev => prev + key)
    }
  }, [currentGuess, gameOver, submitGuess])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toUpperCase()
      if (key === "ENTER" || key === "BACKSPACE" || ALPHABET.includes(key)) {
        handleKeyInput(key)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [handleKeyInput])
  const getLetterStateClass = (letter: string, state: LetterState) => {
    const baseClass = "w-8 h-10 sm:w-10 sm:h-12 rounded font-bold text-sm sm:text-lg flex items-center justify-center transition-colors duration-300 touch-manipulation select-none"
    switch (state) {
      case "correct":
        return `${baseClass} bg-green-500 text-white active:bg-green-600 hover:bg-green-600`
      case "present":
        return `${baseClass} bg-yellow-500 text-white active:bg-yellow-600 hover:bg-yellow-600`
      case "absent":
        return `${baseClass} bg-gray-500 text-white active:bg-gray-600 hover:bg-gray-600`
      default:
        return `${baseClass} bg-gray-200 text-black active:bg-gray-300 hover:bg-gray-300`
    }
  }
  const getBoxStyle = (rowIndex: number, colIdx: number) => {
    const guess = guesses[rowIndex]
    const letter = guess?.[colIdx] || ""
    const isCurrentRow = rowIndex === currentRow
    const isCurrentGuessLetter = isCurrentRow && currentGuess[colIdx]
    const isWinningWord = gameOver && guess === answer

    // If there's no letter and it's not the current row
    if (!letter && !isCurrentGuessLetter) {
      return "border-2 border-gray-300 bg-gray-50"
    }

    // If it's current row
    if (isCurrentRow) {
      return "border-2 border-gray-400 bg-gray-50"
    }

    // If there's a letter, compute its state
    if (letter) {
      const state = checkGuess(guess)[colIdx]
      const baseStyle = state === "correct" ? "bg-green-500 border-green-500 text-white" :
                       state === "present" ? "bg-yellow-500 border-yellow-500 text-white" :
                       state === "absent" ? "bg-gray-500 border-gray-500 text-white" :
                       "border-2 border-gray-300 bg-gray-50"
      
      // Add extra styles for winning word
      return isWinningWord 
        ? `${baseStyle} shadow-lg ring-2 ring-green-400` 
        : baseStyle
    }

    return "border-2 border-gray-300 bg-gray-50"
  }

  if (isLoading) {
    return (
      <div className="text-black bg-white min-h-screen p-4 md:p-8 flex items-center justify-center">
        <div className="text-xl">Loading game...</div>
      </div>
    )
  }

  if (error || !answer) {
    return (
      <div className="text-black bg-white min-h-screen p-4 md:p-8 flex items-center justify-center">
        <div className="text-xl text-red-500">Failed to start game. Please try again.</div>
      </div>
    )
  }

  return (
    <div className="text-black bg-white min-h-screen p-4 md:p-8 font-[family-name:var(--font-geist-sans)]">      <header className="max-w-2xl mx-auto mb-6 flex flex-col items-center">
        <h1 className="text-3xl md:text-4xl font-bold text-black mb-2">Corruptle</h1>
        <span className="text-gray-500 text-sm mb-2">Guess the {WORD_LENGTH}-letter word!</span>
        <div className="flex gap-4 text-sm">
          <div className="flex flex-col items-center">
            <span className="font-bold text-lg">{streak}</span>
            <span className="text-gray-500">Current Streak</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="font-bold text-lg">{maxStreak}</span>
            <span className="text-gray-500">Max Streak</span>
          </div>
        </div>
      </header>

      <main className="flex flex-col items-center">
        <div className="grid grid-rows-6 gap-2 mb-8">
          {guesses.map((guess, rowIdx) => (
            <motion.div 
              key={rowIdx}
              className="grid grid-cols-5 gap-2"
              animate={shake && rowIdx === currentRow ? {
                x: [0, -10, 10, -10, 10, 0],
                transition: { duration: 0.5 }
              } : {}}
            >
              {Array(WORD_LENGTH).fill(0).map((_, colIdx) => (
                <motion.div
                  key={colIdx}
                  animate={gameOver && guess === answer ? {
                    scale: [1, 1.2, 1],
                    transition: { duration: 0.3, delay: colIdx * 0.1 }
                  } : {}}
                  className={`w-12 h-12 md:w-14 md:h-14 rounded flex items-center justify-center text-2xl font-bold ${getBoxStyle(rowIdx, colIdx)}`}
                >
                  {rowIdx === currentRow ? currentGuess[colIdx] || "" : guess[colIdx] || ""}
                </motion.div>
              ))}
            </motion.div>
          ))}
        </div>        <AnimatePresence>
          {gameOver && (
            <motion.div 
              className="mb-6 text-center"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              transition={{ type: "spring", duration: 0.5 }}
            >
              <motion.h2 
                className="text-2xl font-bold mb-3"
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 0.5, times: [0, 0.5, 1] }}
              >
                {currentGuess === answer ? (
                  <>
                    <span className="text-green-500">Congratulations!</span> 🎉
                    <motion.div
                      className="text-lg mt-2"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.5 }}
                    >
                      You got it in {currentRow + 1} {currentRow === 0 ? 'try' : 'tries'}!
                    </motion.div>
                  </>
                ) : "Game Over!"}
              </motion.h2>
              <motion.p 
                className="text-gray-600 text-lg"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                The word was: <span className="font-bold">{answer}</span>
              </motion.p>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex flex-col items-center space-y-2 w-full max-w-lg px-1">
          <div className="flex justify-center space-x-1 w-full">
            {ALPHABET.slice(0,10).map(letter => (
              <button
                key={letter}
                onClick={() => handleKeyInput(letter)}
                className={getLetterStateClass(letter, keyStates[letter])}
              >
                {letter}
              </button>
            ))}
          </div>
          <div className="flex justify-center space-x-1 w-full">
            {ALPHABET.slice(10,19).map(letter => (
              <button
                key={letter}
                onClick={() => handleKeyInput(letter)}
                className={getLetterStateClass(letter, keyStates[letter])}
              >
                {letter}
              </button>
            ))}
          </div>
          <div className="flex justify-center space-x-1 w-full">
            <button 
              onClick={() => handleKeyInput("ENTER")}
              className="w-14 h-10 sm:w-16 sm:h-12 bg-gray-300 rounded font-bold text-xs sm:text-sm text-black hover:bg-gray-400 active:bg-gray-400 transition-colors duration-300 touch-manipulation select-none flex items-center justify-center"
            >
              Enter
            </button>
            {ALPHABET.slice(19).map(letter => (
              <button
                key={letter}
                onClick={() => handleKeyInput(letter)}
                className={getLetterStateClass(letter, keyStates[letter])}
              >
                {letter}
              </button>
            ))}
            <button 
              onClick={() => handleKeyInput("DEL")}
              className="w-14 h-10 sm:w-16 sm:h-12 bg-gray-300 rounded font-bold text-xs sm:text-sm text-black hover:bg-gray-400 active:bg-gray-400 transition-colors duration-300 touch-manipulation select-none flex items-center justify-center"
            >
              Del
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}
