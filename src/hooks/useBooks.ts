
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Book } from '../types'

export function useBooks() {
  const [books, setBooks] = useState<Book[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchBooks = useCallback(async () => {
    if (!supabase) {
      setError('Supabase has not been configured.')
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const { data, error } = await supabase
      .from('books')
      .select('*')
      .order('title')

    if (error) {
      setError(error.message)
    } else {
      setBooks(data ?? [])
    }

    setLoading(false)
  }, [])

  const addBook = async (
    title: string,
    author: string,
    metadata: { cover_url?: string | null; genre?: string | null; description?: string | null; isbn?: string | null } = {},
  ) => {
    if (!supabase) {
      return { error: 'Supabase has not been configured.' }
    }

    let { data, error } = await supabase
      .from('books')
      .insert({ title, author, ...metadata })
      .select()
      .single()

    // Let book adding continue if the database migration has not been run yet.
    // Genre will persist once the `genre` column is added in Supabase.
    if (error?.message.toLowerCase().includes("'genre' column")) {
      const legacyMetadata = {
        cover_url: metadata.cover_url,
        description: metadata.description,
        isbn: metadata.isbn,
      }
      const retry = await supabase
        .from('books')
        .insert({ title, author, ...legacyMetadata })
        .select()
        .single()
      data = retry.data
      error = retry.error
    }

    if (error || !data) {
      return { error: error?.message ?? 'Could not add book.' }
    }

    const savedBook = data
    setBooks((previous) => [...previous, savedBook])
    return { error: null, data: savedBook }
  }

  useEffect(() => {
    fetchBooks()
  }, [fetchBooks])

  return {
    books,
    loading,
    error,
    addBook,
    refreshBooks: fetchBooks,
  }
}
