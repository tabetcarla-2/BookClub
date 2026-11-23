import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import parablePlaceholder from '../assets/parable-of-the-sower-placeholder.svg'
import parableBadge from '../assets/parable-sower-badge-generated.png'
import husbandsSecretBadge from '../assets/husbands-secret-badge.png'
import clubMeetingBadge from '../assets/club-meeting-badge.png'
import coverImage from '../assets/husbands-secret-cover.png'
import styles from './Profile.module.css'

type ProfileData = { full_name: string; username: string; avatar_url: string | null }
type Book = { id: string; title: string; author: string; cover_url: string | null }
type Badge = { book: Book; badgeUrl: string | null; rating: number | null; review: string | null }
type Activity = { icon: string; text: string; date: string }
type EarnableBadge = { id: string; title: string; description: string; image: string; earned: boolean }

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
  const [currentProgress, setCurrentProgress] = useState<{ progress: number; status: string; updated_at?: string } | null>(null)
  const [badges, setBadges] = useState<Badge[]>([])
  const [assignedBadgeKeys, setAssignedBadgeKeys] = useState<Set<string>>(new Set())
  const [activity, setActivity] = useState<Activity[]>([])
  const [stats, setStats] = useState({ booksRead: 0, averageRating: null as number | null, meetups: 0 })
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [savingName, setSavingName] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [avatarDraft, setAvatarDraft] = useState<{ file: File; url: string } | null>(null)
  const [avatarZoom, setAvatarZoom] = useState(1)
  const [avatarPosition, setAvatarPosition] = useState({ x: 50, y: 50 })
  const avatarDrag = useRef<{ x: number; y: number; positionX: number; positionY: number } | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function loadProfile() {
      if (!supabase || !user) { setLoading(false); return }
      const cacheKey = `bookclub-profile-v3-${user.id}`
      try {
        const cached = localStorage.getItem(cacheKey)
        if (cached) {
          const snapshot = JSON.parse(cached) as { profile?: ProfileData; currentBook?: Book | null; currentProgress?: { progress: number; status: string; updated_at?: string } | null; badges?: Badge[]; activity?: Activity[]; stats?: typeof stats }
          if (snapshot.profile) { setProfile(snapshot.profile); setEditName(snapshot.profile.full_name) }
          if (snapshot.currentBook !== undefined) setCurrentBook(snapshot.currentBook)
          if (snapshot.currentProgress !== undefined) setCurrentProgress(snapshot.currentProgress)
          if (snapshot.badges) setBadges(snapshot.badges)
          if (snapshot.activity) setActivity(snapshot.activity)
          if (snapshot.stats) setStats(snapshot.stats)
          if (snapshot.profile) setLoading(false)
        }
      } catch {
        // Cache is an instant preview only; Supabase remains the source of truth.
      }
      const [profileResult, currentResult, clubBooksResult, completedResult, reviewsResult, visitsResult, votesResult, commentsResult, progressActivityResult, backlogItemsResult, assignedBadgesResult] = await Promise.all([
        supabase.from('profiles').select('full_name, username, avatar_url').eq('id', user.id).maybeSingle(),
        supabase.from('club_books').select('book_id').eq('is_current', true).limit(1).maybeSingle(),
        supabase.from('club_books').select('book_id, is_current'),
        supabase.from('reading_progress').select('book_id, updated_at').eq('user_id', user.id).eq('status', 'completed'),
        supabase.from('reviews').select('book_id, rating, comment, created_at').eq('user_id', user.id),
        supabase.from('venue_group_visits').select('tried_at').eq('marked_by', user.id),
        supabase.from('book_votes').select('book_id, vote, created_at').eq('user_id', user.id),
        supabase.from('book_comments').select('book_id, created_at').eq('user_id', user.id),
        supabase.from('reading_progress').select('book_id, progress, status, updated_at').eq('user_id', user.id),
        supabase.from('backlog_items').select('book_id, created_at').eq('user_id', user.id),
        supabase.from('profile_badges').select('badge_key').eq('user_id', user.id),
      ])
      if (cancelled) return
      if (profileResult.error || currentResult.error || clubBooksResult.error || completedResult.error || reviewsResult.error || visitsResult.error || votesResult.error || commentsResult.error || progressActivityResult.error || backlogItemsResult.error || assignedBadgesResult.error) {
        setError(profileResult.error?.message || currentResult.error?.message || clubBooksResult.error?.message || completedResult.error?.message || reviewsResult.error?.message || visitsResult.error?.message || votesResult.error?.message || commentsResult.error?.message || progressActivityResult.error?.message || backlogItemsResult.error?.message || assignedBadgesResult.error?.message || 'Unable to load your profile.')
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
      const clubBookIds = new Set((clubBooksResult.data ?? []).map((item) => item.book_id))
      const readIds = Array.from(new Set(completedRows.filter((item) => clubBookIds.has(item.book_id)).map((item) => item.book_id)))
      const activityBookIds = [
        ...(reviewsResult.data ?? []).map((item) => item.book_id),
        ...(votesResult.data ?? []).map((item) => item.book_id),
        ...(commentsResult.data ?? []).map((item) => item.book_id),
        ...(progressActivityResult.data ?? []).map((item) => item.book_id),
        ...(backlogItemsResult.data ?? []).map((item) => item.book_id),
      ]
      const allBookIds = Array.from(new Set([...readIds, ...activityBookIds, ...(currentBookId ? [currentBookId] : [])]))
      const [booksResult, currentProgressResult] = await Promise.all([
        allBookIds.length ? supabase.from('books').select('id, title, author, cover_url').in('id', allBookIds) : Promise.resolve({ data: [], error: null }),
        currentBookId ? supabase.from('reading_progress').select('progress, status').eq('user_id', user.id).eq('book_id', currentBookId).maybeSingle() : Promise.resolve({ data: null, error: null }),
      ])
      if (cancelled) return
      if (booksResult.error || currentProgressResult.error) { setError(booksResult.error?.message || currentProgressResult.error?.message || 'Unable to load your books.'); setLoading(false); return }
      const booksById = new Map((booksResult.data ?? []).map((book) => [book.id, book]))
      const reviews = reviewsResult.data ?? []
      setAssignedBadgeKeys(new Set((assignedBadgesResult.data ?? []).map((badge) => badge.badge_key)))
      const reviewsByBook = new Map(reviews.map((review) => [review.book_id, review]))
      const bookBadges = readIds.map((bookId) => { const book = booksById.get(bookId); if (!book) return null; const review = reviewsByBook.get(bookId); return { book: { ...book, cover_url: book.cover_url || (book.title.toLowerCase() === 'parable of the sower' ? parablePlaceholder : null) }, badgeUrl: book.title.toLowerCase() === 'parable of the sower' ? parableBadge : null, rating: review?.rating ?? null, review: review?.comment ?? null } }).filter((badge): badge is Badge => Boolean(badge))
      const current = currentBookId ? booksById.get(currentBookId) : null
      const clubReviews = reviews.filter((review) => clubBookIds.has(review.book_id))
      const ratings = clubReviews.map((review) => Number(review.rating))
      const nextActivity: Activity[] = []
      ;(backlogItemsResult.data ?? []).forEach((item) => { const book = booksById.get(item.book_id); if (book) nextActivity.push({ icon: '＋', text: `Added ${book.title} to the backlog`, date: item.created_at }) })
      ;(votesResult.data ?? []).forEach((vote) => { const book = booksById.get(vote.book_id); if (book) nextActivity.push({ icon: vote.vote === 1 ? '↑' : '↓', text: `${vote.vote === 1 ? 'Upvoted' : 'Downvoted'} ${book.title}`, date: vote.created_at }) })
      ;(commentsResult.data ?? []).forEach((comment) => { const book = booksById.get(comment.book_id); if (book) nextActivity.push({ icon: '□', text: `Commented on ${book.title}`, date: comment.created_at }) })
      ;(progressActivityResult.data ?? []).forEach((progress) => { const book = booksById.get(progress.book_id); if (book) nextActivity.push({ icon: '▤', text: `Updated ${book.title} to ${progress.progress}%`, date: progress.updated_at }) })
      reviews.forEach((review) => { const book = booksById.get(review.book_id); if (book) nextActivity.push({ icon: '☆', text: `Rated ${book.title} ${review.rating}/5`, date: review.created_at }) })
      nextActivity.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      const nextStats = { booksRead: readIds.length, averageRating: ratings.length ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length : null, meetups: (visitsResult.data ?? []).length }
      const nextActivityList = nextActivity.slice(0, 4)
      setCurrentBook(current ?? null); setCurrentProgress(currentProgressResult.data); setBadges(bookBadges); setStats(nextStats); setActivity(nextActivityList); setLoading(false)
      try { localStorage.setItem(cacheKey, JSON.stringify({ profile: profileRow ? { ...profileRow, username: profileRow.username.startsWith('reader_') ? (user.user_metadata?.username || user.email?.split('@')[0] || profileRow.username) : profileRow.username, full_name: profileRow.full_name.toLowerCase() === 'tabet.carla' ? 'Carla' : profileRow.full_name } : profile, currentBook: current ?? null, currentProgress: currentProgressResult.data, badges: bookBadges, activity: nextActivityList, stats: nextStats })) } catch { /* Cache is optional. */ }
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

  function selectAvatar(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    if (avatarDraft) URL.revokeObjectURL(avatarDraft.url)
    setAvatarDraft({ file, url: URL.createObjectURL(file) })
    setAvatarZoom(1)
    setAvatarPosition({ x: 50, y: 50 })
    event.target.value = ''
  }

  async function saveAvatar() {
    if (!supabase || !user || !avatarDraft || uploading) return
    setUploading(true); setError('')
    try {
      const image = new Image()
      image.src = avatarDraft.url
      await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error('Could not read that image.')) })
      const size = 512
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      const context = canvas.getContext('2d')
      if (!context) throw new Error('Could not prepare that image.')
      const scale = Math.max(size / image.naturalWidth, size / image.naturalHeight) * avatarZoom
      const width = image.naturalWidth * scale
      const height = image.naturalHeight * scale
      const x = (size - width) / 2 + ((avatarPosition.x - 50) / 50) * ((width - size) / 2)
      const y = (size - height) / 2 + ((avatarPosition.y - 50) / 50) * ((height - size) / 2)
      context.drawImage(image, x, y, width, height)
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', .9))
      if (!blob) throw new Error('Could not prepare that image.')
      const path = `${user.id}/${Date.now()}.jpg`
      const { error: uploadError } = await supabase.storage.from('avatars').upload(path, blob, { upsert: true, contentType: 'image/jpeg' })
      if (uploadError) throw uploadError
      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      const { error: profileError } = await supabase.from('profiles').update({ avatar_url: data.publicUrl }).eq('id', user.id)
      if (profileError) throw profileError
      setProfile((current) => ({ ...current, avatar_url: data.publicUrl }))
      URL.revokeObjectURL(avatarDraft.url)
      setAvatarDraft(null)
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Could not save that image.')
    }
    setUploading(false)
  }

  function startAvatarDrag(event: React.PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId)
    avatarDrag.current = { x: event.clientX, y: event.clientY, positionX: avatarPosition.x, positionY: avatarPosition.y }
  }

  function moveAvatarDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (!avatarDrag.current) return
    const deltaX = ((event.clientX - avatarDrag.current.x) / event.currentTarget.clientWidth) * 100
    const deltaY = ((event.clientY - avatarDrag.current.y) / event.currentTarget.clientHeight) * 100
    setAvatarPosition({ x: Math.max(0, Math.min(100, avatarDrag.current.positionX + deltaX)), y: Math.max(0, Math.min(100, avatarDrag.current.positionY + deltaY)) })
  }

  function stopAvatarDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (avatarDrag.current) event.currentTarget.releasePointerCapture(event.pointerId)
    avatarDrag.current = null
  }

  function zoomAvatar(event: React.WheelEvent<HTMLDivElement>) {
    event.preventDefault()
    setAvatarZoom((current) => Math.max(1, Math.min(3, Number((current - event.deltaY * 0.002).toFixed(2)))))
  }

  const displayName = profile.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Reader'
  const initials = displayName.slice(0, 1).toUpperCase()
  const currentBookCover = currentBook && (currentBook.cover_url || (currentBook.title.toLowerCase() === "a husband's secret" ? coverImage : null))
  const currentStatus = currentProgress?.status === 'completed' ? 'Completed' : currentProgress?.status === 'skipping' ? 'Skipping' : currentProgress?.status === 'reading' ? 'Reading' : 'Not started'
  const averageRating = stats.averageRating === null ? '—' : stats.averageRating.toFixed(1)
  const hasMeetingBadge = stats.meetups > 0 || ['carla', 'misha'].includes(displayName.trim().toLowerCase())
  const earnedTitles = new Set(badges.map((badge) => badge.book.title.trim().toLowerCase()))
  const earnableBadges: EarnableBadge[] = [
    { id: 'parable-of-the-sower', title: 'Parable of the Sower', description: 'Finish Parable of the Sower with the club.', image: parableBadge, earned: earnedTitles.has('parable of the sower') || assignedBadgeKeys.has('parable-of-the-sower') },
    { id: 'husbands-secret', title: "A Husband's Secret", description: "Finish A Husband's Secret with the club.", image: husbandsSecretBadge, earned: earnedTitles.has("a husband's secret") || assignedBadgeKeys.has('husbands-secret') },
    { id: 'club-meeting', title: 'Book club meeting', description: 'Attend a book club meeting.', image: clubMeetingBadge, earned: hasMeetingBadge || assignedBadgeKeys.has('club-meeting') },
  ]
  const definedBadgeTitles = new Set(earnableBadges.map((badge) => badge.title.toLowerCase()))
  const additionalEarnedBadges: EarnableBadge[] = badges
    .filter((badge) => !definedBadgeTitles.has(badge.book.title.toLowerCase()))
    .map((badge) => ({ id: badge.book.id, title: badge.book.title, description: `Finish ${badge.book.title} with the club.`, image: badge.badgeUrl || badge.book.cover_url || parableBadge, earned: true }))
  const allBadges = [...earnableBadges, ...additionalEarnedBadges]

  return <section className={`${styles.page} editorial-page`}>
    <section className={`${styles.pageHero} editorial-hero`}><div className="editorial-hero-inner"><p className={`${styles.heroKicker} editorial-kicker`}>YOUR PROFILE</p><h1>{displayName}’s <em>books.</em></h1><p className="editorial-subtitle">Your reading, badges, and book club activity.</p><div className={styles.profileIdentity}>{profile.avatar_url ? <img className={styles.avatar} src={profile.avatar_url} alt={`${displayName}'s profile`} /> : <div className={styles.avatar}>{initials}</div>}<div><h2>{displayName}</h2><p>{profile.username || 'reader'}</p><button type="button" className={styles.editProfileButton} onClick={() => { setEditName(displayName); setEditing((open) => !open) }}>{editing ? 'Close' : 'Edit profile'}</button></div></div></div></section>
    <div className={styles.profileShell}>
      {error && <p className={styles.error}>{error}</p>}
      {editing && <section className={styles.editPanel}><label>Display name<input value={editName} onChange={(event) => setEditName(event.target.value)} /></label><label>Profile photo<span className={styles.photoUpload}>{avatarDraft ? 'Choose a different photo' : 'Choose a new photo'}<input type="file" accept="image/*" onChange={selectAvatar} disabled={uploading} /></span></label>{avatarDraft && <div className={styles.avatarEditor}><p className={styles.cropHint}>Drag the photo in any direction · scroll to zoom</p><div className={styles.avatarCrop} onPointerDown={startAvatarDrag} onPointerMove={moveAvatarDrag} onPointerUp={stopAvatarDrag} onPointerCancel={stopAvatarDrag} onWheel={zoomAvatar}><img src={avatarDraft.url} alt="Profile crop preview" style={{ transform: `translate(${(avatarPosition.x - 50) * (avatarZoom - 1)}%, ${(avatarPosition.y - 50) * (avatarZoom - 1)}%) scale(${avatarZoom})` }} /></div><label>Zoom<input type="range" min="1" max="3" step="0.05" value={avatarZoom} onChange={(event) => setAvatarZoom(Number(event.target.value))} /></label><button type="button" className="primary-button" onClick={saveAvatar} disabled={uploading}>{uploading ? 'Saving photo…' : 'Save photo'}</button></div>}<button type="button" className="primary-button" onClick={saveProfileName} disabled={savingName || !editName.trim()}>{savingName ? 'Saving…' : 'Save profile'}</button></section>}
      <div className={styles.profileGrid}>
        <section className={styles.currentSection}><div className={styles.cardEyebrow}>CURRENT BOOK</div>{loading ? <p className={styles.muted}>Loading your current book…</p> : currentBook ? <div className={styles.currentBook}>{currentBookCover ? <img src={currentBookCover} alt={`Cover of ${currentBook.title}`} /> : <div className={styles.coverFallback}>{currentBook.title.slice(0, 1)}</div>}<div className={styles.currentBookInfo}><span className={`${styles.status} ${styles[currentStatus.toLowerCase().replace(' ', '')]}`}>{currentStatus}</span><h2>{currentBook.title}</h2><p>{currentBook.author}</p><div className={styles.progress}><span style={{ width: `${currentProgress?.progress ?? 0}%` }} /><small>{currentProgress?.progress ?? 0}% complete</small></div></div></div> : <p className={styles.muted}>There is no current book yet.</p>}</section>
        <section className={styles.glanceCard}><h2>Your Club <em>at a Glance.</em></h2><div className={styles.glanceStats}><div><span>▤</span><strong>{stats.booksRead}</strong><small>Books read</small></div><div><span>☆</span><strong>{averageRating}</strong><small>Avg. rating</small></div><div><span>♧</span><strong>{stats.meetups}</strong><small>Meetups attended</small></div></div></section>
        <section className={styles.badgesSection}><div className={styles.cardHeading}><div><h2>Your <em>Badges.</em></h2><p>Milestones and moments from the club.</p></div><span>{badges.length + (hasMeetingBadge ? 1 : 0)} badges</span></div>{loading ? <p className={styles.muted}>Loading your badges…</p> : <><div className={styles.badgeGuide}><div className={styles.earnableBadges}>{allBadges.map((badge) => <div className={`${styles.earnableBadge} ${badge.earned ? styles.earnedBadge : styles.lockedBadge}`} key={badge.id} aria-label={`${badge.title}. ${badge.description}${badge.earned ? ' Earned.' : ' Locked.'}`}><img src={badge.image} alt="" /><span className={styles.badgeLock}>{badge.earned ? '✓' : '🔒'}</span><strong>{badge.title}</strong><span className={styles.earnableTooltip}>{badge.description}</span></div>)}</div></div></>} </section>
        <section className={styles.activityCard}><h2>Recent <em>Activity.</em></h2>{activity.length ? <div className={styles.activityList}>{activity.map((item, index) => <div className={styles.activity} key={`${item.text}-${index}`}><span>{item.icon}</span><p>{item.text}</p><small>{relativeDate(item.date)}</small></div>)}</div> : <p className={styles.empty}>Your club activity will appear here.</p>}</section>
      </div>
    </div>
  </section>
}

export default Profile
