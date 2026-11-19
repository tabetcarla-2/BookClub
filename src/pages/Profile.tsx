import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import parablePlaceholder from '../assets/parable-of-the-sower-placeholder.svg'
import coverImage from '../assets/husbands-secret-cover.png'
import styles from './Profile.module.css'

type ProfileData = { full_name: string; username: string; avatar_url: string | null }
type Book = { id: string; title: string; author: string; cover_url: string | null }
type Badge = { book: Book; rating: number | null; review: string | null }
type Activity = { icon: string; text: string; date: string }

function relativeDate(value: string) {
  const days = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 86400000))
  if (days === 0) return 'today'
  if (days === 1) return '1d ago'
  if (days < 30) return `${days}d ago`
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function Profile() {
  const { user } = useAuth()
  const [profile, setProfile] = useState<ProfileData>({ full_name: '', username: '', avatar_url: null })
  const [currentBook, setCurrentBook] = useState<Book | null>(null)
  const [currentProgress, setCurrentProgress] = useState<{ progress: number; status: string } | null>(null)
  const [badges, setBadges] = useState<Badge[]>([])
  const [activity, setActivity] = useState<Activity[]>([])
  const [stats, setStats] = useState({ booksRead: 0, averageRating: null as number | null, meetups: 0 })
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [savingName, setSavingName] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function loadProfile() {
      if (!supabase || !user) { setLoading(false); return }
      const [profileResult, currentResult, readsResult, completedResult, reviewsResult, visitsResult] = await Promise.all([
        supabase.from('profiles').select('full_name, username, avatar_url').eq('id', user.id).maybeSingle(),
        supabase.from('club_books').select('book_id').eq('is_current', true).limit(1).maybeSingle(),
        supabase.from('book_reads').select('book_id, created_at').eq('user_id', user.id),
        supabase.from('reading_progress').select('book_id, updated_at').eq('user_id', user.id).eq('status', 'completed'),
        supabase.from('reviews').select('book_id, rating, comment, created_at').eq('user_id', user.id),
        supabase.from('venue_group_visits').select('tried_at').eq('marked_by', user.id),
      ])
      if (cancelled) return
      if (profileResult.error || currentResult.error || readsResult.error || completedResult.error || reviewsResult.error || visitsResult.error) {
        setError(profileResult.error?.message || currentResult.error?.message || readsResult.error?.message || completedResult.error?.message || reviewsResult.error?.message || visitsResult.error?.message || 'Unable to load your profile.')
        setLoading(false)
        return
      }

      const profileRow = profileResult.data
      if (profileRow) {
        const signupUsername = user.user_metadata?.username || user.email?.split('@')[0] || profileRow.username
        const username = profileRow.username.startsWith('reader_') ? signupUsername : profileRow.username
        const fullName = profileRow.full_name.toLowerCase() === 'tabet.carla' ? 'Carla' : profileRow.full_name
        const nextProfile = { ...profileRow, username, full_name: fullName }
        setProfile(nextProfile); setEditName(fullName)
        if (username !== profileRow.username || fullName !== profileRow.full_name) await supabase.from('profiles').update({ username, full_name: fullName }).eq('id', user.id)
      }

      const currentBookId = currentResult.data?.book_id ?? null
      const completedRows = completedResult.data ?? []
      const readIds = Array.from(new Set([...(readsResult.data ?? []).map((item) => item.book_id), ...completedRows.map((item) => item.book_id)]))
      const allBookIds = Array.from(new Set([...readIds, ...(currentBookId ? [currentBookId] : [])]))
      const [booksResult, currentProgressResult] = await Promise.all([
        allBookIds.length ? supabase.from('books').select('id, title, author, cover_url').in('id', allBookIds) : Promise.resolve({ data: [], error: null }),
        currentBookId ? supabase.from('reading_progress').select('progress, status').eq('user_id', user.id).eq('book_id', currentBookId).maybeSingle() : Promise.resolve({ data: null, error: null }),
      ])
      if (cancelled) return
      if (booksResult.error || currentProgressResult.error) { setError(booksResult.error?.message || currentProgressResult.error?.message || 'Unable to load your books.'); setLoading(false); return }
      const booksById = new Map((booksResult.data ?? []).map((book) => [book.id, book]))
      const reviews = reviewsResult.data ?? []
      const reviewsByBook = new Map(reviews.map((review) => [review.book_id, review]))
      const bookBadges = readIds.map((bookId) => { const book = booksById.get(bookId); if (!book) return null; const review = reviewsByBook.get(bookId); return { book: { ...book, cover_url: book.cover_url || (book.title.toLowerCase() === 'parable of the sower' ? parablePlaceholder : null) }, rating: review?.rating ?? null, review: review?.comment ?? null } }).filter((badge): badge is Badge => Boolean(badge))
      const current = currentBookId ? booksById.get(currentBookId) : null
      const ratings = reviews.map((review) => Number(review.rating))
      const nextActivity: Activity[] = []
      if (current && currentProgressResult.data) nextActivity.push({ icon: '▤', text: `Marked ${current.title} as ${currentProgressResult.data.status === 'completed' ? 'completed' : 'reading'}`, date: new Date().toISOString() })
      reviews.forEach((review) => { const book = booksById.get(review.book_id); if (book) nextActivity.push({ icon: '☆', text: `Rated ${book.title} ${review.rating}/5`, date: review.created_at }) })
      ;(visitsResult.data ?? []).forEach((visit) => nextActivity.push({ icon: '♧', text: 'Attended a book club meetup', date: visit.tried_at }))
      nextActivity.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      setCurrentBook(current ?? null); setCurrentProgress(currentProgressResult.data); setBadges(bookBadges); setStats({ booksRead: readIds.length, averageRating: ratings.length ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length : null, meetups: (visitsResult.data ?? []).length }); setActivity(nextActivity.slice(0, 4)); setLoading(false)
    }
    loadProfile()
    return () => { cancelled = true }
  }, [user])

  async function saveProfileName() {
    const value = editName.trim()
    if (!supabase || !user || !value || savingName) return
    setSavingName(true); setError('')
    const { error: updateError } = await supabase.from('profiles').update({ full_name: value }).eq('id', user.id)
    if (updateError) setError(updateError.message)
    else { setProfile((current) => ({ ...current, full_name: value })); setEditing(false) }
    setSavingName(false)
  }

  async function uploadAvatar(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!supabase || !user || !file) return
    setUploading(true); setError('')
    const extension = file.name.split('.').pop() || 'jpg'
    const path = `${user.id}/${Date.now()}.${extension}`
    const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, { upsert: true, contentType: file.type })
    if (uploadError) { setError(uploadError.message); setUploading(false); return }
    const { data } = supabase.storage.from('avatars').getPublicUrl(path)
    const { error: profileError } = await supabase.from('profiles').update({ avatar_url: data.publicUrl }).eq('id', user.id)
    if (profileError) setError(profileError.message)
    else setProfile((current) => ({ ...current, avatar_url: data.publicUrl }))
    setUploading(false)
  }

  const displayName = profile.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Reader'
  const initials = displayName.slice(0, 1).toUpperCase()
  const currentBookCover = currentBook && (currentBook.cover_url || (currentBook.title.toLowerCase() === "a husband's secret" ? coverImage : null))
  const currentStatus = currentProgress?.status === 'completed' ? 'Completed' : currentProgress?.status === 'skipping' ? 'Skipping' : currentProgress?.status === 'reading' ? 'Reading' : 'Not started'
  const averageRating = stats.averageRating === null ? '—' : stats.averageRating.toFixed(1)
  const visibleBadges = useMemo(() => badges.slice(-5).reverse(), [badges])

  return <section className={`${styles.page} editorial-page`}>
    <section className={`${styles.pageHero} editorial-hero`}><div className="editorial-hero-inner"><p className={`${styles.heroKicker} editorial-kicker`}>YOUR PROFILE</p><h1>{displayName}’s <em>books.</em></h1><p className="editorial-subtitle">Your reading, badges, and book club activity.</p><div className={styles.profileIdentity}>{profile.avatar_url ? <img className={styles.avatar} src={profile.avatar_url} alt={`${displayName}'s profile`} /> : <div className={styles.avatar}>{initials}</div>}<div><h2>{displayName}</h2><p>@{profile.username || 'reader'}</p><button type="button" className={styles.editProfileButton} onClick={() => { setEditName(displayName); setEditing((open) => !open) }}>{editing ? 'Close' : 'Edit profile'}</button></div></div></div></section>
    <div className={styles.profileShell}>
      {error && <p className={styles.error}>{error}</p>}
      {editing && <section className={styles.editPanel}><label>Display name<input value={editName} onChange={(event) => setEditName(event.target.value)} /></label><label>Profile photo<span className={styles.photoUpload}>{uploading ? 'Uploading…' : 'Choose a new photo'}<input type="file" accept="image/*" onChange={uploadAvatar} disabled={uploading} /></span></label><button type="button" className="primary-button" onClick={saveProfileName} disabled={savingName || !editName.trim()}>{savingName ? 'Saving…' : 'Save profile'}</button></section>}
      <div className={styles.profileGrid}>
        <section className={styles.currentSection}><div className={styles.cardEyebrow}>CURRENT BOOK</div>{loading ? <p className={styles.muted}>Loading your current book…</p> : currentBook ? <div className={styles.currentBook}>{currentBookCover ? <img src={currentBookCover} alt={`Cover of ${currentBook.title}`} /> : <div className={styles.coverFallback}>{currentBook.title.slice(0, 1)}</div>}<div className={styles.currentBookInfo}><span className={`${styles.status} ${styles[currentStatus.toLowerCase().replace(' ', '')]}`}>{currentStatus}</span><h2>{currentBook.title}</h2><p>{currentBook.author}</p><div className={styles.progress}><span style={{ width: `${currentProgress?.progress ?? 0}%` }} /><small>{currentProgress?.progress ?? 0}% complete</small></div></div></div> : <p className={styles.muted}>There is no current book yet.</p>}</section>
        <section className={styles.glanceCard}><h2>Your Club <em>at a Glance.</em></h2><div className={styles.glanceStats}><div><span>▤</span><strong>{stats.booksRead}</strong><small>Books read</small></div><div><span>☆</span><strong>{averageRating}</strong><small>Avg. rating</small></div><div><span>♧</span><strong>{stats.meetups}</strong><small>Meetups attended</small></div></div></section>
        <section className={styles.badgesSection}><div className={styles.cardHeading}><div><h2>Your <em>Badges.</em></h2><p>Books you’ve read with the club.</p></div><span>{badges.length} badges</span></div>{loading ? <p className={styles.muted}>Loading your badges…</p> : visibleBadges.length ? <div className={styles.badges}>{visibleBadges.map(({ book, rating }) => <article className={styles.badge} key={book.id} title={`${book.title}${rating !== null ? ` · ${rating}/5` : ''}`}>{book.cover_url ? <img src={book.cover_url} alt={book.title} /> : <div className={styles.coverFallback}>{book.title.slice(0, 1)}</div>}</article>)}{badges.length > visibleBadges.length && <div className={styles.moreBadge}>+{badges.length - visibleBadges.length}</div>}</div> : <p className={styles.empty}>Your book-club badges will appear here when you finish a book.</p>}</section>
        <section className={styles.activityCard}><h2>Recent <em>Activity.</em></h2>{activity.length ? <div className={styles.activityList}>{activity.map((item, index) => <div className={styles.activity} key={`${item.text}-${index}`}><span>{item.icon}</span><p>{item.text}</p><small>{relativeDate(item.date)}</small></div>)}</div> : <p className={styles.empty}>Your club activity will appear here.</p>}</section>
      </div>
    </div>
  </section>
}

export default Profile
