import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { type NextRequest, NextResponse } from "next/server"

type LeaderboardData = {
  id: string; 
  username: string;
  wins: number;
  games_played: number;
  win_percentage: number;
  rank: number;
  total_time: number;
}

// Cache
type CacheEntry = {
  data: unknown
  refreshCount: number
  lastUpdated: number
}

const cache: Record<string, CacheEntry> = {}

const REFRESH_THRESHOLD = 10 // Refresh after 10 req
const CACHE_TTL = 5 * 60 * 1000 // 5 mins in milliseconds

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const timeframe = searchParams.get("timeframe") || "all"
    const userId = searchParams.get("userId")
    const sortBy = searchParams.get("sort") || "wins"    
    const cacheKey = `${timeframe}-${sortBy}`

    const convertLeaderboardData = (data: Array<Omit<LeaderboardData, "id"> & { id: string | number }>): LeaderboardData[] => {
      return data.map(entry => ({
        ...entry,
        id: entry.id.toString()
      }))
    }

    if (!cache[cacheKey]) {
      cache[cacheKey] = { data: null, refreshCount: 0, lastUpdated: 0 }
    }

    // Check if cached data can be used
    const now = Date.now()
    const cacheEntry = cache[cacheKey]
    const isCacheValid = cacheEntry.data && 
      cacheEntry.refreshCount < REFRESH_THRESHOLD && 
      now - cacheEntry.lastUpdated < CACHE_TTL

    if (userId) {
      const cookieStore = cookies()
      const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
      
      const { data: leaderboardData, error } = await supabase.rpc('get_leaderboard', {
        time_filter: timeframe,
        sort_by: sortBy
      });
      
      if (error) {
        console.error("Leaderboard error:", error);
        return NextResponse.json({ 
          error: "Failed to fetch user leaderboard data", 
          details: "The database function is returning a UUID type that doesn't match the expected text type. Please update your database function to cast the ID to text using id::text.",
          originalError: error 
        }, { status: 500 })
      }
      
      // Rest of the code remains the same
      const data = convertLeaderboardData(leaderboardData || [])
      const entry = data.find((e) => e.id === userId)
      
      if (!entry) {
        return NextResponse.json({ error: "User not found in leaderboard" }, { status: 404 })
      }
      return NextResponse.json(entry)
    }

    if (isCacheValid) {
      cacheEntry.refreshCount++
      console.log(`Using cached data for ${cacheKey}. Refresh count: ${cacheEntry.refreshCount}`)
      return NextResponse.json(cacheEntry.data)
    }

    // If we're here, we need to fetch fresh data
    console.log(`Fetching fresh data for ${cacheKey}`)
    const cookieStore = cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    
    const { data: leaderboardData, error } = await supabase.rpc('get_leaderboard', {
      time_filter: timeframe,
      sort_by: sortBy
    });

    if (error) {
      console.error("Error fetching leaderboard:", error)
      
      return NextResponse.json({ 
        error: "Failed to fetch leaderboard", 
        details: "Fail.",
        originalError: error 
      }, { status: 500 })
    }

    const data = convertLeaderboardData(leaderboardData || [])

    // Update the cache
    cache[cacheKey] = {
      data,
      refreshCount: 1,
      lastUpdated: Date.now(),
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error("Error in leaderboard API:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
