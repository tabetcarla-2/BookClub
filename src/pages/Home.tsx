import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import coverImage from '../assets/husbands-secret-cover.png'
import { CalendarIcon } from '../components/Icons'
import styles from './Home.module.css'

type HomeBook = { id: string; title: string; author: string; cover_url: string | null; description: string | null }
type RsvpMember = { name: string; avatarUrl: string | null }
type Activity = { id: string; name: string; text: string; time: string }

const fallbackBook: HomeBook = { id: 'demo-current', title: "A Husband's Secret", author: 'Liane Moriarty', cover_url: coverImage, description: 'A seemingly perfect family is upended by a letter that was never meant to be opened.' }
const fallbackMeetup = { title: 'November book discussion', date: 'Thu, Nov 21', time: '7:00 PM', venue: 'The Rabbit Books & Bar' }

function shortTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'recently'
  const hours = Math.max(1, Math.round((Date.now() - date.getTime()) / 3600000))
  return hours < 24 ? `${hours}h ago` : `${Math.round(hours / 24)}d ago`
}

function formatMeetup(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return { date: fallbackMeetup.date, time: fallbackMeetup.time }
  return { date: new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).format(date), time: new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(date) }
}

function Home() {
  const { user } = useAuth()
  const [book, setBook] = useState<HomeBook>(fallbackBook)
  const [progress, setProgress] = useState(0)
  const [meetup, setMeetup] = useState(fallbackMeetup)
  const [rsvpMembers, setRsvpMembers] = useState<RsvpMember[]>([])
  const [activity, setActivity] = useState<Activity[]>([])

  useEffect(() => {
    let cancelled = false
    async function loadHome() {
      if (!supabase || !user) return
      const [{ data: current }, { data: profiles }] = await Promise.all([
        supabase.from('club_books').select('book_id').eq('is_current', true).limit(1).maybeSingle(),
        supabase.from('profiles').select('id, full_name, username, avatar_url'),
      ])
      if (cancelled || !current) return
      const names = new Map((profiles ?? []).map((profile) => [profile.id, { name: profile.full_name || profile.username || 'a member', avatarUrl: profile.avatar_url }]))
      const [{ data: selectedBook }, { data: progressRows }, { data: event }] = await Promise.all([
        supabase.from('books').select('id, title, author, cover_url, description').eq('id', current.book_id).single(),
        supabase.from('reading_progress').select('progress, status').eq('book_id', current.book_id),
        supabase.from('events').select('id, title, starts_at, venue_id').gte('starts_at', new Date().toISOString()).order('starts_at', { ascending: true }).limit(1).maybeSingle(),
      ])
      if (cancelled) return
      if (selectedBook) setBook({ ...selectedBook, cover_url: selectedBook.cover_url || (selectedBook.title.toLowerCase() === "a husband's secret" ? coverImage : null) })
      const activeProgress = (progressRows ?? []).filter((row) => row.status !== 'skipping')
      if (activeProgress.length > 0) setProgress(Math.round(activeProgress.reduce((sum, row) => sum + row.progress, 0) / activeProgress.length))

      if (event) {
        const [{ data: rsvps }, { data: venue }] = await Promise.all([
          supabase.from('event_rsvps').select('user_id').eq('event_id', event.id),
          event.venue_id ? supabase.from('venues').select('name').eq('id', event.venue_id).maybeSingle() : Promise.resolve({ data: null }),
        ])
        const formatted = formatMeetup(event.starts_at)
        setMeetup({ title: event.title, date: formatted.date, time: formatted.time, venue: venue?.name || 'Location to be decided' })
        setRsvpMembers((rsvps ?? []).map((rsvp) => names.get(rsvp.user_id) ?? { name: 'a member', avatarUrl: null }))
      }

      const [{ data: comments }, { data: reviews }] = await Promise.all([
        supabase.from('book_comments').select('id, user_id, content, created_at').eq('book_id', current.book_id).order('created_at', { ascending: false }).limit(3),
        supabase.from('reviews').select('id, user_id, comment, created_at').eq('book_id', current.book_id).order('created_at', { ascending: false }).limit(3),
      ])
      const activityItems: Activity[] = [
        ...(comments ?? []).map((item) => ({ id: item.id, name: names.get(item.user_id)?.name ?? 'A member', text: 'added a comment', time: shortTime(item.created_at) })),
        ...(reviews ?? []).map((item) => ({ id: item.id, name: names.get(item.user_id)?.name ?? 'A member', text: 'left a review', time: shortTime(item.created_at) })),
      ].slice(0, 3)
      if (!cancelled) setActivity(activityItems)
    }
    loadHome()
    return () => { cancelled = true }
  }, [user])

  return <div className={styles.home}>
    <section className={styles.hero}>
      <div className={styles.heroContent}>
        <div className={styles.heroCopy}>
          <p className={styles.heroKicker}>NYC BOOK CLUB</p>
          <h1>A book club<br />for <em>New Yorkers.</em></h1>
          <p className={styles.heroDescription}>Good books, great conversation,<br />and even better company.</p>
          <Link to="/current-book" className={styles.heroButton}>Explore current read <span>→</span></Link>
        </div>
        <aside className={styles.meetupCard}>
          <div className={styles.meetupLabel}><CalendarIcon size={17} /><span>NEXT MEETUP</span></div>
          <h2>{meetup.date}</h2>
          <p>{meetup.time} · {meetup.venue}</p>
          <div className={styles.rsvpPeople}>
            {rsvpMembers.slice(0, 4).map((member, index) => member.avatarUrl ? <img key={`${member.name}-${index}`} src={member.avatarUrl} alt="" /> : <span key={`${member.name}-${index}`}>{member.name.slice(0, 1).toUpperCase()}</span>)}
            <small>{rsvpMembers.length > 0 ? `+${rsvpMembers.length} going` : 'Be the first to RSVP'}</small>
          </div>
          <Link to="/inspo" className={styles.rsvpLink}>RSVP <span>→</span></Link>
        </aside>
      </div>
    </section>

    <section className={styles.dashboardPanel}>
      <div className={styles.currentReading}>
        <Link to="/current-book" className={styles.coverLink}><img src={book.cover_url || coverImage} alt={`Cover of ${book.title}`} /></Link>
        <div className={styles.readingInfo}>
          <p className="eyebrow">CURRENTLY READING</p>
          <Link to="/current-book"><h2>{book.title}</h2></Link>
          <p className={styles.author}>by {book.author}</p>
          <div className={styles.progressLine}><div className={styles.progressTrack}><span style={{ width: `${progress}%` }} /></div><strong>{progress}%</strong></div>
          <p className={styles.bookDescription}>{book.description || 'Read along with the club and bring your favourite passages to the next discussion.'}</p>
          <Link to="/current-book" className={styles.textLink}>View discussion <span>→</span></Link>
        </div>
      </div>
      <div className={styles.activityPanel}>
        <h2>Recent activity</h2>
        {activity.length > 0 ? activity.map((item) => <div className={styles.activityItem} key={item.id}><span className={styles.activityAvatar}>{item.name.slice(0, 1).toUpperCase()}</span><p><strong>{item.name}</strong> {item.text} <small>· {item.time}</small></p></div>) : <p className={styles.emptyActivity}>Club activity will show up here as people read, review, and discuss.</p>}
        <Link to="/current-book" className={styles.textLink}>See more <span>→</span></Link>
      </div>
    </section>
  </div>
}

export default Home
