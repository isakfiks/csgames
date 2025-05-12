import Link from "next/link"

interface GameErrorProps {
  error: string
}

export default function GameError({ error }: GameErrorProps) {
  return (
    <div className="bg-white min-h-screen p-8 flex flex-col items-center justify-center font-[family-name:var(--font-geist-sans)]">
      <p className="text-black mb-4">Error: {error}</p>
      <Link href="/explore" className="text-black underline">
        Return to Explore Games
      </Link>
    </div>
  )
}
