import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import coverImage from '../assets/husbands-secret-cover.png'
import { CalendarIcon } from '../components/Icons'
import styles from './Home.module.css'

type HomeBook = { id: string; title: string; author: string; cover_url: string | null; description: string | null }
type RsvpMember = { name: string; avatarUrl: string | null }
type Activity = { id: string; name: string; avatarUrl: string | null; text: string; time: string; timestamp: string }

const fallbackBook: HomeBook = { id: 'demo-current', title: "A Husband's Secret", author: 'Liane Moriarty', cover_url: coverImage, description: 'A seemingly perfect family is upended by a letter that was never meant to be opened.' }
const fallbackMeetup = { title: 'December book discussion', date: '?', time: 'Time to be decided', venue: 'Location to be decided' }
const when2MeetUrl = 'https://www.when2meet.com/?40034234-jVcj9'

function shortTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'recently'
  const hours = Math.max(1, Math.round((Date.now() - date.getTime()) / 3600000))
  return hours < 24 ? `${hours}h ago` : `${Math.round(hours / 24)}d ago`
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
      const [{ data: selectedBook }, { data: currentProgressRow }, { data: event }] = await Promise.all([
        supabase.from('books').select('id, title, author, cover_url, description').eq('id', current.book_id).single(),
        supabase.from('reading_progress').select('progress, status').eq('book_id', current.book_id).eq('user_id', user.id).maybeSingle(),
        supabase.from('events').select('id, title, starts_at, venue_id').gte('starts_at', new Date().toISOString()).order('starts_at', { ascending: true }).limit(1).maybeSingle(),
      ])
      if (cancelled) return
      if (selectedBook) setBook({ ...selectedBook, cover_url: selectedBook.cover_url || (selectedBook.title.toLowerCase() === "a husband's secret" ? coverImage : null) })
      setProgress(currentProgressRow?.status === 'skipping' ? 0 : currentProgressRow?.progress ?? 0)

      if (event) {
        const [{ data: rsvps }, { data: venue }] = await Promise.all([
          supabase.from('event_rsvps').select('user_id').eq('event_id', event.id),
          event.venue_id ? supabase.from('venues').select('name').eq('id', event.venue_id).maybeSingle() : Promise.resolve({ data: null }),
        ])
        setMeetup({ title: event.title, date: '?', time: 'Time to be decided', venue: venue?.name || 'Location to be decided' })
        setRsvpMembers((rsvps ?? []).map((rsvp) => names.get(rsvp.user_id) ?? { name: 'a member', avatarUrl: null }))
      }

      const [{ data: comments }, { data: reviews }, { data: backlogItems }, { data: votes }, { data: progressActivityRows }] = await Promise.all([
        supabase.from('book_comments').select('id, user_id, book_id, created_at').order('created_at', { ascending: false }).limit(8),
        supabase.from('reviews').select('id, user_id, book_id, created_at, rating').order('created_at', { ascending: false }).limit(8),
        supabase.from('backlog_items').select('id, user_id, book_id, created_at').eq('visibility', 'club').order('created_at', { ascending: false }).limit(8),
        supabase.from('book_votes').select('book_id, user_id, vote, created_at').order('created_at', { ascending: false }).limit(8),
        supabase.from('reading_progress').select('user_id, book_id, progress, status, updated_at').order('updated_at', { ascending: false }).limit(8),
      ])
      const activityBookIds = Array.from(new Set([
        ...(comments ?? []).map((item) => item.book_id),
        ...(reviews ?? []).map((item) => item.book_id),
        ...(backlogItems ?? []).map((item) => item.book_id),
        ...(votes ?? []).map((item) => item.book_id),
        ...(progressActivityRows ?? []).map((item) => item.book_id),
      ].filter((bookId) => bookId !== current.book_id)))
      const { data: activityBooks } = activityBookIds.length
        ? await supabase.from('books').select('id, title').in('id', activityBookIds)
        : { data: [] as { id: string; title: string }[] }
      const bookNames = new Map([
        ...(selectedBook ? [[selectedBook.id, selectedBook.title] as [string, string]] : []),
        ...(activityBooks ?? []).map((item) => [item.id, item.title] as [string, string]),
      ])
      const activityBookTitle = (bookId: string) => bookNames.get(bookId) ?? 'a book'
      const activityItems: Activity[] = [
        ...(comments ?? []).map((item) => ({ id: item.id, name: names.get(item.user_id)?.name ?? 'A member', avatarUrl: names.get(item.user_id)?.avatarUrl ?? null, text: `commented on ${activityBookTitle(item.book_id)}`, time: shortTime(item.created_at), timestamp: item.created_at })),
        ...(reviews ?? []).map((item) => ({ id: item.id, name: names.get(item.user_id)?.name ?? 'A member', avatarUrl: names.get(item.user_id)?.avatarUrl ?? null, text: `left a review for ${activityBookTitle(item.book_id)}`, time: shortTime(item.created_at), timestamp: item.created_at })),
        ...(backlogItems ?? []).map((item) => ({ id: item.id, name: names.get(item.user_id)?.name ?? 'A member', avatarUrl: names.get(item.user_id)?.avatarUrl ?? null, text: `added ${activityBookTitle(item.book_id)} to the backlog`, time: shortTime(item.created_at), timestamp: item.created_at })),
        ...(votes ?? []).map((item) => ({ id: `${item.book_id}-${item.user_id}-${item.created_at}`, name: names.get(item.user_id)?.name ?? 'A member', avatarUrl: names.get(item.user_id)?.avatarUrl ?? null, text: `${item.vote === 1 ? 'upvoted' : 'downvoted'} ${activityBookTitle(item.book_id)}`, time: shortTime(item.created_at), timestamp: item.created_at })),
        ...(progressActivityRows ?? []).map((item) => ({ id: `${item.book_id}-${item.user_id}-${item.updated_at}`, name: names.get(item.user_id)?.name ?? 'A member', avatarUrl: names.get(item.user_id)?.avatarUrl ?? null, text: `updated progress on ${activityBookTitle(item.book_id)} to ${item.progress}%`, time: shortTime(item.updated_at), timestamp: item.updated_at })),
      ].sort((first, second) => new Date(second.timestamp).getTime() - new Date(first.timestamp).getTime()).slice(0, 3)
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
          <p className={styles.heroDescription}>Hot people read,<br />and we're hot.</p>
          <Link to="/current-book" className={styles.heroButton}>Explore current read <span>→</span></Link>
        </div>
        <aside className={styles.meetupCard}>
          <div className={styles.meetupLabel}><CalendarIcon size={17} /><span>NEXT MEETUP</span></div>
          <h2><a href={when2MeetUrl} target="_blank" rel="noreferrer">Vote for next meetup</a></h2>
          <p>{meetup.time} · {meetup.venue}</p>
          <div className={styles.rsvpPeople}>
            {rsvpMembers.slice(0, 4).map((member, index) => member.avatarUrl ? <img key={`${member.name}-${index}`} src={member.avatarUrl} alt="" /> : <span key={`${member.name}-${index}`}>{member.name.slice(0, 1).toUpperCase()}</span>)}
            <small>{rsvpMembers.length > 0 ? `+${rsvpMembers.length} going` : 'Be the first to RSVP'}</small>
          </div>
          <Link to="/inspo" className={styles.rsvpLink}>See meetup details <span>→</span></Link>
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
        {activity.length > 0 ? activity.map((item) => <div className={styles.activityItem} key={item.id}>{item.avatarUrl ? <img className={styles.activityAvatar} src={item.avatarUrl} alt={`${item.name}'s profile`} /> : <span className={styles.activityAvatar}>{item.name.slice(0, 1).toUpperCase()}</span>}<p><strong>{item.name}</strong> {item.text} <small>· {item.time}</small></p></div>) : <p className={styles.emptyActivity}>Club activity will show up here as people read, review, and discuss.</p>}
        <Link to="/current-book" className={styles.textLink}>See more <span>→</span></Link>
      </div>
    </section>
  </div>
}

export default Home
