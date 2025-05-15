import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// Create a Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(req: NextRequest) {
  try {
    // Create a Supabase admin client to bypass RLS
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { lobbyId } = await req.json();

    // Validate request
    if (!lobbyId) {
      return NextResponse.json(
        { error: 'Lobby ID is required' },
        { status: 400 }
      );
    }

    // Check if lobby exists
    const { data: lobby, error: lobbyError } = await supabase
      .from('lobbies')
      .select('id, created_by')
      .eq('id', lobbyId)
      .single();

    if (lobbyError) {
      console.error('Error checking lobby:', lobbyError);
      return NextResponse.json(
        { error: 'Lobby not found' },
        { status: 404 }
      );
    }

    // Generate a unique 6-character code
    const code = crypto.randomBytes(3).toString('hex').toUpperCase();

    // Store the invitation code in Supabase
    const { data: invite, error: inviteError } = await supabase
      .from('invite_codes')
      .insert({
        code,
        lobby_id: lobbyId,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
        is_active: true
      })
      .select()
      .single();

    if (inviteError) {
      console.error('Error creating invite code:', inviteError);
      
      // Check if error is about the table not existing
      if (inviteError.message.includes('relation "invite_codes" does not exist')) {
        return NextResponse.json(
          { error: 'Invitation system is not fully set up. The database table is missing.' },
          { status: 500 }
        );
      }
      
      return NextResponse.json(
        { error: 'Failed to create invitation code' },
        { status: 500 }
      );
    }

    // Return the code and URLs
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 
                    `https://${req.headers.get('host')}` || 
                    'https://csgames.dev';
                    
    return NextResponse.json({
      code,
      fullUrl: `${baseUrl}/join/${code}`,
      lobbyUrl: `${baseUrl}/lobby/${lobbyId}`,
    });
  } catch (error) {
    console.error('Error generating invitation code:', error);
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    );
  }
}