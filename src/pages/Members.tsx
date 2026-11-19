import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import parablePlaceholder from '../assets/parable-of-the-sower-placeholder.svg'
import styles from './Members.module.css'

type Badge = {
  id: string
  title: string
  author: string
  coverUrl?: string | null
}

type Member = {
  id: string
  name: string
  username: string
  avatarUrl?: string | null
  badges: Badge[]
}

function Members() {
  const { user } = useAuth()
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function loadMembers() {
      if (!supabase || !user) {
        setLoading(false)
        return
      }

      const { data: profiles, error: profilesError } = await supabase.from('profiles').select('id, username, full_name, avatar_url').order('full_name')

      if (cancelled) return
      if (profilesError) {
        setError(profilesError.message)
        setLoading(false)
        return
      }

      const initialMembers = (profiles ?? []).map((profile) => ({
        id: profile.id,
        name: profile.full_name || profile.username,
        username: `@${profile.id === user.id ? (user.user_metadata?.username || user.email?.split('@')[0] || profile.username) : profile.username}`,
        avatarUrl: profile.avatar_url,
        badges: [],
      }))
      setMembers(initialMembers)
      setLoading(false)

      const { data: completedProgress, error: progressError } = await supabase.from('reading_progress').select('user_id, book_id').eq('status', 'completed')
      if (cancelled) return
      if (progressError) {
        setError(progressError.message)
        return
      }

      const bookIds = Array.from(new Set((completedProgress ?? []).map((progress) => progress.book_id)))
      const { data: books, error: booksError } = bookIds.length > 0
        ? await supabase.from('books').select('id, title, author, cover_url').in('id', bookIds)
        : { data: [], error: null }

      if (cancelled) return
      if (booksError) {
        setError(booksError.message)
        setLoading(false)
        return
      }

      const booksById = new Map((books ?? []).map((book) => [book.id, book]))
      const badgesByUser = new Map<string, Badge[]>()
      for (const progress of completedProgress ?? []) {
        const book = booksById.get(progress.book_id)
        if (!book) continue
        const badges = badgesByUser.get(progress.user_id) ?? []
        badges.push({ id: book.id, title: book.title, author: book.author, coverUrl: book.cover_url || (book.title.toLowerCase() === 'parable of the sower' ? parablePlaceholder : null) })
        badgesByUser.set(progress.user_id, badges)
      }

      setMembers((currentMembers) => currentMembers.map((member) => ({ ...member, badges: badgesByUser.get(member.id) ?? [] })))
    }

    loadMembers()
    return () => { cancelled = true }
  }, [user])

  return (
    <section className={styles.page}>
      <p className="eyebrow">THE READING ROLL CALL</p>
      <h1>Meet the <em>members.</em></h1>
      <p className={styles.description}>The people behind the pages, plus the books they have finished with the club.</p>

      {loading ? (
        <div className={styles.empty} role="status">Loading the club members...</div>
      ) : error ? (
        <div className={styles.empty}>{error}</div>
      ) : members.length === 0 ? (
        <div className={styles.empty}>No members yet.</div>
      ) : (
        <div className={styles.grid}>
          {members.map((member) => (
            <article className={styles.member} key={member.id}>
              {member.avatarUrl ? <img className={styles.avatar} src={member.avatarUrl} alt="" /> : <div className={styles.avatar}>{member.name.slice(0, 1).toUpperCase()}</div>}
              <div className={styles.identity}>
                <h2>{member.name}</h2>
                <p>{member.username}</p>
              </div>
              <div className={styles.badges}>
                <div className={styles.badgeHeading}><span>BOOK CLUB BADGES</span><strong>{member.badges.length}</strong></div>
                {member.badges.length > 0 ? <div className={styles.badgeList}>{member.badges.map((badge) => <div className={styles.badge} key={badge.id}>{badge.coverUrl ? <img src={badge.coverUrl} alt="" /> : <span className={styles.badgePlaceholder}>✦</span>}<span><strong>{badge.title}</strong><small>{badge.author}</small></span></div>)}</div> : <p className={styles.noBadges}>No completed books yet.</p>}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

export default Members
