
export interface Profile {
  id: string
  username: string
  full_name: string
  avatar_url?: string
  bio?: string
  created_at: string
}

export interface Book {
  id: string
  title: string
  author: string
  cover_url?: string
  description?: string
  isbn?: string
}

export interface BacklogItem {
  id: string
  user_id: string
  book_id: string
  visibility: 'personal' | 'club'
  created_at: string
}

export interface ReadingProgress {
  id: string
  user_id: string
  book_id: string
  progress: number
  status: 'want_to_read' | 'reading' | 'completed'
  updated_at: string
}

export interface Review {
  id: string
  user_id: string
  book_id: string
  rating: number
  content: string
  created_at: string
}
