import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import styles from './Members.module.css'

type Member = {
  id: string
  name: string
  username: string
  progress: number
  status: 'reading' | 'paused' | 'skipping' | 'completed' | 'not_started'
}

const demoMembers: Member[] = [
  { id: 'carla', name: 'Carla', username: '@carla', progress: 45, status: 'reading' },
  { id: 'jane', name: 'Jane', username: '@jane', progress: 72, status: 'reading' },
  { id: 'maya', name: 'Maya', username: '@maya', progress: 0, status: 'skipping' },
  { id: 'sophie', name: 'Sophie', username: '@sophie', progress: 100, status: 'completed' },
]

function Members() {
  const { user } = useAuth()
  const [members, setMembers] = useState<Member[]>(demoMembers)
  const [bookTitle, setBookTitle] = useState("A Husband's Secret")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadMembers() {
      if (!supabase || !user) {
        setLoading(false)
        return
      }

      const { data: currentBook } = await supabase.from('club_books').select('book_id').eq('is_current', true).limit(1).maybeSingle()
      if (!currentBook) {
        setLoading(false)
        return
      }

      const [{ data: profiles }, { data: progress }, { data: book }] = await Promise.all([
        supabase.from('profiles').select('id, username, full_name'),
        supabase.from('reading_progress').select('user_id, progress, status').eq('book_id', currentBook.book_id),
        supabase.from('books').select('title').eq('id', currentBook.book_id).maybeSingle(),
      ])

      if (book) setBookTitle(book.title)
      const progressByUser = new Map((progress ?? []).map((item) => [item.user_id, item]))
      setMembers((profiles ?? []).map((profile) => {
        const saved = progressByUser.get(profile.id)
        return {
          id: profile.id,
          name: profile.full_name || profile.username,
          username: `@${profile.username}`,
          progress: saved?.progress ?? 0,
          status: saved?.status === 'want_to_read' ? 'not_started' : saved?.status ?? 'not_started',
        }
      }))
      setLoading(false)
    }

    loadMembers()
  }, [user])

  return (
    <section className={styles.page}>
      <p className="eyebrow">THE READING ROLL CALL</p>
      <h1>Meet the <em>members.</em></h1>
      <p className={styles.description}>Everyone's progress on <strong>{bookTitle}</strong>, all in one place.</p>

      <div className={styles.list}>
        {loading ? <p className={styles.empty}>Loading the reading roll call...</p> : members.map((member) => (
          <article className={styles.member} key={member.id}>
            <div className={styles.avatar}>{member.name.slice(0, 1).toUpperCase()}</div>
            <div className={styles.identity}><h2>{member.name}</h2><p>{member.username}</p></div>
            <div className={styles.progressArea}>
              <div className={styles.progressLabel}><span>{member.status.replace('_', ' ')}</span><strong>{member.progress}%</strong></div>
              <div className={styles.track}><span style={{ width: `${member.progress}%` }} /></div>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

export default Members
