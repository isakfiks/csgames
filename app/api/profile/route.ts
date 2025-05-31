import { NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function GET(request: Request) {
  try {
    const cookieStore = cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    const {
      data: { session },
    } = await supabase.auth.getSession()
    
    const query = supabase
      .from('profiles')
      .select('*')

    if (userId) {
      query.eq('id', userId)
    } else {
      if (!session) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
      }
      query.eq('id', session.user.id)
    }

    const { data: profile, error } = await query.single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (userId && (!session || userId !== session.user.id)) {
      const publicProfile = {
        id: profile.id,
        username: profile.username,
        bio: profile.bio,
        avatar_url: profile.avatar_url,
        favorite_game: profile.favorite_game,
        hours_played: profile.hours_played,
      }
      return NextResponse.json(publicProfile)
    }

    return NextResponse.json(profile)
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request) {
  try {
    const cookieStore = cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const body = await request.json()
    const { username, bio, avatar_url, favorite_game } = body

    if (username) {
      const { data: currentProfile } = await supabase
        .from('profiles')
        .select('username, username_updated_at')
        .eq('id', session.user.id)
        .single()

      if (currentProfile && currentProfile.username !== username) {
        if (currentProfile.username_updated_at) {
          const lastUpdate = new Date(currentProfile.username_updated_at)
          const cooldownEnd = new Date(lastUpdate.getTime() + 7 * 24 * 60 * 60 * 1000) // 7 days
          const now = new Date()

          if (now < cooldownEnd) {
            return NextResponse.json(
              { error: 'Username can only be changed every 7 days' },
              { status: 429 }
            )
          }
        }

        const { data, error } = await supabase
          .from('profiles')
          .update({
            username: username,
            bio: bio,
            avatar_url: avatar_url,
            favorite_game: favorite_game,
            username_updated_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', session.user.id)
          .select()
          .single()

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json(data)
      }
    }

    const { data, error } = await supabase
      .from('profiles')
      .update({
        bio: bio,
        avatar_url: avatar_url,
        favorite_game: favorite_game,
        updated_at: new Date().toISOString(),
      })
      .eq('id', session.user.id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}
