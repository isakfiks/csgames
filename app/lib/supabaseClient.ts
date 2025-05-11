// lib/supabaseClient.ts
import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/supabase';

// Make sure these environment variables are defined
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Validate URLs before creating the client
let validUrl = false;
try {
  if (supabaseUrl) {
    new URL(supabaseUrl); // This will throw if invalid
    validUrl = true;
  }
} catch (error) {
  console.error('Invalid Supabase URL:', error);
}

// Only create the client if we have valid values
export const supabase = validUrl && supabaseAnonKey
  ? createClient<Database>(supabaseUrl, supabaseAnonKey)
  : null;