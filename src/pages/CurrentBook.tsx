import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import type { Book } from '../types'
import coverImage from '../assets/husbands-secret-cover.png'
import parablePlaceholder from '../assets/parable-of-the-sower-placeholder.svg'
import styles from './CurrentBook.module.css'

type ReadingStatus = 'reading' | 'skipping' | 'completed'
type ProgressMode = 'percent' | 'pages' | 'chapters'
type MemberProgress = { id: string; name: string; progress: number; status: string }
type PreviousRead = {
  id: string
  title: string
  author: string
  coverUrl?: string | null
  readers: string[]
  reviews: { id: string; author: string; rating: number; comment?: string | null }[]
  comments: { id: string; author: string; content: string }[]
}
type CurrentReview = { id: string; userId: string; author: string; rating: number; comment?: string | null }

function RatingStars({ value, onChange, interactive = false }: { value: number; onChange?: (value: number) => void; interactive?: boolean }) {
  return <span className={styles.starRating} role={interactive ? 'group' : undefined} aria-label={`${value} out of 5 stars`}>
    {Array.from({ length: 5 }, (_, index) => {
      const fill = Math.min(1, Math.max(0, value - index)) * 100
      return <span className={styles.starCell} key={index}>
        <span className={styles.starOutline} aria-hidden="true">★</span>
        <span className={styles.starFill} style={{ width: `${fill}%` }} aria-hidden="true">★</span>
        {interactive && <span className={styles.starHitAreas}>{[0.25, 0.5, 0.75, 1].map((quarter) => <button type="button" key={quarter} onClick={() => onChange?.(index + quarter)} aria-label={`${index + quarter} out of 5 stars`} />)}</span>}
      </span>
    })}
  </span>
}

