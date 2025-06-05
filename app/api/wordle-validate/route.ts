import { NextResponse } from 'next/server'
import { initializeWordList, getValidGuesses } from '@/app/lib/wordList'

export async function POST(request: Request) {
  const { word } = await request.json()
  
  if (!word || typeof word !== 'string' || word.length !== 5) {
    return NextResponse.json({ valid: false })
  }

  await initializeWordList()
  const isValid = getValidGuesses().has(word.toLowerCase())
  return NextResponse.json({ valid: isValid })
}
