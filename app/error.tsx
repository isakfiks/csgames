'use client'

import { useEffect } from 'react'
import { FaExclamationTriangle } from 'react-icons/fa'
import Link from 'next/link'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4 font-[family-name:var(--font-geist-sans)]">
      <div className="text-center max-w-md">
        <div className="flex justify-center mb-6">
          <FaExclamationTriangle className="text-6xl text-red-500" />
        </div>
        <h2 className="text-2xl font-bold text-black mb-4">Something went wrong!</h2>
        <p className="text-gray-600 mb-8">
          An unexpected error occurred. Please try again or return to the home page.
        </p>
        <div className="space-x-4">
          <button
            onClick={reset}
            className="px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
          >
            Try again
          </button>
          <Link
            href="/"
            className="px-6 py-3 border-2 border-black text-black rounded-lg hover:bg-gray-100 transition-colors inline-block"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  )
}
