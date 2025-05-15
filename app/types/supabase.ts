export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      messages: {
        Row: {
          id: string
          created_at: string
          user_id: string
          username: string
          message: string
          room_id: string
        }
        Insert: {
          id?: string
          created_at?: string
          user_id: string
          username: string
          message: string
          room_id: string
        }
        Update: {
          id?: string
          created_at?: string
          user_id?: string
          username?: string
          message?: string
          room_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      },
      
      // Add the invite_codes table
      invite_codes: {
        Row: {
          id: string
          code: string
          lobby_id: string
          created_at: string
          expires_at: string
          used_by?: string[]
          is_active: boolean
        }
        Insert: {
          id?: string
          code: string
          lobby_id: string
          created_at?: string
          expires_at: string
          used_by?: string[]
          is_active?: boolean
        }
        Update: {
          id?: string
          code?: string
          lobby_id?: string
          created_at?: string
          expires_at?: string
          used_by?: string[]
          is_active?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "invite_codes_lobby_id_fkey"
            columns: ["lobby_id"]
            referencedRelation: "lobbies"
            referencedColumns: ["id"]
          }
        ]
      },
      
      // Add a placeholder for the lobbies table if it exists
      lobbies: {
        Row: {
          id: string
          created_at: string
          creator_id: string
          name: string
          // Add other fields your lobbies table has
        }
        Insert: {
          id?: string
          created_at?: string
          creator_id: string
          name: string
          // Add other fields your lobbies table has
        }
        Update: {
          id?: string
          created_at?: string
          creator_id?: string
          name?: string
          // Add other fields your lobbies table has
        }
        Relationships: [
          {
            foreignKeyName: "lobbies_creator_id_fkey"
            columns: ["creator_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      
      // Add other tables here as needed
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// Helper types for better type inference when using Supabase client
export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type TablesInsert<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert']
export type TablesUpdate<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update']

// Specific types for easier usage
export type InviteCode = Tables<'invite_codes'>
export type Lobby = Tables<'lobbies'>
export type Message = Tables<'messages'>