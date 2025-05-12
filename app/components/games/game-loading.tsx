export default function GameLoading() {
  return (
    <div className="bg-white min-h-screen p-8 flex items-center justify-center font-[family-name:var(--font-geist-sans)]">
      <div className="flex flex-col items-center">
        <div className="w-12 h-12 border-4 border-black border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-black text-lg">Loading game...</p>
      </div>
    </div>
  )
}
