import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { type NextRequest, NextResponse } from "next/server"

// Cache
type CacheEntry = {
  data: unknown
  refreshCount: number
  lastUpdated: number
}

const cache: Record<string, CacheEntry> = {
  all: { data: null, refreshCount: 0, lastUpdated: 0 },
  week: { data: null, refreshCount: 0, lastUpdated: 0 },
  month: { data: null, refreshCount: 0, lastUpdated: 0 },
}

const REFRESH_THRESHOLD = 10 // Refresh after 10 req
const CACHE_TTL = 5 * 60 * 1000 // 5 mins in milliseconds

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const timeframe = searchParams.get("timeframe") || "all"
    const userId = searchParams.get("userId")

    type LeaderboardData = {
      id: string;
      username: string;
      wins: number;
      games_played: number;
      win_percentage: number;
      rank: number;
      total_time: number;
    }

    if (userId) {
      const cookieStore = cookies()
      const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
      const { data: leaderboardData, error } = await supabase.rpc("get_leaderboard", { time_filter: timeframe })
      
      if (error) {
        console.error("Leaderboard error:", error);
        return NextResponse.json({ error: "Failed to fetch leaderboard" }, { status: 500 })
      }

      const data = leaderboardData as LeaderboardData[]
      const entry = data.find((e) => e.id === userId)
      
      if (!entry) {
        return NextResponse.json({ error: "User not found in leaderboard" }, { status: 404 })
      }
      return NextResponse.json(entry)
    }

    // Check if we have valid cached data
    const cacheEntry = cache[timeframe]
    const currentTime = Date.now()
    const cacheAge = currentTime - cacheEntry.lastUpdated

    if (cacheEntry.data && cacheEntry.refreshCount < REFRESH_THRESHOLD && cacheAge < CACHE_TTL) {
      cacheEntry.refreshCount++
      console.log(`Using cached data for ${timeframe}. Refresh count: ${cacheEntry.refreshCount}`)
      return NextResponse.json(cacheEntry.data)
    }

    // If we're here, we need to fetch fresh data
    console.log(`Fetching fresh data for ${timeframe}`)
    const cookieStore = cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    const { data: leaderboardData, error } = await supabase.rpc("get_leaderboard", {
      time_filter: timeframe
    });

    if (error) {
      console.error("Error fetching leaderboard:", error)
      return NextResponse.json({ error: "Failed to fetch leaderboard" }, { status: 500 })
    }

    const data = leaderboardData as LeaderboardData[]

    // Update the cache
    cache[timeframe] = {
      data,
      refreshCount: 1,
      lastUpdated: currentTime,
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error("Error in leaderboard API:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
