import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import parablePlaceholder from '../assets/parable-of-the-sower-placeholder.svg'
import parableBadge from '../assets/parable-sower-badge-generated.png'
import husbandsSecretBadge from '../assets/husbands-secret-badge.png'
import clubMeetingBadge from '../assets/club-meeting-badge.png'
import styles from './Members.module.css'

type StatusKey = 'completed' | 'reading' | 'notStarted' | 'skipping'
type Badge = { id: string; title: string; author: string; coverUrl?: string | null; badgeUrl?: string | null; rating: number | null; kind?: 'book' | 'milestone' }
type Member = { id: string; name: string; username: string; avatarUrl?: string | null; status: string; statusKey: StatusKey; progress: number; booksRead: number; averageRating: number | null; completionRate: number; badges: Badge[] }
type Leader = Pick<Member, 'id' | 'name' | 'avatarUrl' | 'booksRead' | 'progress' | 'statusKey'>
type ClubStats = { memberCount: number; booksRead: number; averageRating: number | null }

const emptyStats: ClubStats = { memberCount: 0, booksRead: 0, averageRating: null }
const formatRating = (rating: number | null) => rating === null ? '—' : rating.toFixed(1)

function statusFor(progress: number | undefined, status: string | undefined): { status: string; statusKey: StatusKey } {
  if (status === 'completed' || progress === 100) return { status: 'Completed', statusKey: 'completed' }
  if (status === 'skipping') return { status: 'Skipping', statusKey: 'skipping' }
  if (status === 'reading' && (progress ?? 0) > 0) return { status: 'In progress', statusKey: 'reading' }
  return { status: 'Not started', statusKey: 'notStarted' }
}

function readerScore(reader: Leader) {
  const currentProgress = reader.statusKey === 'reading' ? reader.progress : 0
  return reader.booksRead * 100 + currentProgress
}

function readerRank(readers: Leader[], index: number) {
  const score = readerScore(readers[index])
  return readers.findIndex((reader) => readerScore(reader) === score) + 1
}

