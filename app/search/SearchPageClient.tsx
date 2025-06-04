"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { FaArrowLeft, FaClock, FaGamepad, FaSearch } from "react-icons/fa"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"

interface SearchResults {
  users: {
    id: string
    username: string
    avatar_url: string | null
    bio: string | null
    favorite_game: string | null
    hours_played: number
  }[]
  pagination: {
    total: number
    page: number
    limit: number
    hasMore: boolean
  }
}

export default function SearchPageClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const query = searchParams.get("q") || ""
  const [searchQuery, setSearchQuery] = useState(query)
  const [results, setResults] = useState<SearchResults | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(0)

  const performSearch = async (newPage?: number) => {
    if (!searchQuery.trim()) return

    try {
      setIsLoading(true)
      setError(null)
      const currentPage = typeof newPage === 'number' ? newPage : page
      const response = await fetch(`/api/users/search?q=${encodeURIComponent(searchQuery)}&page=${currentPage}&limit=10`)
      
      if (!response.ok) {
        throw new Error("Search failed")
      }

      const data = await response.json()
      if (newPage === 0) {
        setResults(data)
      } else {
        setResults(prev => ({
          users: [...(prev?.users || []), ...data.users],
          pagination: data.pagination
        }))
      }
      setPage(currentPage)
    } catch (err) {
      setError("Failed to search users")
      console.error("Search error:", err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (query) {
      performSearch(0)
    }
  }, [query])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery)}`)
      performSearch(0)
    }
  }

  const loadMore = () => {
    if (results?.pagination.hasMore) {
      performSearch(page + 1)
    }
  }

  return (
    <div className="text-black bg-white min-h-screen p-8 font-[family-name:var(--font-geist-sans)]">
      <div className="max-w-4xl mx-auto">
        <header className="mb-8">
          <div className="flex justify-between items-center">
            <Link href="/explore" className="flex items-center text-black">
              <FaArrowLeft className="mr-2" />
              <span>Back to Games</span>
            </Link>
            <Link href="/explore">
            <div className="flex">
              <h1 className="text-2xl font-bold text-black">CSGames</h1>
              <span className="text-black text-2xl">.dev</span>
            </div>
            </Link>
          </div> 
        </header>

        <main>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="space-y-6"
          >
            <form onSubmit={handleSearch} className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search users..."
                className="w-full px-6 py-4 pr-12 text-lg rounded-xl border-2 border-black focus:outline-none focus:ring-2 focus:ring-black"
              />
              <button
                type="submit"
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-black"
              >
                <FaSearch size={20} />
              </button>
            </form>

            {isLoading && !results && (
              <div className="flex justify-center py-8">
                <div className="w-12 h-12 border-4 border-black border-t-transparent rounded-full animate-spin"></div>
              </div>
            )}

            {error && (
              <div className="text-center py-8">
                <p className="text-red-500">{error}</p>
              </div>
            )}

            {results && results.users.length === 0 && (
              <div className="text-center py-8">
                <p className="text-gray-500">No users found</p>
              </div>
            )}

            {results && results.users.length > 0 && (
              <div className="space-y-4">
                <p className="text-gray-500">Found {results.pagination.total} users</p>
                <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
                  {results.users.map((user) => (
                    <Link
                      key={user.id}
                      href={`/profile?userId=${user.id}`}
                      className="block"
                    >
                      <motion.div
                        whileHover={{ scale: 1.02 }}
                        className="p-4 rounded-xl border-2 border-black hover:bg-gray-50"
                      >
                        <div className="flex items-center space-x-4">
                          <div className="w-16 h-16 rounded-lg overflow-hidden border-2 border-black">
                            <img
                              src={user.avatar_url || `https://api.dicebear.com/7.x/pixel-art/svg?seed=${user.username}`}
                              alt={user.username}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="flex-1">
                            <h3 className="font-bold text-lg">{user.username}</h3>
                            {user.bio && (
                              <p className="text-gray-600 text-sm line-clamp-2">{user.bio}</p>
                            )}
                            <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                              {user.favorite_game && (
                                <div className="flex items-center gap-1">
                                  <FaGamepad className="text-gray-400" />
                                  <span>{user.favorite_game}</span>
                                </div>
                              )}
                              <div className="flex items-center gap-1">
                                <FaClock className="text-gray-400" />
                                <span>{user.hours_played || 0} hours</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    </Link>
                  ))}
                </div>

                {results.pagination.hasMore && (
                  <div className="flex justify-center pt-4">
                    <button
                      onClick={loadMore}
                      disabled={isLoading}
                      className="px-6 py-2 rounded-lg bg-black text-white hover:bg-gray-800 disabled:opacity-50"
                    >
                      {isLoading ? "Loading..." : "Load More"}
                    </button>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </main>
      </div>
    </div>
  )
}
