import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Create a Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(req: NextRequest) {
  try {
    // Create a Supabase admin client to bypass RLS
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { code } = await req.json();

    // Validate request
    if (!code) {
      return NextResponse.json(
        { error: 'Invitation code is required' },
        { status: 400 }
      );
    }

    // Find the invitation code in the database
    const { data: invite, error: inviteError } = await supabase
      .from('invite_codes')
      .select('id, lobby_id, expires_at, is_active')
      .eq('code', code)
      .single();

    if (inviteError) {
      // Check if error is about the table not existing
      if (inviteError.message.includes('relation "invite_codes" does not exist')) {
        return NextResponse.json(
          { error: 'Invitation system is not fully set up. The database table is missing.' },
          { status: 500 }
        );
      }
      
      return NextResponse.json(
        { error: 'Invalid invitation code' },
        { status: 404 }
      );
    }

    // Check if the code is active
    if (!invite.is_active) {
      return NextResponse.json(
        { error: 'Invitation code is no longer active' },
        { status: 400 }
      );
    }

    // Check if the code has expired
    if (new Date(invite.expires_at) < new Date()) {
      // Update the code to inactive
      await supabase
        .from('invite_codes')
        .update({ is_active: false })
        .eq('id', invite.id);

      return NextResponse.json(
        { error: 'Invitation code has expired' },
        { status: 400 }
      );
    }

    // Get lobby information
    const { data: lobby, error: lobbyError } = await supabase
      .from('lobbies')
      .select('id, game_id')
      .eq('id', invite.lobby_id)
      .single();

    if (lobbyError) {
      return NextResponse.json(
        { error: 'Lobby not found' },
        { status: 404 }
      );
    }

    // Get game information if available
    let gameName = "Game";
    if (lobby.game_id) {
      const { data: game } = await supabase
        .from('games')
        .select('title')
        .eq('id', lobby.game_id)
        .single();
      
      if (game) {
        gameName = game.title;
      }
    }

    // Return lobby information to join
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 
                   `https://${req.headers.get('host')}` || 
                   'https://csgames.dev';
                   
    return NextResponse.json({
      lobbyId: lobby.id,
      lobbyName: `${gameName} Lobby`,
      lobbyUrl: `${baseUrl}/lobby/${lobby.id}`,
    });
  } catch (error) {
    console.error('Error joining with code:', error);
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    );
  }
}