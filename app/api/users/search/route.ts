import { NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function GET(request: Request) {
  try {
    const cookieStore = cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')
    const limit = Number(searchParams.get('limit')) || 10
    const page = Number(searchParams.get('page')) || 0

    if (!query) {
      return NextResponse.json({ error: 'Search query is required' }, { status: 400 })
    }

    await supabase.auth.getSession()

    const offset = page * limit

    const { data: users, error, count } = await supabase
      .from('profiles')
      .select('id, username, avatar_url, bio, favorite_game, hours_played', { count: 'exact' })
      .ilike('username', `%${query}%`)
      .order('username', { ascending: true })
      .range(offset, offset + limit - 1)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      users,
      pagination: {
        total: count || 0,
        page,
        limit,
        hasMore: count ? offset + limit < count : false
      }
    })
  } catch (error) {
    console.error('Search error:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}
