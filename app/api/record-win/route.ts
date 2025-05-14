import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { gameStateId, winnerId } = await request.json()

    if (!gameStateId || !winnerId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const supabase = createRouteHandlerClient({ cookies })

    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: gameState, error: gameStateError } = await supabase
      .from("game_states")
      .select("id, status, winner, player1, player2")
      .eq("id", gameStateId)
      .single()

    if (gameStateError || !gameState) {
      return NextResponse.json({ error: "Game state not found" }, { status: 404 })
    }

    // Must match these criterias to count as a "VALID" win
    if (gameState.status === "finished") {
      return NextResponse.json({ error: "Game is already finished" }, { status: 400 })
    }

    if (winnerId !== gameState.player1 && winnerId !== gameState.player2) {
      return NextResponse.json({ error: "Winner must be a player in the game" }, { status: 400 })
    }

    if (session.user.id !== gameState.player1 && session.user.id !== gameState.player2) {
      return NextResponse.json({ error: "Only players in the game can record a win" }, { status: 403 })
    }

    // Update the game state to record win
    const { error: updateError } = await supabase
      .from("game_states")
      .update({
        status: "finished",
        winner: winnerId,
      })
      .eq("id", gameStateId)

    if (updateError) {
      return NextResponse.json({ error: "Failed to update game state" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error recording win:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
