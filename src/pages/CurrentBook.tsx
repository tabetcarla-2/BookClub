import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import type { Book } from '../types'
import styles from './CurrentBook.module.css'

const demoBook: Book = { id: 'demo-current', title: 'The Great Gatsby', author: 'F. Scott Fitzgerald', description: 'A story of love, ambition, wealth and the American Dream.' }

function CurrentBook() {
  const { user } = useAuth()
  const [book, setBook] = useState<Book>(demoBook)
  const [progress, setProgress] = useState(45)
  const [status, setStatus] = useState<'reading' | 'paused' | 'skipping' | 'completed'>('reading')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    async function loadCurrentBook() {
      if (!supabase || !user) return
      const { data: current } = await supabase.from('club_books').select('book_id').eq('is_current', true).limit(1).maybeSingle()
      if (!current) return

      const [{ data: selectedBook }, { data: savedProgress }] = await Promise.all([
        supabase.from('books').select('*').eq('id', current.book_id).single(),
        supabase.from('reading_progress').select('progress, status').eq('user_id', user.id).eq('book_id', current.book_id).maybeSingle(),
      ])
      if (selectedBook) setBook(selectedBook)
      if (savedProgress) {
        setProgress(savedProgress.progress)
        if (savedProgress.status !== 'want_to_read') setStatus(savedProgress.status)
      }
    }
    loadCurrentBook()
  }, [user])

  async function saveProgress(nextProgress = progress, nextStatus = status) {
    setProgress(nextProgress)
    setStatus(nextStatus)
    setSaved(false)
    if (supabase && user && !book.id.startsWith('demo-')) {
      await supabase.from('reading_progress').upsert({ user_id: user.id, book_id: book.id, progress: nextProgress, status: nextStatus, updated_at: new Date().toISOString() }, { onConflict: 'user_id,book_id' })
    }
    setSaved(true)
  }

  return (
    <section className={styles.page}>
      <p className="eyebrow">OUR BOOK OF THE MONTH</p>
      <h1>Currently <em>reading.</em></h1>

      <div className={styles.book}>
        {book.cover_url ? <img className={styles.cover} src={book.cover_url} alt={`Cover of ${book.title}`} /> : <div className={styles.cover}><span>{book.title.toUpperCase()}</span><small>{book.author.toUpperCase()}</small></div>}
        <div className={styles.info}>
          <p className="eyebrow">THIS MONTH'S BOOK PICK</p>
          <h2>{book.title}</h2>
          <p className={styles.muted}>{book.author}</p>
          <p>{book.description ?? 'Read along with the club and bring your favourite passages to our next discussion.'}</p>
          <div className={styles.progressLabel}><span>My reading progress</span><strong>{progress}%</strong></div>
          <input type="range" min="0" max="100" value={progress} onChange={(e) => saveProgress(Number(e.target.value))} />
          <div className={styles.statuses}>
            {(['reading', 'paused', 'skipping', 'completed'] as const).map((option) => <button key={option} type="button" className={status === option ? styles.selectedStatus : ''} onClick={() => saveProgress(progress, option)}>{option}</button>)}
          </div>
          <p className={styles.muted}>{saved ? 'Progress saved to your club profile.' : 'Changes save automatically.'}</p>
        </div>
      </div>

      <div className={styles.discussion}><p className="eyebrow">LET'S TALK ABOUT IT</p><h2>Book club discussions</h2><p className={styles.muted}>Share chapter discussions, favourite quotes, questions and reviews with the club.</p></div>
    </section>
  )
}

export default CurrentBook
