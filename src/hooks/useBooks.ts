
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
    cover_url?: string,
  ) => {
    if (!supabase) {
      return { error: 'Supabase has not been configured.' }
    }

    const { data, error } = await supabase
      .from('books')
      .insert({ title, author, cover_url })
      .select()
      .single()

    if (error) {
      return { error: error.message }
    }

    setBooks((previous) => [...previous, data])
    return { error: null, data }
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
