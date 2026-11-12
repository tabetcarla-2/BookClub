export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]
type EmptyUpdate = Record<string, never>

export interface Database {
  public: {
    Tables: {
      profiles: { Row: { id: string; username: string; full_name: string; avatar_url: string | null; bio: string | null; created_at: string }; Insert: { id: string; username: string; full_name: string; avatar_url?: string | null; bio?: string | null; created_at?: string }; Update: { username?: string; full_name?: string; avatar_url?: string | null; bio?: string | null }; Relationships: [] }
      clubs: { Row: { id: string; name: string; created_by: string; created_at: string }; Insert: { id?: string; name: string; created_by: string; created_at?: string }; Update: { name?: string }; Relationships: [] }
      club_members: { Row: { club_id: string; user_id: string; role: 'member' | 'admin'; joined_at: string }; Insert: { club_id: string; user_id: string; role?: 'member' | 'admin'; joined_at?: string }; Update: { role?: 'member' | 'admin' }; Relationships: [] }
      books: { Row: { id: string; title: string; author: string; cover_url: string | null; description: string | null; isbn: string | null; created_at: string }; Insert: { id?: string; title: string; author: string; cover_url?: string | null; description?: string | null; isbn?: string | null; created_at?: string }; Update: { title?: string; author?: string; cover_url?: string | null; description?: string | null; isbn?: string | null }; Relationships: [] }
      club_books: { Row: { id: string; club_id: string; book_id: string; starts_on: string | null; ends_on: string | null; is_current: boolean; created_at: string }; Insert: { id?: string; club_id: string; book_id: string; starts_on?: string | null; ends_on?: string | null; is_current?: boolean; created_at?: string }; Update: { starts_on?: string | null; ends_on?: string | null; is_current?: boolean }; Relationships: [] }
      backlog_items: { Row: { id: string; user_id: string; book_id: string; visibility: 'personal' | 'club'; created_at: string }; Insert: { id?: string; user_id: string; book_id: string; visibility?: 'personal' | 'club'; created_at?: string }; Update: { visibility?: 'personal' | 'club' }; Relationships: [] }
      backlog_votes: { Row: { backlog_item_id: string; user_id: string; created_at: string }; Insert: { backlog_item_id: string; user_id: string; created_at?: string }; Update: EmptyUpdate; Relationships: [] }
      reading_progress: { Row: { id: string; user_id: string; book_id: string; progress: number; status: 'want_to_read' | 'reading' | 'paused' | 'skipping' | 'completed'; updated_at: string }; Insert: { id?: string; user_id: string; book_id: string; progress?: number; status?: 'want_to_read' | 'reading' | 'paused' | 'skipping' | 'completed'; updated_at?: string }; Update: { progress?: number; status?: 'want_to_read' | 'reading' | 'paused' | 'skipping' | 'completed'; updated_at?: string }; Relationships: [] }
      venues: { Row: { id: string; club_id: string; name: string; address: string | null; notes: string | null; suggested_by: string; created_at: string }; Insert: { id?: string; club_id: string; name: string; address?: string | null; notes?: string | null; suggested_by: string; created_at?: string }; Update: { name?: string; address?: string | null; notes?: string | null }; Relationships: [] }
      events: { Row: { id: string; club_id: string; title: string; starts_at: string; venue_id: string | null; notes: string | null; created_by: string; created_at: string }; Insert: { id?: string; club_id: string; title: string; starts_at: string; venue_id?: string | null; notes?: string | null; created_by: string; created_at?: string }; Update: { title?: string; starts_at?: string; venue_id?: string | null; notes?: string | null }; Relationships: [] }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
