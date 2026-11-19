import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import parablePlaceholder from '../assets/parable-of-the-sower-placeholder.svg'
import coverImage from '../assets/husbands-secret-cover.png'
import styles from './Profile.module.css'

type ProfileData = { full_name: string; username: string; avatar_url: string | null }
type Book = { id: string; title: string; author: string; cover_url: string | null }
type Badge = { book: Book; rating: number | null; review: string | null }

function Profile() {
  const { user } = useAuth()
  const [profile, setProfile] = useState<ProfileData>({ full_name: '', username: '', avatar_url: null })
  const [currentBook, setCurrentBook] = useState<Book | null>(null)
  const [currentProgress, setCurrentProgress] = useState<{ progress: number; status: string } | null>(null)
  const [badges, setBadges] = useState<Badge[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function loadProfile() {
      if (!supabase || !user) { setLoading(false); return }
      const [{ data: profileRow }, { data: current }] = await Promise.all([
        supabase.from('profiles').select('full_name, username, avatar_url').eq('id', user.id).maybeSingle(),
        supabase.from('club_books').select('book_id').eq('is_current', true).limit(1).maybeSingle(),
      ])
      if (cancelled) return
      if (profileRow) {
        const signupUsername = user.user_metadata?.username || user.email?.split('@')[0] || profileRow.username
        const username = profileRow.username.startsWith('reader_') ? signupUsername : profileRow.username
        const fullName = profileRow.full_name.toLowerCase() === 'tabet.carla' ? 'Carla' : profileRow.full_name
        setProfile({ ...profileRow, username, full_name: fullName })
        if (username !== profileRow.username) await supabase.from('profiles').update({ username }).eq('id', user.id)
        if (fullName !== profileRow.full_name) await supabase.from('profiles').update({ full_name: fullName }).eq('id', user.id)
      }
      if (current) {
        const [{ data: book }, { data: progress }] = await Promise.all([
          supabase.from('books').select('id, title, author, cover_url').eq('id', current.book_id).single(),
          supabase.from('reading_progress').select('progress, status').eq('user_id', user.id).eq('book_id', current.book_id).maybeSingle(),
        ])
        if (book) setCurrentBook(book)
        if (progress) setCurrentProgress(progress)
      }
      const [{ data: reads }, { data: completed }] = await Promise.all([
        supabase.from('book_reads').select('book_id').eq('user_id', user.id),
        supabase.from('reading_progress').select('book_id').eq('user_id', user.id).eq('status', 'completed'),
      ])
      const readIds = Array.from(new Set([...(reads ?? []).map((item) => item.book_id), ...(completed ?? []).map((item) => item.book_id)]))
      if (readIds.length > 0) {
        const [{ data: books }, { data: reviews }] = await Promise.all([
          supabase.from('books').select('id, title, author, cover_url').in('id', readIds),
          supabase.from('reviews').select('book_id, rating, comment').eq('user_id', user.id).in('book_id', readIds),
        ])
        const reviewByBook = new Map((reviews ?? []).map((review) => [review.book_id, review]))
        setBadges((books ?? []).map((book) => ({ book: { ...book, cover_url: book.cover_url || (book.title.toLowerCase() === 'parable of the sower' ? parablePlaceholder : null) }, rating: reviewByBook.get(book.id)?.rating ?? null, review: reviewByBook.get(book.id)?.comment ?? null })))
      } else setBadges([])
      setLoading(false)
    }
    loadProfile()
    return () => { cancelled = true }
  }, [user])

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

  return <section className={styles.page}>
    <p className="eyebrow">YOUR PROFILE</p>
    <h1>{displayName}'s <em>books.</em></h1>
    {error && <p className={styles.error}>{error}</p>}
    <div className={styles.profileHeader}>
      <div className={styles.avatarWrap}>{profile.avatar_url ? <img className={styles.avatar} src={profile.avatar_url} alt={`${displayName}'s profile`} /> : <div className={styles.avatar}>{initials}</div>}<label className={styles.avatarEdit}>{uploading ? 'Uploading…' : 'Edit photo'}<input type="file" accept="image/*" onChange={uploadAvatar} disabled={uploading} /></label></div>
      <div><h2>{displayName}</h2><p className={styles.muted}>@{profile.username || 'reader'}</p></div>
    </div>
    <section className={styles.currentSection}><div className={styles.sectionHeading}><p className="eyebrow">CURRENT BOOK</p><span>{currentProgress?.status?.replace('_', ' ') || 'Not started'}</span></div>{loading ? <p className={styles.muted}>Loading your current book…</p> : currentBook ? <div className={styles.currentBook}>{currentBookCover ? <img src={currentBookCover} alt={`Cover of ${currentBook.title}`} /> : <div className={styles.coverFallback}>{currentBook.title.slice(0, 1)}</div>}<div><h2>{currentBook.title}</h2><p>{currentBook.author}</p>{currentProgress && <div className={styles.progress}><span style={{ width: `${currentProgress.progress}%` }} /><small>{currentProgress.progress}% complete</small></div>}</div></div> : <p className={styles.muted}>There is no current book yet.</p>}</section>
    <section className={styles.badgesSection}><div className={styles.sectionHeading}><p className="eyebrow">BADGES</p><span>{badges.length} read</span></div>{loading ? <p className={styles.muted}>Loading your badges…</p> : badges.length === 0 ? <p className={styles.empty}>Your book-club badges will appear here when you mark a book as read.</p> : <div className={styles.badges}>{badges.map(({ book, rating, review }) => <article className={styles.badge} key={book.id}>{book.cover_url ? <img src={book.cover_url} alt="" /> : <div className={styles.coverFallback}>{book.title.slice(0, 1)}</div>}<div><h3>{book.title}</h3><p>{book.author}</p>{rating !== null && <div className={styles.rating}>{'★'.repeat(Math.round(rating))}<small>{rating}/5</small></div>}{review && <blockquote>“{review}”</blockquote>}</div></article>)}</div>}</section>
  </section>
}

export default Profile
