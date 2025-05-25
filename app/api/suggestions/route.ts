import { NextResponse } from 'next/server'

const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL

export async function POST(request: Request) {
  try {
    const { suggestion, type, username } = await request.json()

    if (!DISCORD_WEBHOOK_URL) {
      return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 })
    }

    const message = {
      embeds: [{
        title: `New ${type} Suggestion`,
        description: suggestion,
        color: type === 'game' ? 0x00ff00 : 0x0099ff,
        fields: [{
          name: 'Submitted By',
          value: username || 'Anonymous User',
          inline: true
        }],
        timestamp: new Date().toISOString()
      }]
    }

    const response = await fetch(DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message)
    })

    if (!response.ok) {
      throw new Error('Failed to send to Discord')
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to send suggestion' }, { status: 500 })
  }
}
