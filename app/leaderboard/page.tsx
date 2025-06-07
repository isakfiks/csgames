"use client"

import Link from "next/link"
import { useState, useEffect } from "react"
import { FaArrowLeft, FaTrophy, FaSync } from "react-icons/fa"
import { motion } from "framer-motion"

interface LeaderboardEntry {
  id: string
  username: string
  wins: number
  games_played: number
  win_percentage: number
  rank: number
  total_time: number // in seconds
}

function formatPlayTime(seconds: number): string {
  if (!seconds) return "0h"
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (hours === 0) {
    return `${minutes}m`
  }
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`
}

export default function LeaderboardPage() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [timeframe, setTimeframe] = useState<"all" | "month" | "week">("all")
  const [sortBy, setSortBy] = useState<"wins" | "games" | "winrate" | "playtime">("wins")

  useEffect(() => {
    fetchLeaderboard()
  }, [timeframe, sortBy])

  async function fetchLeaderboard() {
    try {
      setIsLoading(true)
      setError(null)

      // Fetch leaderboard data from the API
      const response = await fetch(`/api/leaderboard?timeframe=${timeframe}&sort=${sortBy}`)

      if (!response.ok) {
        throw new Error("Failed to fetch leaderboard data")
      } 

      const data = await response.json()
      setLeaderboard(data)
    } catch (err) {
      console.error("Error fetching leaderboard:", err)
      setError("Failed to load leaderboard. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  async function handleRefresh() {
    setIsRefreshing(true)
    await fetchLeaderboard()
    setTimeout(() => setIsRefreshing(false), 500)
  }

  // Trophy colors
  const getTrophyColor = (rank: number) => {
    switch (rank) {
      case 1:
        return "#FFD700" 
      case 2:
        return "#C0C0C0" 
      case 3:
        return "#CD7F32" 
      default:
        return "#000000"
    }
  }

  // Loading skeleton component
  const LeaderboardSkeleton = () => (
    <>
      {/* Top 3 players skeleton */}
      <motion.div 
        className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        {[1, 2, 3].map((i) => (
          <div key={i} className="border-2 border-gray-200 rounded-lg overflow-hidden">
            <div className="p-6 flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-gray-200 animate-pulse mb-4"></div>
              <div className="h-6 w-36 bg-gray-200 animate-pulse mb-2 rounded"></div>
              <div className="h-8 w-24 bg-gray-200 animate-pulse my-2 rounded"></div>
              <div className="h-4 w-40 bg-gray-200 animate-pulse rounded"></div>
            </div>
          </div>
        ))}
      </motion.div>

      {/* Table skeleton */}
      <motion.div
        className="border-2 border-gray-200 rounded-lg overflow-hidden"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-100 border-b-2 border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left"><div className="h-5 w-10 bg-gray-200 animate-pulse rounded"></div></th>
                <th className="px-6 py-3 text-left"><div className="h-5 w-24 bg-gray-200 animate-pulse rounded"></div></th>                      <th className="px-6 py-3 text-right"><div className="h-5 w-16 bg-gray-200 animate-pulse rounded ml-auto"></div></th>
                <th className="px-6 py-3 text-right"><div className="h-5 w-16 bg-gray-200 animate-pulse rounded ml-auto"></div></th>
                <th className="px-6 py-3 text-right"><div className="h-5 w-20 bg-gray-200 animate-pulse rounded ml-auto"></div></th>
                <th className="px-6 py-3 text-right"><div className="h-5 w-20 bg-gray-200 animate-pulse rounded ml-auto"></div></th>
              </tr>
            </thead>
            <tbody>
              {[...Array(10)].map((_, i) => (
                <tr key={i} className="border-b border-gray-200">
                  <td className="px-6 py-4"><div className="h-5 w-6 bg-gray-200 animate-pulse rounded"></div></td>
                  <td className="px-6 py-4"><div className="h-5 w-32 bg-gray-200 animate-pulse rounded"></div></td>
                  <td className="px-6 py-4"><div className="h-5 w-10 bg-gray-200 animate-pulse rounded ml-auto"></div></td>
                  <td className="px-6 py-4"><div className="h-5 w-10 bg-gray-200 animate-pulse rounded ml-auto"></div></td>
                  <td className="px-6 py-4"><div className="h-5 w-12 bg-gray-200 animate-pulse rounded ml-auto"></div></td>
                  <td className="px-6 py-4"><div className="h-5 w-16 bg-gray-200 animate-pulse rounded ml-auto"></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </>
  )

  return (
    <motion.div
      className="bg-white min-h-screen p-4 md:p-8 font-[family-name:var(--font-geist-sans)]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <motion.header
        className="max-w-6xl mx-auto mb-8"
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
      >
        <div className="flex justify-between items-center">
          <Link href="/explore" className="flex items-center text-black">
            <motion.div className="flex" whileHover={{ x: -3 }} whileTap={{ scale: 0.95 }}>
              <FaArrowLeft className="mr-2" />
              <span>Back to Explore</span>
            </motion.div>
          </Link>
          <motion.div
            className="flex"
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
          >
            <h1 className="text-2xl font-bold text-black">CSGames</h1>
            <span className="text-black text-2xl">.dev</span>
          </motion.div>
        </div>
      </motion.header>

      <motion.main
        className="text-black max-w-6xl mx-auto"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        <motion.div
          className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
        >
          <div>
            <h2 className="text-3xl font-bold text-black mb-2">Leaderboard</h2>
            <p className="text-gray-600">Players with the most wins across all games</p>
          </div>

          <div className="flex items-center mt-4 md:mt-0">
            <button
              onClick={handleRefresh}
              className={`p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors mr-4 ${isRefreshing ? "animate-spin" : ""}`}
              aria-label="Refresh leaderboard"
              disabled={isRefreshing}
            >
              <FaSync className="text-black" />
            </button>

            <div className="flex flex-col sm:flex-row gap-2">
              <div className="flex border-2 border-black rounded-lg overflow-hidden">
                <button
                  onClick={() => setTimeframe("all")}
                  className={`px-3 py-1 ${timeframe === "all" ? "bg-black text-white" : "bg-white text-black"}`}
                >
                  All Time
                </button>
                <button
                  onClick={() => setTimeframe("month")}
                  className={`px-3 py-1 ${timeframe === "month" ? "bg-black text-white" : "bg-white text-black"}`}
                >
                  Month
                </button>
                <button
                  onClick={() => setTimeframe("week")}
                  className={`px-3 py-1 ${timeframe === "week" ? "bg-black text-white" : "bg-white text-black"}`}
                >
                  Week
                </button>
              </div>

              <div className="flex border-2 border-black rounded-lg overflow-hidden">
                <button
                  onClick={() => setSortBy("wins")}                  className={`px-3 py-1 ${sortBy === "wins" ? "bg-black text-white" : "bg-white text-black"}`}
                >
                  Wins
                </button>
                <button
                  onClick={() => setSortBy("games")}
                  className={`px-3 py-1 ${sortBy === "games" ? "bg-black text-white" : "bg-white text-black"}`}
                >
                  Games
                </button>
                <button
                  onClick={() => setSortBy("winrate")}
                  className={`px-3 py-1 ${sortBy === "winrate" ? "bg-black text-white" : "bg-white text-black"}`}
                >
                  Win Rate
                </button>
                <button
                  onClick={() => setSortBy("playtime")}
                  className={`px-3 py-1 ${sortBy === "playtime" ? "bg-black text-white" : "bg-white text-black"}`}
                >
                  Time
                </button>
              </div>
            </div>
          </div>
        </motion.div>

        {isLoading && !isRefreshing ? (
          <LeaderboardSkeleton />
        ) : error ? (
          <motion.div
            className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            {error}
          </motion.div>
        ) : (
          <>
            {leaderboard.length > 0 && (
              <motion.div
                className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ staggerChildren: 0.1 }}
              >
                {leaderboard.slice(0, 3).map((entry, index) => (
                  <motion.div
                    key={entry.id}
                    className="border-2 border-black rounded-lg overflow-hidden bg-white"
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{
                      delay: index * 0.05,
                      type: "spring",
                      damping: 20,
                      stiffness: 200,
                    }}
                    whileHover={{
                      y: -5,
                      boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
                    }}
                  >                    <div className="p-6 flex flex-col items-center text-center">                      <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                        <FaTrophy size={32} color={getTrophyColor(index + 1)} />
                      </div>                      <Link href={`/profile?userId=${entry.id}`} className="hover:underline">
                        <h3 className="text-xl font-bold">{entry.username}</h3>
                      </Link>
                      <p className="text-3xl font-bold my-2">
                        {sortBy === "wins" ? `${entry.wins} wins` :
                         sortBy === "games" ? `${entry.games_played} games` :
                         sortBy === "winrate" ? `${Math.round(entry.win_percentage)}%` :
                         formatPlayTime(entry.total_time)}
                      </p>
                      <p className="text-gray-600 text-sm">
                        {entry.games_played} games played • {Math.round(entry.win_percentage)}% win rate
                      </p>
                      <p className="text-gray-600 text-sm mt-1">
                        {formatPlayTime(entry.total_time)} total play time
                      </p>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            )}

            <motion.div
              className="border-2 border-black rounded-lg overflow-hidden"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ type: "spring", damping: 25, stiffness: 300, delay: 0.2 }}
            >
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-100 border-b-2 border-black">
                    <tr>                      <th className="px-6 py-3 text-left text-sm font-bold">Rank</th>
                      <th className="px-6 py-3 text-left text-sm font-bold">Player</th>
                      <th className="px-6 py-3 text-right text-sm font-bold">Wins</th>
                      <th className="px-6 py-3 text-right text-sm font-bold">Games</th>
                      <th className="px-6 py-3 text-right text-sm font-bold">Win Rate</th>
                      <th className="px-6 py-3 text-right text-sm font-bold">Play Time</th>
                    </tr>
                  </thead>
                  <tbody>                    {leaderboard.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                          No players found. Be the first to win a game!
                        </td>
                      </tr>
                    ) : (
                      leaderboard.map((entry, index) => (
                        <motion.tr
                          key={entry.id}
                          className={`border-b border-gray-200 ${index < 3 ? "bg-gray-50" : ""}`}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.1 + index * 0.03 }}
                          whileHover={{ backgroundColor: "#f9fafb" }}
                        >                          <td className="px-6 py-4">
                            <div className="flex items-center">
                              {index < 3 && <FaTrophy className="mr-2" color={getTrophyColor(index + 1)} />}
                              <span>{index + 1}</span>
                            </div>
                          </td>                          <td className="px-6 py-4 font-medium">
                            <Link href={`/profile?userId=${entry.id}`} className="hover:underline">
                              {entry.username}
                            </Link>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className={sortBy === "wins" ? "font-bold" : ""}>{entry.wins}</span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className={sortBy === "games" ? "font-bold" : ""}>{entry.games_played}</span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className={sortBy === "winrate" ? "font-bold" : ""}>{Math.round(entry.win_percentage)}%</span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className={sortBy === "playtime" ? "font-bold" : ""}>{formatPlayTime(entry.total_time)}</span>
                          </td>
                        </motion.tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </motion.div>
          </>
        )}
      </motion.main>
    </motion.div>
  )
}
