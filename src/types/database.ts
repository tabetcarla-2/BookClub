
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
      profiles: {
        Row: {
          id: string
          username: string
          full_name: string
          avatar_url: string | null
          bio: string | null
          created_at: string
        }
        Insert: {
          id: string
          username: string
          full_name: string
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
        }
        Update: {
          username?: string
          full_name?: string
          avatar_url?: string | null
          bio?: string | null
        }
        Relationships: []
      }

      books: {
        Row: {
          id: string
          title: string
          author: string
          cover_url: string | null
          description: string | null
          isbn: string | null
          created_at: string
        }
        Insert: {
          id?: string
          title: string
          author: string
          cover_url?: string | null
          description?: string | null
          isbn?: string | null
          created_at?: string
        }
        Update: {
          title?: string
          author?: string
          cover_url?: string | null
          description?: string | null
          isbn?: string | null
        }
        Relationships: []
      }

      backlog_items: {
        Row: {
          id: string
          user_id: string
          book_id: string
          visibility: 'personal' | 'club'
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          book_id: string
          visibility?: 'personal' | 'club'
          created_at?: string
        }
        Update: {
          visibility?: 'personal' | 'club'
        }
        Relationships: []
      }

      reading_progress: {
        Row: {
          id: string
          user_id: string
          book_id: string
          progress: number
          status: 'want_to_read' | 'reading' | 'completed'
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          book_id: string
          progress?: number
          status?: 'want_to_read' | 'reading' | 'completed'
          updated_at?: string
        }
        Update: {
          progress?: number
          status?: 'want_to_read' | 'reading' | 'completed'
          updated_at?: string
        }
        Relationships: []
      }
    }

    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
