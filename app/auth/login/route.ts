import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { provider } = await request.json()

    if (!provider) {
      return NextResponse.json({ error: "Provider is required" }, { status: 400 })
    }

    const cookieStore = cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

    // Get url for callback
    const requestUrl = new URL(request.url)
    const callbackUrl = new URL("/auth/callback", requestUrl.origin)

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: callbackUrl.toString(),
      },
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ url: data.url })
  } catch (error) {
    console.error("Auth error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