const parablePlaceholderRead: PreviousRead = {
  id: 'parable-of-the-sower-placeholder',
  title: 'Parable of the Sower',
  author: 'Octavia E. Butler',
  coverUrl: parablePlaceholder,
  readers: [],
  reviews: [],
  comments: [],
}

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
  const [celebrationOpen, setCelebrationOpen] = useState(false)
  const [progressOpen, setProgressOpen] = useState(true)
  const [currentReviews, setCurrentReviews] = useState<CurrentReview[]>([])
  const [memberProgress, setMemberProgress] = useState<MemberProgress[]>([])
  const [previousReads, setPreviousReads] = useState<PreviousRead[]>([parablePlaceholderRead])

  useEffect(() => {
    async function loadCurrentBook() {
      if (!supabase || !user) return
      const { data: current } = await supabase.from('club_books').select('club_id, book_id').eq('is_current', true).limit(1).maybeSingle()
      if (!current) return

      const [{ data: selectedBook }, { data: savedProgress }, { data: review }, { data: profiles }, { data: allProgress }, { data: allReviews }] = await Promise.all([
        supabase.from('books').select('*').eq('id', current.book_id).single(),
        supabase.from('reading_progress').select('progress, status, progress_mode, current_pages, total_pages, current_chapter, total_chapters').eq('user_id', user.id).eq('book_id', current.book_id).maybeSingle(),
        supabase.from('reviews').select('rating, comment').eq('user_id', user.id).eq('book_id', current.book_id).maybeSingle(),
        supabase.from('profiles').select('id, username, full_name').order('full_name'),
        supabase.from('reading_progress').select('user_id, progress, status').eq('book_id', current.book_id),
        supabase.from('reviews').select('id, user_id, rating, comment').eq('book_id', current.book_id).order('created_at', { ascending: true }),
      ])
      if (selectedBook) setBook(selectedBook)
      if (savedProgress) {
        setProgress(savedProgress.progress)
        if (savedProgress.status === 'reading' || savedProgress.status === 'skipping' || savedProgress.status === 'completed') {
          setStatus(savedProgress.status)
          setProgressOpen(savedProgress.status !== 'completed')
        }
        if (savedProgress.progress_mode === 'percent' || savedProgress.progress_mode === 'pages' || savedProgress.progress_mode === 'chapters') setMode(savedProgress.progress_mode)
        setCurrentPages(savedProgress.current_pages ?? 0)
        setTotalPages(savedProgress.total_pages ?? 0)
        setCurrentChapter(savedProgress.current_chapter ?? 0)
        setTotalChapters(savedProgress.total_chapters ?? 0)
      }
      if (review) { setReviewRating(review.rating); setReviewComment(review.comment ?? '') }
      const progressByUser = new Map((allProgress ?? []).map((item) => [item.user_id, item]))
      const names = new Map((profiles ?? []).map((profile) => [profile.id, profile.full_name || profile.username]))
      setCurrentReviews((allReviews ?? []).map((item) => ({ id: item.id, userId: item.user_id, author: names.get(item.user_id) ?? 'a member', rating: item.rating, comment: item.comment })))
      setMemberProgress((profiles ?? []).map((profile) => {
        const saved = progressByUser.get(profile.id)
        return {
          id: profile.id,
          name: profile.full_name || profile.username,
          progress: saved?.progress ?? 0,
          status: saved?.status === 'want_to_read' ? 'not started' : saved?.status?.replace('_', ' ') ?? 'not started',
        }
      }))

      const [{ data: completedBooks }, { data: historicalClubBooks }] = await Promise.all([
        supabase.from('reading_progress').select('user_id, book_id').eq('status', 'completed').neq('book_id', current.book_id),
        supabase.from('club_books').select('book_id').eq('club_id', current.club_id).eq('is_current', false),
      ])
      const previousBookIds = Array.from(new Set([
        ...(completedBooks ?? []).map((item) => item.book_id),
        ...(historicalClubBooks ?? []).map((item) => item.book_id),
      ]))
      if (previousBookIds.length === 0) {
        setPreviousReads([parablePlaceholderRead])
        return
      }

      const [{ data: historyBooks }, { data: historyReviews }, { data: historyComments }, { data: historyReads }] = await Promise.all([
        supabase.from('books').select('id, title, author, cover_url').in('id', previousBookIds),
        supabase.from('reviews').select('id, book_id, user_id, rating, comment').in('book_id', previousBookIds).order('created_at', { ascending: true }),
        supabase.from('book_comments').select('id, book_id, user_id, content').in('book_id', previousBookIds).order('created_at', { ascending: true }),
        supabase.from('book_reads').select('book_id, user_id').in('book_id', previousBookIds),
      ])
      const completedReaders = new Map<string, string[]>()
      for (const item of completedBooks ?? []) {
        const readers = completedReaders.get(item.book_id) ?? []
        const name = names.get(item.user_id) ?? 'a member'
        if (!readers.includes(name)) readers.push(name)
        completedReaders.set(item.book_id, readers)
      }
      for (const item of historyReads ?? []) {
        const readers = completedReaders.get(item.book_id) ?? []
        const name = names.get(item.user_id) ?? 'a member'
        if (!readers.includes(name)) readers.push(name)
        completedReaders.set(item.book_id, readers)
      }
      const historyBookMap = new Map((historyBooks ?? []).map((book) => [book.id, book]))
      const loadedPreviousReads = previousBookIds.flatMap((bookId) => {
        const historyBook = historyBookMap.get(bookId)
        if (!historyBook) return []
        return [{
          id: historyBook.id,
          title: historyBook.title,
          author: historyBook.author,
          coverUrl: historyBook.cover_url,
          readers: completedReaders.get(bookId) ?? [],
          reviews: (historyReviews ?? []).filter((item) => item.book_id === bookId).map((item) => ({ id: item.id, author: names.get(item.user_id) ?? 'a member', rating: item.rating, comment: item.comment })),
          comments: (historyComments ?? []).filter((item) => item.book_id === bookId).map((item) => ({ id: item.id, author: names.get(item.user_id) ?? 'a member', content: item.content })),
        }]
      })
      setPreviousReads(loadedPreviousReads.some((book) => book.title.toLowerCase() === parablePlaceholderRead.title.toLowerCase()) ? loadedPreviousReads : [parablePlaceholderRead, ...loadedPreviousReads])
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
    setCelebrationOpen(nextStatus === 'completed')
    setProgressOpen(nextStatus !== 'completed')
    markDirty()
  }

  async function saveReview() {
    if (status !== 'completed') return
    if (supabase && user && !book.id.startsWith('demo-')) await supabase.from('reviews').upsert({ user_id: user.id, book_id: book.id, rating: reviewRating, comment: reviewComment.trim() || null, updated_at: new Date().toISOString() }, { onConflict: 'user_id,book_id' })
    setCurrentReviews((previous) => [...previous.filter((item) => item.userId !== user?.id), { id: `${user?.id ?? 'you'}-${book.id}`, userId: user?.id ?? 'you', author: user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'You', rating: reviewRating, comment: reviewComment.trim() || null }])
    setReviewOpen(false)
  }

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
        {status === 'completed' && !progressOpen ? <div className={styles.completedSummary}><div><strong>Completed</strong><p>You finished this book.</p></div><button type="button" className={styles.editProgress} onClick={() => setProgressOpen(true)}>Edit progress</button></div> : <>
        <div className={styles.modeTabs}>{(['percent', 'pages', 'chapters'] as const).map((option) => <button key={option} type="button" className={mode === option ? styles.activeMode : ''} onClick={() => changeMode(option)}>{option === 'percent' ? '%' : option === 'pages' ? 'Pages' : 'Chapters'}</button>)}</div>
        {mode === 'percent' && <input className={`${styles.progressInput} ${status === 'skipping' ? styles.progressDisabled : ''} ${status === 'completed' ? styles.progressComplete : ''}`} type="range" min="0" max="100" value={progress} disabled={status !== 'reading'} onChange={(e) => { setProgress(Number(e.target.value)); markDirty() }} />}
        {mode === 'pages' && <div className={styles.numberInputs}><label>Pages read<input type="number" min="0" max={totalPages || undefined} value={currentPages || ''} placeholder="0" disabled={status !== 'reading'} onChange={(e) => { setCurrentPages(Number(e.target.value)); markDirty() }} /></label><span>of</span><label>Total pages<input type="number" min="1" value={totalPages || ''} placeholder="e.g. 320" disabled={status !== 'reading'} onChange={(e) => { setTotalPages(Number(e.target.value)); markDirty() }} /></label></div>}
        {mode === 'chapters' && <div className={styles.numberInputs}><label>Chapter reached<input type="number" min="0" max={totalChapters || undefined} value={currentChapter || ''} placeholder="0" disabled={status !== 'reading'} onChange={(e) => { setCurrentChapter(Number(e.target.value)); markDirty() }} /></label><span>of</span><label>Total chapters<input type="number" min="1" value={totalChapters || ''} placeholder="e.g. 24" disabled={status !== 'reading'} onChange={(e) => { setTotalChapters(Number(e.target.value)); markDirty() }} /></label></div>}
        <div className={styles.progressLabel}><span>{status === 'skipping' ? 'Progress is turned off while you skip this book' : status === 'completed' ? 'You finished this book' : mode === 'pages' ? 'Calculated from pages read' : mode === 'chapters' ? 'Calculated from chapters read' : 'How far are you?'}</span><strong>{status === 'completed' ? 100 : status === 'skipping' ? 0 : calculatedProgress()}%</strong></div>
        <div className={styles.statuses}>{(['reading', 'skipping', 'completed'] as const).map((option) => <button key={option} type="button" className={status === option ? styles.selectedStatus : ''} onClick={() => chooseStatus(option)}>{option === 'reading' ? 'I’m reading it' : option === 'skipping' ? 'Skip this book' : 'Mark completed'}</button>)}</div>
        <div className={styles.saveRow}><p className={styles.muted}>{saved ? 'Progress saved to your club profile.' : dirty ? 'You have unsaved changes.' : 'Your progress is private to your profile.'}</p><button type="button" className="primary-button" disabled={!dirty || saving} onClick={saveProgress}>{saving ? 'Saving...' : 'Save progress'}</button></div>
        </>}
      </section>

      {status === 'completed' && <section className={`${styles.reviewSection} ${styles.reviewsCard}`}>
        <p className="eyebrow">FROM THE CLUB</p>
        <h2>Reviews from the room.</h2>
        {currentReviews.length > 0 ? <div className={styles.currentReviewList}>{currentReviews.map((item) => <article className={`${styles.currentReview} ${item.userId === user?.id ? styles.myReview : ''}`} key={item.id}><div className={styles.currentReviewTop}><strong>{item.userId === user?.id ? 'Your review' : item.author}</strong><span><RatingStars value={item.rating} /> <small>{item.rating.toFixed(2).replace(/\.00$/, '')}/5</small></span></div>{item.comment ? <p>{item.comment}</p> : <p className={styles.muted}>No written review.</p>}{item.userId === user?.id && <button type="button" className={styles.editReview} onClick={() => setReviewOpen((open) => !open)}>{reviewOpen ? 'Close' : 'Edit'}</button>}</article>)}</div> : <p className={styles.archiveEmpty}>Be the first to review this book.</p>}
        {reviewOpen && <div className={styles.reviewForm}><div className={styles.starRow}><RatingStars value={reviewRating} onChange={setReviewRating} interactive /><strong>{reviewRating.toFixed(2).replace(/\.00$/, '')} / 5</strong></div><textarea value={reviewComment} onChange={(e) => setReviewComment(e.target.value)} placeholder="What did you think?" rows={4} /><button type="button" className="primary-button" onClick={saveReview}>Save review</button></div>}
      </section>}

      {celebrationOpen && <div className={styles.celebrationBackdrop} role="dialog" aria-modal="true" aria-labelledby="celebration-title"><div className={styles.celebration}><span className={styles.confetti} aria-hidden="true">✦</span><p className="eyebrow">ONE MORE BOOK FOR THE CLUB</p><h2 id="celebration-title">You finished it.</h2><p>Nice work. Your thoughts are officially wanted.</p><div className={styles.celebrationActions}><button type="button" className="primary-button" onClick={() => { setCelebrationOpen(false); setReviewOpen(true) }}>Give your review</button><button type="button" className={styles.dismissButton} onClick={() => setCelebrationOpen(false)}>Maybe later</button></div></div></div>}

      {memberProgress.length > 0 && <section className={styles.clubProgressSection}>
        <p className="eyebrow">THE CLUB, READING ALONG</p>
        <h2>Where everyone is.</h2>
        <div className={styles.memberProgressList}>{memberProgress.map((member) => <div className={styles.memberProgress} key={member.id}><div className={styles.memberProgressLabel}><span>{member.name}</span><strong>{member.status} · {member.progress}%</strong></div><div className={styles.memberTrack}><span className={member.status === 'completed' ? styles.memberComplete : member.status === 'skipping' ? styles.memberSkipping : ''} style={{ width: `${member.status === 'completed' ? 100 : member.progress}%` }} /></div></div>)}</div>
      </section>}

      <section className={styles.previousReadsSection}>
        <p className="eyebrow">THE CLUB ARCHIVE</p>
        <h2>Previous reads.</h2>
        {previousReads.length > 0 ? <div className={styles.previousReadsList}>{previousReads.map((previous) => <article className={styles.previousRead} key={previous.id}>
          {previous.coverUrl ? <img src={previous.coverUrl} alt="" /> : <div className={styles.previousCover}>{previous.title.slice(0, 1)}</div>}
          <div className={styles.previousInfo}>
            <h3>{previous.title}</h3>
            <p className={styles.muted}>{previous.author}</p>
            <p className={styles.readBy}><strong>Read by</strong> {previous.readers.join(', ') || 'no one yet'}</p>
            {previous.reviews.map((review) => <blockquote key={review.id}><strong>{review.author}</strong> · {review.rating.toFixed(2).replace(/\.00$/, '')}/5{review.comment ? ` — “${review.comment}”` : ''}</blockquote>)}
            {previous.comments.map((comment) => <p className={styles.archiveComment} key={comment.id}><strong>{comment.author}</strong> {comment.content}</p>)}
            {previous.reviews.length === 0 && previous.comments.length === 0 && <p className={styles.muted}>No reviews or comments yet.</p>}
          </div>
        </article>)}</div> : <p className={styles.archiveEmpty}>Books the club finishes together will appear here with their readers, reviews, and comments.</p>}
      </section>
    </section>
  )
}

export default CurrentBook
