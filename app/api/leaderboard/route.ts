import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { type NextRequest, NextResponse } from "next/server"

// Cache
type CacheEntry = {
  data: any
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

    // Check if we have valid cached data
    const cacheEntry = cache[timeframe]
    const currentTime = Date.now()
    const cacheAge = currentTime - cacheEntry.lastUpdated

    if (cacheEntry.data && cacheEntry.refreshCount < REFRESH_THRESHOLD && cacheAge < CACHE_TTL) {
      // Increment the refresh counter
      cacheEntry.refreshCount++
      console.log(`Using cached data for ${timeframe}. Refresh count: ${cacheEntry.refreshCount}`)

      return NextResponse.json(cacheEntry.data)
    }

    // If we're here, we need to fetch fresh data
    console.log(`Fetching fresh data for ${timeframe}`)
    const supabase = createRouteHandlerClient({ cookies })

    let dateFilter = ""
    if (timeframe === "week") {
      dateFilter = "AND gw.created_at > now() - interval '7 days'"
    } else if (timeframe === "month") {
      dateFilter = "AND gw.created_at > now() - interval '30 days'"
    }

    // Get the leaderboard data
    const { data, error } = await supabase.rpc("get_leaderboard", {
      time_filter: dateFilter,
    })

    if (error) {
      console.error("Error fetching leaderboard:", error)
      return NextResponse.json({ error: "Failed to fetch leaderboard" }, { status: 500 })
    }

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
