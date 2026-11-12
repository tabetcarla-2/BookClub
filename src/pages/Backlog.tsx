import { useEffect, useState } from 'react'
import BookCard from '../components/BookCard'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useBooks } from '../hooks/useBooks'
import type { Book } from '../types'
import styles from './Backlog.module.css'

const demoBooks: Book[] = [
  { id: 'demo-1', title: 'The Secret History', author: 'Donna Tartt' },
  { id: 'demo-2', title: 'Normal People', author: 'Sally Rooney' },
  { id: 'demo-3', title: 'Tomorrow, and Tomorrow, and Tomorrow', author: 'Gabrielle Zevin' },
  { id: 'demo-4', title: 'The Bell Jar', author: 'Sylvia Plath' },
]

function Backlog() {
  const { user } = useAuth()
  const { books: catalog, addBook } = useBooks()
  const [bookTitle, setBookTitle] = useState('')
  const [books, setBooks] = useState<Book[]>(demoBooks)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function loadBacklog() {
      if (!supabase || !user) return
      const { data, error: fetchError } = await supabase
        .from('backlog_items')
        .select('book_id')
        .or(`user_id.eq.${user.id},visibility.eq.club`)

      if (fetchError) {
        setError(fetchError.message)
        return
      }

      const ids = new Set((data ?? []).map((item) => item.book_id))
      const matchingBooks = catalog.filter((book) => ids.has(book.id))
      // Once Supabase is active, the database is the source of truth—even
      // when the saved backlog is empty. The demo list is only for offline use.
      setBooks(matchingBooks)
    }

    loadBacklog()
  }, [catalog, user])

  async function addBookToBacklog() {
    const title = bookTitle.trim()
    if (!title || saving) return
    setSaving(true)
    setError('')

    if (!supabase || !user) {
      setBooks((previous) => [...previous, { id: `demo-${Date.now()}`, title, author: 'Author to be added' }])
      setBookTitle('')
      setSaving(false)
      return
    }

    const existing = catalog.find((book) => book.title.toLowerCase() === title.toLowerCase())
    const bookResult = existing
      ? { data: existing, error: null }
      : await addBook(title, 'Author to be added')

    if (bookResult.error || !bookResult.data) {
      setError(bookResult.error ?? 'Could not add that book.')
      setSaving(false)
      return
    }

    const { error: insertError } = await supabase.from('backlog_items').insert({
      user_id: user.id,
      book_id: bookResult.data.id,
      visibility: 'club',
    })

    if (insertError && insertError.code !== '23505') setError(insertError.message)
    else setBooks((previous) => [...previous.filter((book) => book.id !== bookResult.data.id), bookResult.data])
    setBookTitle('')
    setSaving(false)
  }

  async function removeBook(book: Book) {
    if (supabase && user && !book.id.startsWith('demo-')) {
      await supabase.from('backlog_items').delete().eq('book_id', book.id).eq('user_id', user.id)
    }
    setBooks((previous) => previous.filter((item) => item.id !== book.id))
  }

  return (
    <section className={styles.page}>
      <p className="eyebrow">THE NEVER-ENDING LIST</p>
      <h1>Books to <em>discover.</em></h1>
      <p className={styles.description}>All the stories waiting for their turn on your bookshelf.</p>

      <div className={styles.form}>
        <input type="text" placeholder="Add a book to your TBR..." value={bookTitle} onChange={(e) => setBookTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addBookToBacklog()} />
        <button className="primary-button" onClick={addBookToBacklog} disabled={saving}>{saving ? 'Adding...' : '+ Add book'}</button>
      </div>

      {error && <p className={styles.error}>{error}</p>}
      <p className="eyebrow">{books.length} BOOKS ON YOUR LIST</p>
      {books.length > 0 ? <div className={styles.grid}>{books.map((book) => <BookCard key={book.id} title={book.title} author={book.author} cover={book.cover_url} onRemove={() => removeBook(book)} />)}</div> : <p className={styles.empty}>Your reading list is empty. Time to discover something new!</p>}
    </section>
  )
}

export default Backlog