function Members() {
  const { user } = useAuth()
  const [members, setMembers] = useState<Member[]>([])
  const [clubStats, setClubStats] = useState<ClubStats>(emptyStats)
  const [currentBookTitle, setCurrentBookTitle] = useState('The current club read')
  const [topReaders, setTopReaders] = useState<Leader[]>([])
  const [selectedMember, setSelectedMember] = useState<Member | null>(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function loadMembers() {
      if (!supabase || !user) { setLoading(false); return }
      const cacheKey = `bookclub-members-dashboard-v2-${user.id}`
      try {
        const cached = localStorage.getItem(cacheKey)
        if (cached) {
          const parsed = JSON.parse(cached) as { members?: Member[]; stats?: ClubStats; currentBookTitle?: string; topReaders?: Leader[] }
          if (parsed.members?.length) setMembers(parsed.members)
          if (parsed.stats) setClubStats(parsed.stats)
          if (parsed.currentBookTitle) setCurrentBookTitle(parsed.currentBookTitle)
          if (parsed.topReaders) setTopReaders(parsed.topReaders)
          if (parsed.members?.length) setLoading(false)
        }
      } catch { /* Cache is only an instant preview. */ }

      const [profilesResult, currentResult, clubBooksResult, progressResult, reviewsResult, assignedBadgesResult] = await Promise.all([
        supabase.from('profiles').select('id, username, full_name, avatar_url').order('full_name'),
        supabase.from('club_books').select('book_id').eq('is_current', true).limit(1).maybeSingle(),
        supabase.from('club_books').select('book_id, is_current'),
        supabase.from('reading_progress').select('user_id, book_id, progress, status'),
        supabase.from('reviews').select('user_id, book_id, rating'),
        supabase.from('profile_badges').select('user_id, badge_key'),
      ])
      if (cancelled) return
      if (profilesResult.error || currentResult.error || clubBooksResult.error || progressResult.error || reviewsResult.error || assignedBadgesResult.error) {
        setError(profilesResult.error?.message || currentResult.error?.message || clubBooksResult.error?.message || progressResult.error?.message || reviewsResult.error?.message || assignedBadgesResult.error?.message || 'Unable to load the members.')
        setLoading(false)
        return
      }

      const profiles = profilesResult.data ?? []
      const currentBookId = currentResult.data?.book_id ?? null
      const historicalClubBookIds = new Set((clubBooksResult.data ?? []).filter((row) => !row.is_current).map((row) => row.book_id))
      const progressRows = progressResult.data ?? []
      const reviewRows = reviewsResult.data ?? []
      const assignedBadgesByUser = new Map<string, string[]>()
      ;(assignedBadgesResult.data ?? []).forEach((row) => assignedBadgesByUser.set(row.user_id, [...(assignedBadgesByUser.get(row.user_id) ?? []), row.badge_key]))
      const completedRows = progressRows.filter((row) => row.status === 'completed' || row.progress === 100)
      const clubBookIds = new Set((clubBooksResult.data ?? []).map((row) => row.book_id))
      const clubCompletedRows = completedRows.filter((row) => clubBookIds.has(row.book_id))
      const bookIds = Array.from(new Set([...clubCompletedRows.map((row) => row.book_id), ...(currentBookId ? [currentBookId] : [])]))
      const booksResult = bookIds.length ? await supabase.from('books').select('id, title, author, cover_url').in('id', bookIds) : { data: [], error: null }
      if (cancelled) return
      if (booksResult.error) { setError(booksResult.error.message); setLoading(false); return }

      const booksById = new Map((booksResult.data ?? []).map((book) => [book.id, book]))
      const readsByUser = new Map<string, Set<string>>()
      for (const row of clubCompletedRows) { const reads = readsByUser.get(row.user_id) ?? new Set<string>(); reads.add(row.book_id); readsByUser.set(row.user_id, reads) }
      const reviewsByUser = new Map<string, number[]>()
      const reviewsByBook = new Map<string, number>()
      for (const row of reviewRows) { const ratings = reviewsByUser.get(row.user_id) ?? []; ratings.push(row.rating); reviewsByUser.set(row.user_id, ratings) }
      const currentProgressByUser = new Map(progressRows.filter((row) => row.book_id === currentBookId).map((row) => [row.user_id, row]))

      const nextMembers: Member[] = profiles.map((profile) => {
        const progressRow = currentProgressByUser.get(profile.id)
        const progress = progressRow?.status === 'completed' ? 100 : Math.max(0, Math.min(100, progressRow?.progress ?? 0))
        const currentStatus = statusFor(progress, progressRow?.status)
        const ratings = reviewsByUser.get(profile.id) ?? []
        const completedBooks = Array.from(readsByUser.get(profile.id) ?? [])
        for (const row of reviewRows.filter((review) => review.user_id === profile.id)) reviewsByBook.set(`${profile.id}:${row.book_id}`, row.rating)
        const badges: Badge[] = []
        for (const bookId of completedBooks) {
          const book = booksById.get(bookId)
          if (!book) continue
          badges.push({ id: book.id, title: book.title, author: book.author, rating: reviewsByBook.get(`${profile.id}:${bookId}`) ?? null, coverUrl: book.cover_url || (book.title.toLowerCase() === 'parable of the sower' ? parablePlaceholder : null), badgeUrl: book.title.toLowerCase() === 'parable of the sower' ? parableBadge : null, kind: 'book' })
        }
        const assignedKeys = assignedBadgesByUser.get(profile.id) ?? []
        if (assignedKeys.includes('parable-of-the-sower') && !badges.some((badge) => badge.title.toLowerCase() === 'parable of the sower')) badges.push({ id: `${profile.id}-parable-of-the-sower`, title: 'Parable of the Sower', author: 'Octavia E. Butler', badgeUrl: parableBadge, rating: null, kind: 'milestone' })
        if (assignedKeys.includes('husbands-secret') && !badges.some((badge) => badge.title.toLowerCase() === "a husband's secret")) badges.push({ id: `${profile.id}-husbands-secret`, title: "A Husband's Secret", author: 'Liane Moriarty', badgeUrl: husbandsSecretBadge, rating: null, kind: 'milestone' })
        if (assignedKeys.includes('club-meeting')) badges.push({ id: `${profile.id}-club-meeting`, title: 'Book club meeting', author: '', badgeUrl: clubMeetingBadge, rating: null, kind: 'milestone' })
        const finishedHistoricalBooks = completedBooks.filter((bookId) => historicalClubBookIds.has(bookId)).length
        const completionRate = historicalClubBookIds.size ? Math.round((finishedHistoricalBooks / historicalClubBookIds.size) * 100) : 0
        return { id: profile.id, name: profile.full_name || profile.username, username: profile.username, avatarUrl: profile.avatar_url, status: currentStatus.status, statusKey: currentStatus.statusKey, progress, booksRead: completedBooks.length, averageRating: ratings.length ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length : null, completionRate, badges }
      })

      const allBookIds = new Set(clubCompletedRows.map((row) => row.book_id))
      const allRatings = reviewRows.map((row) => row.rating)
      const stats: ClubStats = { memberCount: nextMembers.length, booksRead: allBookIds.size, averageRating: allRatings.length ? allRatings.reduce((sum, rating) => sum + rating, 0) / allRatings.length : null }
      const leaders = [...nextMembers].sort((a, b) => readerScore(b) - readerScore(a) || a.name.localeCompare(b.name))
      const currentBook = currentBookId ? booksById.get(currentBookId) : null
      const nextTitle = currentBook?.title || 'The current club read'
      setMembers(nextMembers); setClubStats(stats); setCurrentBookTitle(nextTitle); setTopReaders(leaders); setLoading(false)
      try { localStorage.setItem(cacheKey, JSON.stringify({ members: nextMembers, stats, currentBookTitle: nextTitle, topReaders: leaders })) } catch { /* Cache is optional. */ }
    }
    loadMembers()
    return () => { cancelled = true }
  }, [user])

  const visibleMembers = useMemo(() => { const query = search.trim().toLowerCase(); return query ? members.filter((member) => `${member.name} ${member.username}`.toLowerCase().includes(query)) : members }, [members, search])
  const currentCounts = useMemo(() => members.reduce((counts, member) => { counts[member.statusKey] += 1; return counts }, { completed: 0, reading: 0, notStarted: 0, skipping: 0 }), [members])
  const currentAverage = members.length ? Math.round(members.reduce((sum, member) => sum + (member.statusKey === 'skipping' ? 0 : member.progress), 0) / members.length) : 0

  return <section className={`${styles.page} editorial-page`}>
    <section className={`${styles.pageHero} editorial-hero`}><div className="editorial-hero-inner"><p className={`${styles.heroKicker} editorial-kicker`}>MEMBERS</p><h1>Meet the <em>members.</em></h1><p className="editorial-subtitle">Our smart shawties.</p></div></section>
    <div className={styles.membersShell}>
      <main className={styles.membersMain}>
        <div className={styles.toolbar}><div className={styles.viewLabel}>Current read <span>{members.length}</span></div><label className={styles.search}><span aria-hidden="true">⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search members..." /></label></div>
        {error ? <div className={styles.empty}>{error}</div> : loading ? <div className={styles.memberGrid} aria-label="Loading members">{Array.from({ length: 6 }).map((_, index) => <div className={styles.skeleton} key={index} />)}</div> : visibleMembers.length === 0 ? <div className={styles.empty}>{members.length ? 'No members match that search.' : 'No members yet.'}</div> : <div className={styles.memberGrid}>{visibleMembers.map((member) => <article className={styles.memberCard} key={member.id} onClick={() => setSelectedMember(member)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') setSelectedMember(member) }} role="button" tabIndex={0}>
          <div className={styles.memberIdentity}>{member.avatarUrl ? <img className={styles.avatar} src={member.avatarUrl} alt="" /> : <div className={styles.avatar}>{member.name.slice(0, 1).toUpperCase()}</div>}<div><h2>{member.name}</h2><p>{member.username}</p></div></div>
          <div className={`${styles.status} ${styles[member.statusKey]}`}><span aria-hidden="true">{member.statusKey === 'completed' ? '✓' : member.statusKey === 'skipping' ? '×' : member.statusKey === 'reading' ? '▥' : '○'}</span>{member.status}{member.statusKey === 'reading' && <strong> · {member.progress}%</strong>}</div>
          <div className={styles.memberStats}><span>▤ &nbsp;{member.booksRead} club read{member.booksRead === 1 ? '' : 's'}</span><span>{member.averageRating === null ? '—' : `★ ${formatRating(member.averageRating)}`}</span></div>
        </article>)}</div>}
      </main>
      <aside className={styles.sidebar}>
        <section className={styles.sideCard}><h2>The Club at a <em>glance.</em></h2><div className={styles.glanceRows}><div><span>♧</span><strong>{clubStats.memberCount}</strong><small>members</small></div><div><span>▤</span><strong>{clubStats.booksRead}</strong><small>books read together</small></div><div><span>☆</span><strong>{formatRating(clubStats.averageRating)}</strong><small>average rating</small></div></div></section>
        <section className={styles.sideCard}><h2>Current book <em>progress.</em></h2><p className={styles.currentBookName}>{currentBookTitle}</p><div className={styles.progressLine}><span style={{ width: `${currentAverage}%` }} /></div><strong className={styles.progressNumber}>{currentAverage}%</strong><div className={styles.countPills}><span className={styles.completed}>✓ &nbsp;{currentCounts.completed} completed</span><span className={styles.reading}>▥ &nbsp;{currentCounts.reading} in progress</span><span className={styles.notStarted}>○ &nbsp;{currentCounts.notStarted} not started</span><span className={styles.skipping}>× &nbsp;{currentCounts.skipping} skipping</span></div></section>
        <section className={styles.sideCard}><h2>Top <em>readers.</em></h2><ol className={styles.leaderList}>{topReaders.map((reader, index) => <li key={reader.id}><span className={styles.rank}>{readerRank(topReaders, index)}</span>{reader.avatarUrl ? <img src={reader.avatarUrl} alt="" /> : <span className={styles.miniAvatar}>{reader.name.slice(0, 1)}</span>}<strong>{reader.name}</strong><small>{reader.booksRead} read{reader.booksRead === 1 ? '' : 's'}{reader.statusKey === 'reading' && reader.progress > 0 ? ` · ${reader.progress}% current` : ''}</small></li>)}</ol></section>
      </aside>
    </div>
    {selectedMember && <div className={styles.profileBackdrop} role="presentation" onClick={() => setSelectedMember(null)}><section className={styles.profileModal} role="dialog" aria-modal="true" aria-labelledby="member-profile-title" onClick={(event) => event.stopPropagation()}>
      <button type="button" className={styles.closeProfile} onClick={() => setSelectedMember(null)} aria-label="Close member profile">×</button>
      <div className={styles.profileHeader}>{selectedMember.avatarUrl ? <img className={styles.profileAvatar} src={selectedMember.avatarUrl} alt="" /> : <div className={styles.profileAvatar}>{selectedMember.name.slice(0, 1).toUpperCase()}</div>}<div><h2 id="member-profile-title">{selectedMember.name}</h2><p>{selectedMember.username}</p></div></div>
      <h3>Reading snapshot.</h3><div className={styles.snapshot}><div><strong>{selectedMember.booksRead}</strong><small>club reads</small></div><div><strong>{formatRating(selectedMember.averageRating)}</strong><small>avg rating</small></div><div><strong>{selectedMember.completionRate}%</strong><small>completion rate</small></div></div>
      <div className={styles.profileSectionHeading}><h3>Badges <span>({selectedMember.badges.length})</span></h3></div>
      {selectedMember.badges.length ? <div className={styles.badgeShelf}>{selectedMember.badges.map((badge) => <div className={styles.bookBadge} key={badge.id} title={`${badge.title} — ${badge.author}`}>{badge.badgeUrl ? <img src={badge.badgeUrl} alt={`${badge.title} badge`} /> : <span>✦</span>}</div>)}</div> : <p className={styles.profileEmpty}>No club reads yet.</p>}
      <div className={styles.profileSectionHeading}><h3>Recent club reads.</h3></div>
      {selectedMember.badges.filter((badge) => badge.kind !== 'milestone').slice(0, 4).map((badge) => <div className={styles.recentRead} key={`recent-${badge.id}`}>{badge.coverUrl ? <img src={badge.coverUrl} alt="" /> : <div className={styles.recentPlaceholder}>✦</div>}<div><strong>{badge.title}</strong><span className={`${styles.status} ${styles.completed}`}>✓ Completed</span>{badge.rating !== null && <span className={styles.recentRating}>★ {formatRating(badge.rating)}</span>}</div></div>)}
      {selectedMember.badges.filter((badge) => badge.kind !== 'milestone').length === 0 && <p className={styles.profileEmpty}>Their completed books will appear here.</p>}
    </section></div>}
  </section>
}

export default Members
