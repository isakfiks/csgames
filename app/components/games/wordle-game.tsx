"use client"

import { useState } from "react"

const WORD_LENGTH = 5
const MAX_GUESSES = 6
const ALPHABET = "QWERTYUIOPASDFGHJKLZXCVBNM".split("")

export default function WordleGame() {
  const [guesses] = useState<string[]>(Array(MAX_GUESSES).fill(""))
  const [currentGuess] = useState("")

  return (
    <div className="bg-white min-h-screen p-4 md:p-8 font-[family-name:var(--font-geist-sans)]">
      <header className="max-w-2xl mx-auto mb-6 flex flex-col items-center">
        <h1 className="text-3xl md:text-4xl font-bold text-black mb-2">Corruptle</h1>
        <span className="text-gray-500 text-sm">Guess the {WORD_LENGTH}-letter word!</span>
      </header>
      <main className="flex flex-col items-center">
        <div className="grid grid-rows-6 gap-2 mb-8">
          {guesses.map((guess, rowIdx) => (
            <div key={rowIdx} className="grid grid-cols-5 gap-2">
              {Array(WORD_LENGTH).fill(0).map((_, colIdx) => (
                <div
                  key={colIdx}
                  className="w-12 h-12 md:w-14 md:h-14 border-2 border-gray-300 rounded flex items-center justify-center text-2xl font-bold bg-gray-50 text-black"
                >
                  {guess[colIdx] || ""}
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="flex flex-col items-center space-y-2">
          <div className="flex space-x-1">
            {ALPHABET.slice(0,10).map(l => (
              <button key={l} className="w-10 h-12 bg-gray-200 rounded font-bold text-lg text-black hover:bg-gray-300">{l}</button>
            ))}
          </div>
          <div className="flex space-x-1">
            {ALPHABET.slice(10,19).map(l => (
              <button key={l} className="w-10 h-12 bg-gray-200 rounded font-bold text-lg text-black hover:bg-gray-300">{l}</button>
            ))}
          </div>
          <div className="flex space-x-1">
            <button className="w-16 h-12 bg-gray-300 rounded font-bold text-black">Enter</button>
            {ALPHABET.slice(19).map(l => (
              <button key={l} className="w-10 h-12 bg-gray-200 rounded font-bold text-lg text-black hover:bg-gray-300">{l}</button>
            ))}
            <button className="w-16 h-12 bg-gray-300 rounded font-bold text-black">Del</button>
          </div>
        </div>
      </main>
    </div>
  )
}
