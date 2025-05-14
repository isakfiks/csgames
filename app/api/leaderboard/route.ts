import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const timeframe = searchParams.get("timeframe") || "all"

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

    return NextResponse.json(data)
  } catch (error) {
    console.error("Error in leaderboard API:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
