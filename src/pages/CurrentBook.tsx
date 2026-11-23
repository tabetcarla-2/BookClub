import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import type { Book } from '../types'
import coverImage from '../assets/husbands-secret-cover.png'
import { BookOpenIcon } from '../components/Icons'
import styles from './CurrentBook.module.css'

type ReadingStatus = 'reading' | 'skipping' | 'completed'
type MemberProgress = { id: string; name: string; avatarUrl: string | null; progress: number; status: string }
type CurrentReview = { id: string; userId: string; author: string; rating: number; comment?: string | null }
type DiscussionComment = { id: string; userId: string; author: string; content: string; revealAt: number; createdAt: string }

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

const demoBook: Book = {
  id: 'demo-current', title: "A Husband's Secret", author: 'Liane Moriarty', cover_url: coverImage,
  description: 'A page-turning story about secrets, marriage, and the things we keep from the people closest to us. When a woman discovers a letter her husband wrote for her to read after his death, a private secret begins to reshape the lives of everyone around them. It is a sharp, emotional look at love, friendship, and the stories we tell ourselves.',
}

const husbandsSecretDescription = demoBook.description

function CurrentBook() {
  const { user } = useAuth()
  const [currentLoading, setCurrentLoading] = useState(true)
  const [book, setBook] = useState<Book>(demoBook)
  const [progress, setProgress] = useState(45)
  const [status, setStatus] = useState<ReadingStatus>('reading')
  const [savedProgress, setSavedProgress] = useState(0)
  const [savedStatus, setSavedStatus] = useState<ReadingStatus>('reading')
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [reviewOpen, setReviewOpen] = useState(false)
  const [reviewRating, setReviewRating] = useState(4)
  const [reviewComment, setReviewComment] = useState('')
  const [celebrationOpen, setCelebrationOpen] = useState(false)
  const [progressOpen, setProgressOpen] = useState(false)
  const [currentReviews, setCurrentReviews] = useState<CurrentReview[]>([])
  const [discussionComments, setDiscussionComments] = useState<DiscussionComment[]>([])
  const [commentDraft, setCommentDraft] = useState('')
  const [commentRevealAt, setCommentRevealAt] = useState(80)
  const [commentSaving, setCommentSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'discussion' | 'reviews'>('discussion')
  const [memberProgress, setMemberProgress] = useState<MemberProgress[]>([])
  const [loadError, setLoadError] = useState('')
  const progressEditorRef = useRef<HTMLElement>(null)

  useEffect(() => {
    async function loadCurrentBook() {
      if (!supabase || !user) { setCurrentLoading(false); return }
      const cacheKey = `bookclub-current-${user.id}`
      try {
        const cached = localStorage.getItem(cacheKey)
        if (cached) {
          const parsed = JSON.parse(cached) as { book?: Book; progress?: number; status?: ReadingStatus; memberProgress?: MemberProgress[]; currentReviews?: CurrentReview[] }
          if (parsed.book) setBook(parsed.book)
          if (typeof parsed.progress === 'number') setProgress(parsed.progress)
          if (parsed.progress !== undefined) setSavedProgress(parsed.progress)
          if (parsed.status) { setStatus(parsed.status); setSavedStatus(parsed.status) }
          if (parsed.memberProgress) setMemberProgress(parsed.memberProgress)
          if (parsed.currentReviews) setCurrentReviews(parsed.currentReviews)
          if (parsed.book) setCurrentLoading(false)
        }
      } catch {
        // Ignore unavailable or malformed browser cache and load from Supabase.
      }
      const { data: current, error: currentError } = await supabase.from('club_books').select('club_id, book_id').eq('is_current', true).limit(1).maybeSingle()
      if (currentError) { setLoadError(currentError.message); setCurrentLoading(false); return }
      if (!current) { setLoadError('No current club book has been set yet.'); setCurrentLoading(false); return }

      const [{ data: selectedBook }, { data: savedProgress }, { data: review }, { data: profiles }, { data: allProgress }, { data: allReviews }, { data: allComments }] = await Promise.all([
        supabase.from('books').select('*').eq('id', current.book_id).single(),
        supabase.from('reading_progress').select('progress, status, progress_mode, current_pages, total_pages, current_chapter, total_chapters').eq('user_id', user.id).eq('book_id', current.book_id).maybeSingle(),
        supabase.from('reviews').select('rating, comment').eq('user_id', user.id).eq('book_id', current.book_id).maybeSingle(),
        supabase.from('profiles').select('id, username, full_name, avatar_url').order('full_name'),
        supabase.from('reading_progress').select('user_id, progress, status').eq('book_id', current.book_id),
        supabase.from('reviews').select('id, user_id, rating, comment').eq('book_id', current.book_id).order('created_at', { ascending: true }),
        supabase.from('book_comments').select('id, user_id, content, created_at, spoiler_threshold').eq('book_id', current.book_id).order('created_at', { ascending: true }),
      ])
      if (selectedBook) setBook(selectedBook)
      if (savedProgress) {
        setProgress(savedProgress.progress)
        setSavedProgress(savedProgress.progress)
        if (savedProgress.status === 'reading' || savedProgress.status === 'skipping' || savedProgress.status === 'completed') {
          setStatus(savedProgress.status)
          setSavedStatus(savedProgress.status)
          setProgressOpen(false)
        }
      } else { setProgress(0); setStatus('reading'); setProgressOpen(false) }
      if (review) { setReviewRating(review.rating); setReviewComment(review.comment ?? '') }
      const progressByUser = new Map((allProgress ?? []).map((item) => [item.user_id, item]))
      const names = new Map((profiles ?? []).map((profile) => [profile.id, profile.full_name || profile.username]))
      setCurrentReviews((allReviews ?? []).map((item) => ({ id: item.id, userId: item.user_id, author: names.get(item.user_id) ?? 'a member', rating: item.rating, comment: item.comment })))
      setDiscussionComments((allComments ?? []).map((item) => ({ id: item.id, userId: item.user_id, author: names.get(item.user_id) ?? 'a member', content: item.content, revealAt: item.spoiler_threshold ?? 0, createdAt: item.created_at })))
      setMemberProgress((profiles ?? []).map((profile) => {
        const saved = progressByUser.get(profile.id)
        return {
          id: profile.id,
          name: profile.full_name || profile.username,
          avatarUrl: profile.avatar_url,
          progress: saved?.progress ?? 0,
          status: saved?.status === 'want_to_read' ? 'not started' : saved?.status?.replace('_', ' ') ?? 'not started',
        }
      }))
      try {
        localStorage.setItem(cacheKey, JSON.stringify({ book: selectedBook ?? book, progress: savedProgress?.progress ?? 0, status: savedProgress?.status ?? 'reading', memberProgress: (profiles ?? []).map((profile) => { const saved = progressByUser.get(profile.id); return { id: profile.id, name: profile.full_name || profile.username, progress: saved?.progress ?? 0, status: saved?.status === 'want_to_read' ? 'not started' : saved?.status?.replace('_', ' ') ?? 'not started' } }), currentReviews: (allReviews ?? []).map((item) => ({ id: item.id, userId: item.user_id, author: names.get(item.user_id) ?? 'a member', rating: item.rating, comment: item.comment })) }))
      } catch { /* Cache is optional. */ }
      // The current book and leaderboard can render now; historical reads load
      // separately so they do not delay the main page.
      setCurrentLoading(false)

    }
    loadCurrentBook()
  }, [user])

  useEffect(() => {
    if (!user || book.id.startsWith('demo-') || dirty) return
    try { localStorage.setItem(`bookclub-current-${user.id}`, JSON.stringify({ book, progress, status, memberProgress, currentReviews })) } catch { /* Cache is optional. */ }
  }, [book, currentReviews, dirty, memberProgress, progress, status, user])

  function markDirty() { setDirty(true); setSaved(false) }

  function beginEditProgress() {
    setStatus('reading')
    setProgressOpen(true)
    markDirty()
  }

  function openProgressEditor() {
    if (status !== 'reading') beginEditProgress()
    setProgressOpen(true)
    window.setTimeout(() => progressEditorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 0)
  }

  function updateProgressValue(value: number) {
    const nextProgress = Math.max(0, Math.min(100, Math.round(value)))
    setProgress(nextProgress)
    setStatus(nextProgress === 100 ? 'completed' : 'reading')
    setProgressOpen(true)
    markDirty()
    if (nextProgress === 100) {
      setCelebrationOpen(true)
      setActiveTab('reviews')
    }
  }

  async function saveProgress() {
    setSaving(true)
    setSaveError('')
    const savedPercent = status === 'completed' ? 100 : progress
    setProgress(savedPercent)
    if (supabase && user && !book.id.startsWith('demo-')) {
      const { error: progressError } = await supabase.from('reading_progress').upsert({
        user_id: user.id, book_id: book.id, progress: savedPercent, status, progress_mode: 'percent',
        current_pages: null, total_pages: null, current_chapter: null, total_chapters: null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,book_id' })
      if (progressError) { setSaveError(progressError.message); setSaving(false); return }
    }
    setSavedProgress(savedPercent)
    setSavedStatus(status)
    setDirty(false)
    setSaved(true)
    setProgressOpen(false)
    setSaving(false)
  }

  function toggleSkipping() {
    const nextStatus = status === 'skipping' ? 'reading' : 'skipping'
    setStatus(nextStatus)
    setProgressOpen(false)
    markDirty()
  }

  function revertToReading() {
    setStatus('reading')
    setProgress((current) => Math.min(current, 99))
    setProgressOpen(true)
    setActiveTab('discussion')
    markDirty()
  }

  async function saveReview() {
    if (status !== 'completed') return
    if (supabase && user && !book.id.startsWith('demo-')) await supabase.from('reviews').upsert({ user_id: user.id, book_id: book.id, rating: reviewRating, comment: reviewComment.trim() || null, updated_at: new Date().toISOString() }, { onConflict: 'user_id,book_id' })
    setCurrentReviews((previous) => [...previous.filter((item) => item.userId !== user?.id), { id: `${user?.id ?? 'you'}-${book.id}`, userId: user?.id ?? 'you', author: user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'You', rating: reviewRating, comment: reviewComment.trim() || null }])
    setReviewOpen(false)
  }

  async function deleteReview(reviewId: string) {
    if (!user) return
    if (supabase && !reviewId.startsWith('local-') && !reviewId.includes(user.id)) {
      const { error } = await supabase.from('reviews').delete().eq('id', reviewId).eq('user_id', user.id)
      if (error) { setSaveError(error.message); return }
    }
    setCurrentReviews((previous) => previous.filter((review) => review.id !== reviewId))
    setReviewOpen(false)
  }

  async function addDiscussionComment() {
    const content = commentDraft.trim()
    if (!content || !user || commentSaving) return
    setCommentSaving(true)
    const optimistic = { id: `local-${Date.now()}`, userId: user.id, author: user.user_metadata?.full_name || user.email?.split('@')[0] || 'You', content, revealAt: commentRevealAt, createdAt: new Date().toISOString() }
    if (supabase && !book.id.startsWith('demo-')) {
      const { data, error } = await supabase.from('book_comments').insert({ book_id: book.id, user_id: user.id, content, spoiler_threshold: commentRevealAt }).select('id, created_at').single()
      if (error) { setSaveError(error.message); setCommentSaving(false); return }
      setDiscussionComments((previous) => [...previous, { ...optimistic, id: data.id, createdAt: data.created_at }])
    } else setDiscussionComments((previous) => [...previous, optimistic])
    setCommentDraft('')
    setCommentRevealAt(80)
    setCommentSaving(false)
  }

  async function deleteDiscussionComment(commentId: string) {
    if (!user) return
    if (supabase && !commentId.startsWith('local-')) {
      const { error } = await supabase.from('book_comments').delete().eq('id', commentId).eq('user_id', user.id)
      if (error) { setSaveError(error.message); return }
    }
    setDiscussionComments((previous) => previous.filter((comment) => comment.id !== commentId))
  }

  function renderReviews() {
    const blurred = savedStatus !== 'completed'
    return <div className={styles.reviewsPane}><h2>Reviews from the room.</h2>{blurred && <p className={styles.muted}>Finish the book to read everyone’s thoughts. You can still see who posted.</p>}{currentReviews.length > 0 ? <div className={styles.currentReviewList}>{currentReviews.map((item) => <article className={`${styles.currentReview} ${item.userId === user?.id ? styles.myReview : ''}`} key={item.id}><div className={styles.currentReviewTop}><strong>{item.userId === user?.id ? 'Your review' : item.author}</strong>{item.userId === user?.id && <div><button type="button" className={styles.editReview} onClick={() => setReviewOpen((open) => !open)}>{reviewOpen ? 'Close' : 'Edit'}</button><button type="button" className={styles.reviewDelete} onClick={() => deleteReview(item.id)}>Delete</button></div>}</div><div className={blurred ? styles.reviewSpoiler : ''}><span className={styles.reviewRatingLine}><RatingStars value={item.rating} /> <small>{item.rating.toFixed(2).replace(/\.00$/, '')}/5</small></span>{item.comment ? <p>{item.comment}</p> : <p className={styles.muted}>No written review.</p>}</div></article>)}</div> : <p className={styles.archiveEmpty}>No reviews have been posted yet.</p>}{!blurred && reviewOpen && <div className={styles.reviewForm}><div className={styles.starRow}><RatingStars value={reviewRating} onChange={setReviewRating} interactive /><strong>{reviewRating.toFixed(2).replace(/\.00$/, '')} / 5</strong></div><textarea value={reviewComment} onChange={(e) => setReviewComment(e.target.value)} placeholder="What did you think?" rows={4} /><button type="button" className="primary-button" onClick={saveReview}>Save review</button></div>}</div>
  }

  function renderProgressEditor() {
    if (!progressOpen) return null
    return <section className={styles.progressSection} id="progress-editor" ref={progressEditorRef}>
      <div className={styles.sectionHeading}><div className={styles.progressHeading}><span className={styles.progressIcon}><BookOpenIcon size={17} /></span><h2>Add your progress</h2></div><span className={`${styles.statusBadge} ${styles[status]}`}>{status}</span></div>
      <div className={styles.progressRow}><input className={`${styles.progressInput} ${status === 'skipping' ? styles.progressDisabled : ''} ${status === 'completed' ? styles.progressComplete : ''}`} type="range" min="0" max="100" value={progress} disabled={status !== 'reading'} onChange={(e) => updateProgressValue(Number(e.target.value))} /><input className={styles.progressNumber} type="number" min="0" max="100" value={status === 'completed' ? 100 : status === 'skipping' ? 0 : progress} disabled={status !== 'reading'} onChange={(e) => updateProgressValue(Number(e.target.value))} aria-label="Progress percentage" /><span className={styles.percentSign}>%</span></div>
      {status === 'skipping' && <p className={styles.progressStateMessage}>Progress is paused while you skip this book.</p>}
      {status === 'completed' && <div className={styles.progressStateMessage}><span>You finished this book.</span><button type="button" className={styles.revertButton} onClick={revertToReading}>Revert to reading</button></div>}
      {saved && !dirty ? <div className={styles.saveRow}><p className={styles.savedMessage}>Saved</p></div> : dirty ? <div className={styles.saveRow}><p className={styles.muted}>{saveError || 'You have unsaved changes.'}</p><button type="button" className="primary-button" disabled={saving} onClick={saveProgress}>{saving ? 'Saving...' : 'Save progress'}</button></div> : null}
    </section>
  }

  const rankedMemberProgress = [...memberProgress].sort((a, b) => b.progress - a.progress || a.name.localeCompare(b.name))
  const bookCover = book.cover_url || (book.title.toLowerCase() === "a husband's secret" ? coverImage : null)
  const displayStatus = status === 'skipping' ? 'skipping' : status === 'completed' ? 'completed' : progress > 0 ? 'reading' : 'not started'

  if (currentLoading) {
    return <section className={styles.page}><p className="eyebrow">CURRENT BOOK</p><p className={styles.muted}>Loading current book…</p></section>
  }

  return (
    <section className={`${styles.page} editorial-page`}>
      <section className={`${styles.pageHero} editorial-hero`}>
        <div className={`${styles.pageHeroInner} editorial-hero-inner`}>
          <p className={`${styles.heroKicker} editorial-kicker`}>NOVEMBER 2026 · CURRENT BOOK</p>
          <h1>Currently <em>reading.</em></h1>
          <p className={`${styles.heroSubtitle} editorial-subtitle`}>Read with us, if you dare.</p>
        </div>
      </section>
      <div className={styles.contentShell}>
      {loadError && <p className={styles.loadError}>{loadError}</p>}
      <div className={styles.bookLayout}>
      <div className={styles.book}>
        {bookCover ? <img className={styles.cover} src={bookCover} alt={`Cover of ${book.title}`} /> : <div className={styles.cover}><span>{book.title.toUpperCase()}</span><small>{book.author.toUpperCase()}</small></div>}
        <div className={styles.info}><div className={styles.bookMeta}><p className="eyebrow">NOVEMBER'S BOOK PICK</p><div className={styles.bookStatusActions}><span className={`${styles.statusBadge} ${styles[displayStatus === 'not started' ? 'reading' : displayStatus]}`}>{displayStatus === 'skipping' ? '⚑ skipping' : displayStatus}</span><button type="button" className={styles.skipTextButton} onClick={toggleSkipping}>{status === 'skipping' ? 'Return to reading' : 'Skip this book'}</button></div></div><h2>{book.title}</h2><p className={styles.author}>{book.author}</p><p className={styles.description}>{book.title.toLowerCase() === "a husband's secret" && (!book.description || book.description.length < 140) ? husbandsSecretDescription : book.description ?? 'Read along with the club and bring your favourite passages to our next discussion.'}</p><div className={`${styles.bookProgress} ${status === 'skipping' ? styles.bookProgressSkipped : ''}`}><strong>{status === 'completed' ? 100 : progress}%</strong><div className={styles.bookProgressTrack}><span style={{ width: `${status === 'completed' ? 100 : progress}%` }} /></div></div><button type="button" className={styles.keepReading} onClick={() => progressOpen ? setProgressOpen(false) : openProgressEditor()}>{progressOpen ? 'Close progress' : status !== 'reading' ? 'Edit progress' : 'Keep reading'} <span>{progressOpen ? '↑' : '→'}</span></button></div>
        {renderProgressEditor()}
      </div>
      <section className={styles.clubProgressSection}>
        <div className={styles.leaderboardHeading}><p className="eyebrow">THE CLUB</p><h2>Current read leaderboard.</h2></div>
        {rankedMemberProgress.length > 0 ? <div className={styles.memberProgressList}>{rankedMemberProgress.map((member, index) => <div className={styles.memberProgress} key={member.id}><span className={styles.rank}>{index + 1}</span>{member.avatarUrl ? <img className={styles.memberAvatar} src={member.avatarUrl} alt="" /> : <span className={styles.memberAvatar}>{member.name.slice(0, 1).toUpperCase()}</span>}<div className={styles.memberProgressDetails}><div className={styles.memberProgressLabel}><span>{member.name}</span><strong>{member.status === 'completed' ? 100 : member.progress}%</strong></div><div className={styles.memberTrack}><span className={member.status === 'completed' ? styles.memberComplete : member.status === 'skipping' ? styles.memberSkipping : ''} style={{ width: `${member.status === 'completed' ? 100 : member.progress}%` }} /></div></div></div>)}</div> : <p className={styles.archiveEmpty}>Member progress will appear here once the club starts reading.</p>}
      </section>
      </div>

      <section className={styles.discussionSection}>
        <div className={styles.discussionTabs}><button type="button" className={activeTab === 'discussion' ? styles.activeTab : ''} onClick={() => setActiveTab('discussion')}><span aria-hidden="true">◌</span> Discussion <small>{discussionComments.length}</small></button><button type="button" className={activeTab === 'reviews' ? styles.activeTab : ''} onClick={() => setActiveTab('reviews')}><span aria-hidden="true">☆</span> Reviews <small>{currentReviews.length}</small></button></div>
        <div className={`${styles.commentList} ${activeTab === 'reviews' ? styles.tabHidden : ''}`}>
          {discussionComments.length === 0 ? <p className={styles.archiveEmpty}>Start the discussion. Add a thought and choose when the club should see it.</p> : discussionComments.map((comment) => {
            const revealed = comment.revealAt === 0 || savedStatus === 'completed' || savedProgress >= comment.revealAt || comment.userId === user?.id
            return <article className={styles.discussionComment} key={comment.id}><div className={styles.commentMeta}><strong>{comment.author}</strong><small>{comment.revealAt > 0 ? `· hidden until ${comment.revealAt}%` : '· visible to everyone'}</small>{comment.userId === user?.id && <button type="button" className={styles.deleteComment} onClick={() => deleteDiscussionComment(comment.id)} title="Delete comment" aria-label="Delete comment">×</button>}</div><div className={`${styles.commentBody} ${!revealed ? styles.commentHidden : ''}`}>{!revealed && <span className={styles.commentLock}>🔒</span>}<p>{comment.content}</p></div></article>
          })}
        </div>
        <div className={`${styles.commentComposer} ${activeTab === 'reviews' ? styles.tabHidden : ''}`}><textarea value={commentDraft} onChange={(event) => setCommentDraft(event.target.value)} placeholder="Add a thought..." rows={2} /><div className={styles.commentComposerFooter}><label>Keep hidden until <input className={styles.revealNumber} type="number" min="0" max="100" value={commentRevealAt} onChange={(event) => setCommentRevealAt(Math.max(0, Math.min(100, Number(event.target.value))))} aria-label="Custom reveal percentage" />%</label><button type="button" className="primary-button" disabled={!commentDraft.trim() || commentSaving} onClick={addDiscussionComment}>{commentSaving ? 'Posting…' : 'Post'}</button></div></div>
        {activeTab === 'reviews' && renderReviews()}
      </section>

      {false && activeTab === 'reviews' && status === 'completed' && <section className={`${styles.reviewSection} ${styles.reviewsCard}`}>
        <p className="eyebrow">FROM THE CLUB</p>
        <h2>Reviews from the room.</h2>
        {currentReviews.length > 0 ? <div className={styles.currentReviewList}>{currentReviews.map((item) => <article className={`${styles.currentReview} ${item.userId === user?.id ? styles.myReview : ''}`} key={item.id}><div className={styles.currentReviewTop}><strong>{item.userId === user?.id ? 'Your review' : item.author}</strong><span><RatingStars value={item.rating} /> <small>{item.rating.toFixed(2).replace(/\.00$/, '')}/5</small></span></div>{item.comment ? <p>{item.comment}</p> : <p className={styles.muted}>No written review.</p>}{item.userId === user?.id && <button type="button" className={styles.editReview} onClick={() => setReviewOpen((open) => !open)}>{reviewOpen ? 'Close' : 'Edit'}</button>}</article>)}</div> : <p className={styles.archiveEmpty}>Be the first to review this book.</p>}
        {reviewOpen && <div className={styles.reviewForm}><div className={styles.starRow}><RatingStars value={reviewRating} onChange={setReviewRating} interactive /><strong>{reviewRating.toFixed(2).replace(/\.00$/, '')} / 5</strong></div><textarea value={reviewComment} onChange={(e) => setReviewComment(e.target.value)} placeholder="What did you think?" rows={4} /><button type="button" className="primary-button" onClick={saveReview}>Save review</button></div>}
      </section>}

      {false && activeTab === 'reviews' && status !== 'completed' && <section className={`${styles.reviewSection} ${styles.reviewsCard} ${styles.lockedReviews}`}><span className={styles.lockedReviewIcon}>🔒</span><p className="eyebrow">REVIEWS</p><h2>Reviews unlock when you finish.</h2><p className={styles.muted}>Keep reading to see the club’s ratings and thoughts without spoilers.</p></section>}

      {celebrationOpen && <div className={styles.celebrationBackdrop} role="dialog" aria-modal="true" aria-labelledby="celebration-title"><div className={styles.celebration}><span className={styles.confetti} aria-hidden="true">✦</span><p className="eyebrow">ONE MORE BOOK FOR THE CLUB</p><h2 id="celebration-title">You finished it.</h2><p>Nice work. Your thoughts are officially wanted.</p><div className={styles.celebrationActions}><button type="button" className="primary-button" onClick={() => { setCelebrationOpen(false); setActiveTab('reviews'); setReviewOpen(true) }}>Give your review</button><button type="button" className={styles.dismissButton} onClick={() => setCelebrationOpen(false)}>Maybe later</button></div></div></div>}

      </div>
    </section>
  )
}

export default CurrentBook
