import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import type { Book } from '../types'
import coverImage from '../assets/husbands-secret-cover.png'
import styles from './CurrentBook.module.css'

type ReadingStatus = 'reading' | 'skipping' | 'completed'
type ProgressMode = 'percent' | 'pages' | 'chapters'

const demoBook: Book = {
  id: 'demo-current', title: "A Husband's Secret", author: 'Liane Moriarty', cover_url: coverImage,
  description: 'A page-turning story about secrets, marriage, and the things we keep from the people closest to us. When a woman discovers a letter her husband wrote for her to read after his death, a private secret begins to reshape the lives of everyone around them. It is a sharp, emotional look at love, friendship, and the stories we tell ourselves.',
}

function CurrentBook() {
  const { user } = useAuth()
  const [book, setBook] = useState<Book>(demoBook)
  const [progress, setProgress] = useState(45)
  const [status, setStatus] = useState<ReadingStatus>('reading')
  const [mode, setMode] = useState<ProgressMode>('percent')
  const [currentPages, setCurrentPages] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [currentChapter, setCurrentChapter] = useState(0)
  const [totalChapters, setTotalChapters] = useState(0)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [reviewRating, setReviewRating] = useState(4)
  const [reviewComment, setReviewComment] = useState('')
  const [reviewSaved, setReviewSaved] = useState(false)

  useEffect(() => {
    async function loadCurrentBook() {
      if (!supabase || !user) return
      const { data: current } = await supabase.from('club_books').select('book_id').eq('is_current', true).limit(1).maybeSingle()
      if (!current) return

      const [{ data: selectedBook }, { data: savedProgress }, { data: review }] = await Promise.all([
        supabase.from('books').select('*').eq('id', current.book_id).single(),
        supabase.from('reading_progress').select('progress, status, progress_mode, current_pages, total_pages, current_chapter, total_chapters').eq('user_id', user.id).eq('book_id', current.book_id).maybeSingle(),
        supabase.from('reviews').select('rating, comment').eq('user_id', user.id).eq('book_id', current.book_id).maybeSingle(),
      ])
      if (selectedBook) setBook(selectedBook)
      if (savedProgress) {
        setProgress(savedProgress.progress)
        if (savedProgress.status === 'reading' || savedProgress.status === 'skipping' || savedProgress.status === 'completed') setStatus(savedProgress.status)
        if (savedProgress.progress_mode === 'percent' || savedProgress.progress_mode === 'pages' || savedProgress.progress_mode === 'chapters') setMode(savedProgress.progress_mode)
        setCurrentPages(savedProgress.current_pages ?? 0)
        setTotalPages(savedProgress.total_pages ?? 0)
        setCurrentChapter(savedProgress.current_chapter ?? 0)
        setTotalChapters(savedProgress.total_chapters ?? 0)
      }
      if (review) { setReviewRating(review.rating); setReviewComment(review.comment ?? '') }
    }
    loadCurrentBook()
  }, [user])

  function calculatedProgress(nextMode = mode) {
    if (nextMode === 'pages') return totalPages > 0 ? Math.min(100, Math.round((currentPages / totalPages) * 100)) : 0
    if (nextMode === 'chapters') return totalChapters > 0 ? Math.min(100, Math.round((currentChapter / totalChapters) * 100)) : 0
    return progress
  }

  function markDirty() { setDirty(true); setSaved(false) }

  function changeMode(nextMode: ProgressMode) {
    setMode(nextMode)
    setProgress(calculatedProgress(nextMode))
    markDirty()
  }

  async function saveProgress() {
    setSaving(true)
    const savedPercent = status === 'completed' ? 100 : calculatedProgress()
    setProgress(savedPercent)
    if (supabase && user && !book.id.startsWith('demo-')) {
      await supabase.from('reading_progress').upsert({
        user_id: user.id, book_id: book.id, progress: savedPercent, status, progress_mode: mode,
        current_pages: mode === 'pages' ? currentPages : null, total_pages: mode === 'pages' ? totalPages : null,
        current_chapter: mode === 'chapters' ? currentChapter : null, total_chapters: mode === 'chapters' ? totalChapters : null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,book_id' })
    }
    setDirty(false)
    setSaved(true)
    setSaving(false)
  }

  function chooseStatus(nextStatus: ReadingStatus) {
    setStatus(nextStatus)
    if (nextStatus === 'completed') setProgress(100)
    if (nextStatus === 'skipping') setProgress(0)
    markDirty()
  }

  async function saveReview() {
    if (status !== 'completed') return
    if (supabase && user && !book.id.startsWith('demo-')) await supabase.from('reviews').upsert({ user_id: user.id, book_id: book.id, rating: reviewRating, comment: reviewComment.trim() || null, updated_at: new Date().toISOString() }, { onConflict: 'user_id,book_id' })
    setReviewSaved(true)
    setReviewOpen(false)
  }

  const stars = Array.from({ length: 5 }, (_, index) => index < Math.floor(reviewRating) ? '★' : '☆').join('')

  return (
    <section className={styles.page}>
      <p className="eyebrow">NOVEMBER 2026 · CURRENT BOOK</p>
      <h1>Currently <em>reading.</em></h1>
      <div className={styles.book}>
        {book.cover_url ? <img className={styles.cover} src={book.cover_url} alt={`Cover of ${book.title}`} /> : <div className={styles.cover}><span>{book.title.toUpperCase()}</span><small>{book.author.toUpperCase()}</small></div>}
        <div className={styles.info}><p className="eyebrow">NOVEMBER'S BOOK PICK</p><h2>{book.title}</h2><p className={styles.author}>{book.author}</p><p className={styles.description}>{book.description ?? 'Read along with the club and bring your favourite passages to our next discussion.'}</p></div>
      </div>

      <section className={styles.progressSection}>
        <div className={styles.sectionHeading}><div><p className="eyebrow">YOUR READING LIFE</p><h2>Add your progress</h2></div><span className={`${styles.statusBadge} ${styles[status]}`}>{status}</span></div>
        <div className={styles.modeTabs}>{(['percent', 'pages', 'chapters'] as const).map((option) => <button key={option} type="button" className={mode === option ? styles.activeMode : ''} onClick={() => changeMode(option)}>{option === 'percent' ? '%' : option === 'pages' ? 'Pages' : 'Chapters'}</button>)}</div>
        {mode === 'percent' && <input className={`${styles.progressInput} ${status === 'skipping' ? styles.progressDisabled : ''} ${status === 'completed' ? styles.progressComplete : ''}`} type="range" min="0" max="100" value={progress} disabled={status !== 'reading'} onChange={(e) => { setProgress(Number(e.target.value)); markDirty() }} />}
        {mode === 'pages' && <div className={styles.numberInputs}><label>Pages read<input type="number" min="0" max={totalPages || undefined} value={currentPages || ''} placeholder="0" disabled={status !== 'reading'} onChange={(e) => { setCurrentPages(Number(e.target.value)); markDirty() }} /></label><span>of</span><label>Total pages<input type="number" min="1" value={totalPages || ''} placeholder="e.g. 320" disabled={status !== 'reading'} onChange={(e) => { setTotalPages(Number(e.target.value)); markDirty() }} /></label></div>}
        {mode === 'chapters' && <div className={styles.numberInputs}><label>Chapter reached<input type="number" min="0" max={totalChapters || undefined} value={currentChapter || ''} placeholder="0" disabled={status !== 'reading'} onChange={(e) => { setCurrentChapter(Number(e.target.value)); markDirty() }} /></label><span>of</span><label>Total chapters<input type="number" min="1" value={totalChapters || ''} placeholder="e.g. 24" disabled={status !== 'reading'} onChange={(e) => { setTotalChapters(Number(e.target.value)); markDirty() }} /></label></div>}
        <div className={styles.progressLabel}><span>{status === 'skipping' ? 'Progress is turned off while you skip this book' : status === 'completed' ? 'You finished this book' : mode === 'pages' ? 'Calculated from pages read' : mode === 'chapters' ? 'Calculated from chapters read' : 'How far are you?'}</span><strong>{status === 'completed' ? 100 : status === 'skipping' ? 0 : calculatedProgress()}%</strong></div>
        <div className={styles.statuses}>{(['reading', 'skipping', 'completed'] as const).map((option) => <button key={option} type="button" className={status === option ? styles.selectedStatus : ''} onClick={() => chooseStatus(option)}>{option === 'reading' ? 'I’m reading it' : option === 'skipping' ? 'Skip this book' : 'Mark completed'}</button>)}</div>
        <div className={styles.saveRow}><p className={styles.muted}>{saved ? 'Progress saved to your club profile.' : dirty ? 'You have unsaved changes.' : 'Your progress is private to your profile.'}</p><button type="button" className="primary-button" disabled={!dirty || saving} onClick={saveProgress}>{saving ? 'Saving...' : 'Save progress'}</button></div>
      </section>

      <section className={styles.reviewSection}><div><p className="eyebrow">AFTER THE LAST PAGE</p><h2>Your review</h2><p className={styles.muted}>{reviewSaved ? 'Your review is saved.' : status === 'completed' ? 'Tell the club what you thought.' : 'Finish the book to leave a review.'}</p></div><button type="button" className="primary-button" disabled={status !== 'completed'} onClick={() => setReviewOpen((open) => !open)}>{reviewSaved ? 'Edit review' : '+ Your review'}</button>{reviewOpen && <div className={styles.reviewForm}><div className={styles.starRow}><span>{stars}</span><strong>{reviewRating.toFixed(2).replace(/\.00$/, '')} / 5</strong></div><input className={styles.ratingInput} type="range" min="0.25" max="5" step="0.25" value={reviewRating} onChange={(e) => setReviewRating(Number(e.target.value))} aria-label="Book rating" /><textarea value={reviewComment} onChange={(e) => setReviewComment(e.target.value)} placeholder="What did you think?" rows={4} /><button type="button" className="primary-button" onClick={saveReview}>Save review</button></div>}</section>
    </section>
  )
}

export default CurrentBook
