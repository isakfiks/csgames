import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = createRouteHandlerClient({ cookies })

  const { data, error } = await supabase
    .rpc('get_or_create_daily_word')

  if (error || !data) {
    return NextResponse.json({ error: 'Failed to fetch word' }, { status: 500 })
  }

  return NextResponse.json({ word: data })
}
