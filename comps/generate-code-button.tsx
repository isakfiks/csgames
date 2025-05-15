"use client"

import { useState } from "react"
import { Loader2, Copy, Check } from "lucide-react"

interface GenerateCodeButtonProps {
  lobbyId: string
  className?: string
}

export default function GenerateCodeButton({ lobbyId, className }: GenerateCodeButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [code, setCode] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const generateCode = async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/generate-code", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ lobbyId }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate code")
      }

      setCode(data.code)
    } catch (error) {
      console.error("Error generating code:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const copyToClipboard = () => {
    if (code) {
      navigator.clipboard.writeText(code)
      setCopied(true)

      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className={`flex flex-col items-center ${className}`}>
      {!code ? (
        <button className="text-sm over:bg-gray-800 bg-black text-white px-6 py-3 rounded-lg" onClick={generateCode} disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : (
            "Generate Invitation Code"
          )}
        </button>
      ) : (
        <div className="flex flex-col items-center space-y-2">
          <div className="flex items-center space-x-2">
            <span className="text-lg font-bold border-2 border-black px-3 py-1 rounded-md">{code}</span>
            <button className="text-sm bg-transparent border-black bourder-2 text-white px-6 py-3 rounded-lg" onClick={copyToClipboard}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="text-black h-4 w-4" />}
            </button>
          </div>
          <button onClick={() => setCode(null)} className="text-sm bg-black text-white px-6 py-3 rounded-lg">
            Generate New Code
          </button>
        </div>
      )}
    </div>
  )
}
