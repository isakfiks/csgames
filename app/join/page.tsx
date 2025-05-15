"use client";
import { useState } from "react"
import Link from "next/link";

export default function Join() {
    const [isLoading, setIsLoading] = useState(false)
    const [notFound, setNotFound] = useState(false)
    
    async function joinGame() {
    // Refresh values
    setIsLoading(false)
    setNotFound(false)

    const codeInput = document.getElementById("code") as HTMLInputElement
    const code = codeInput.value.trim()

    if (code.length <= 0) {
      alert("Code field cannot be empty")
      return
    }

    setIsLoading(true)

    try {
      // Call the API to convert given code to a lobby ID (if it exists)
      const response = await fetch(`/api/join-code?code=${encodeURIComponent(code)}`)
      const data = await response.json()

      if (!response.ok) {
        setNotFound(true)
        setIsLoading(false)
        return
      }

      // Redirect to the lobby page with the found lobby ID
      location.href = "/lobby/" + data.lobbyId
    } catch (error) {
      console.error("Error joining game:", error)
      setNotFound(true)
      setIsLoading(false)
    }
  }

return (
    <div className="text-black bg-gradient-to-b from-white to-gray-50 min-h-screen font-[family-name:var(--font-geist-sans)] relative">
        
        <div className="place-items-center min-h-screen p-8 flex justify-center">
        <div className="justify-center align-center text-center">

        <h1 className="mb-2 text-xl font-bold">Enter Code</h1>
        <div className="flex justify-center">
        <h1 className="opacity-90">if you don&apos;t have a code, go to </h1><Link href="/explore"><h1 className="opacity-90 ml-1 text-slate-500">explore</h1></Link>
        </div>
        <input id="code"  placeholder="1234.." className="mt-8 rounded-lg p-3 text-black border-black border-2"></input>
        <button onClick={joinGame} className="bg-stone-700 p-3 text-white rounded-lg border-black border-2 ml-2">{isLoading ? "Joining.." : "Join"}</button>
        { notFound ? <h1 className="mt-2 text-red-600">invalid or expired code..</h1>: ""}
        </div>

        </div>
    </div>
)
}