import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import styles from './Admin.module.css'

const ADMIN_EMAIL = 'tabet.carla@gmail.com'
type Book = { id: string; title: string; author: string; cover_url: string | null; genre: string | null; description: string | null }
type Member = { id: string; full_name: string; username: string; avatar_url: string | null; badgeKeys: string[] }
type ClubBook = { id: string; book_id: string; starts_on: string | null; ends_on: string | null; is_current: boolean }
type Badge = { key: string; title: string; description: string }

function Admin() {
  const { user } = useAuth()
  const [books, setBooks] = useState<Book[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [clubBooks, setClubBooks] = useState<ClubBook[]>([])
  const [badgeDefinitions, setBadgeDefinitions] = useState<Badge[]>([])
  const [selectedBookId, setSelectedBookId] = useState('')
  const [startsOn, setStartsOn] = useState(new Date().toISOString().slice(0, 10))
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [newBook, setNewBook] = useState({ title: '', author: '', genre: '', cover_url: '', description: '' })

  async function loadAdminData() {
    if (!supabase) return
    const [booksResult, profilesResult, clubBooksResult, badgesResult, assignmentsResult] = await Promise.all([
      supabase.from('books').select('id, title, author, cover_url, genre, description').order('title'),
      supabase.from('profiles').select('id, full_name, username, avatar_url').order('full_name'),
      supabase.from('club_books').select('id, book_id, starts_on, ends_on, is_current').order('created_at', { ascending: false }),
      supabase.from('badges').select('key, title, description').order('title'),
      supabase.from('profile_badges').select('user_id, badge_key'),
    ])
    const firstError = booksResult.error || profilesResult.error || clubBooksResult.error || badgesResult.error || assignmentsResult.error
    if (firstError) { setError(firstError.message); return }
    setBooks(booksResult.data ?? [])
    setClubBooks(clubBooksResult.data ?? [])
    setBadgeDefinitions(badgesResult.data ?? [])
    const assigned = new Map<string, string[]>()
    ;(assignmentsResult.data ?? []).forEach((row) => assigned.set(row.user_id, [...(assigned.get(row.user_id) ?? []), row.badge_key]))
    setMembers((profilesResult.data ?? []).map((profile) => ({ ...profile, badgeKeys: assigned.get(profile.id) ?? [] })))
    const current = (clubBooksResult.data ?? []).find((row) => row.is_current)
    if (current) setSelectedBookId(current.book_id)
  }

  useEffect(() => { if (user?.email?.toLowerCase() === ADMIN_EMAIL) loadAdminData() }, [user])

  async function setCurrentBook() {
    if (!supabase || !selectedBookId) return
    setBusy(true); setError(''); setMessage('')
    const { error: actionError } = await supabase.rpc('admin_set_current_book', { target_book_id: selectedBookId, target_starts_on: startsOn })
    if (actionError) setError(actionError.message)
    else { setMessage('Current book updated. The previous selection is now in the club archive.'); await loadAdminData() }
    setBusy(false)
  }

  async function finishCurrentBook() {
    if (!supabase || !window.confirm('Mark the current book as finished and move it to the club archive?')) return
    setBusy(true); setError(''); setMessage('')
    const { error: actionError } = await supabase.rpc('admin_finish_current_book', { target_ends_on: new Date().toISOString().slice(0, 10) })
    if (actionError) setError(actionError.message)
    else { setMessage('Current book marked as finished.'); await loadAdminData() }
    setBusy(false)
  }

  async function createBook(event: React.FormEvent) {
    event.preventDefault()
    if (!supabase || !newBook.title.trim() || !newBook.author.trim()) return
    setBusy(true); setError(''); setMessage('')
    const { data, error: actionError } = await supabase.from('books').insert({ title: newBook.title.trim(), author: newBook.author.trim(), genre: newBook.genre.trim() || null, cover_url: newBook.cover_url.trim() || null, description: newBook.description.trim() || null }).select('id, title, author, cover_url, genre, description').single()
    if (actionError) setError(actionError.message)
    else if (data) { setBooks((current) => [...current, data].sort((a, b) => a.title.localeCompare(b.title))); setSelectedBookId(data.id); setNewBook({ title: '', author: '', genre: '', cover_url: '', description: '' }); setMessage('Book added. It is ready to make current.'); }
    setBusy(false)
  }

  async function toggleBadge(member: Member, badgeKey: string) {
    if (!supabase) return
    setError(''); setMessage('')
    const hasBadge = member.badgeKeys.includes(badgeKey)
    const { error: actionError } = await supabase.rpc(hasBadge ? 'admin_remove_badge' : 'admin_assign_badge', hasBadge ? { target_user_id: member.id, target_badge_key: badgeKey } : { target_user_id: member.id, target_badge_key: badgeKey })
    if (actionError) setError(actionError.message)
    else { setMembers((current) => current.map((item) => item.id === member.id ? { ...item, badgeKeys: hasBadge ? item.badgeKeys.filter((key) => key !== badgeKey) : [...item.badgeKeys, badgeKey] } : item)); setMessage(`${hasBadge ? 'Removed' : 'Assigned'} badge ${hasBadge ? 'from' : 'to'} ${member.full_name || member.username}.`) }
  }

  async function deleteMember(member: Member) {
    if (!supabase || !window.confirm(`Delete ${member.full_name || member.username}'s account? This cannot be undone.`)) return
    setBusy(true); setError(''); setMessage('')
    const { error: actionError } = await supabase.rpc('admin_delete_user', { target_user_id: member.id })
    if (actionError) setError(actionError.message)
    else { setMembers((current) => current.filter((item) => item.id !== member.id)); setMessage('User deleted.'); }
    setBusy(false)
  }

  if (!user || user.email?.toLowerCase() !== ADMIN_EMAIL) return <section className={styles.denied}><p className="eyebrow">PRIVATE AREA</p><h1>Admin access only.</h1><p>This page is only available to the book club administrator.</p></section>
  const current = clubBooks.find((row) => row.is_current)
  const currentBook = books.find((book) => book.id === current?.book_id)

  return <section className={`${styles.page} editorial-page`}>
    <section className={`${styles.hero} editorial-hero`}><div className="editorial-hero-inner"><p className="editorial-kicker">PRIVATE ADMIN</p><h1>Club <em>controls.</em></h1><p className="editorial-subtitle">Manage the reading calendar, milestones, and membership.</p></div></section>
    <main className={styles.shell}>
      {message && <p className={styles.message}>{message}</p>}{error && <p className={styles.error}>{error}</p>}
      <section className={styles.card}><div className={styles.cardHeading}><div><p className="eyebrow">READING CALENDAR</p><h2>Choose the current book</h2></div><span>{currentBook ? `Current: ${currentBook.title}` : 'No current book'}</span></div><div className={styles.controls}><label>Book<select value={selectedBookId} onChange={(event) => setSelectedBookId(event.target.value)}><option value="">Select a book</option>{books.map((book) => <option value={book.id} key={book.id}>{book.title} — {book.author}</option>)}</select></label><label>Starts on<input type="date" value={startsOn} onChange={(event) => setStartsOn(event.target.value)} /></label><button className="primary-button" type="button" onClick={setCurrentBook} disabled={busy || !selectedBookId}>Make current</button><button className={styles.secondaryButton} type="button" onClick={finishCurrentBook} disabled={busy || !current}>Mark finished</button></div></section>
      <section className={styles.card}><div className={styles.cardHeading}><div><p className="eyebrow">NEW BOOK</p><h2>Add a book directly</h2></div><span>For books not yet in the backlog</span></div><form className={styles.bookForm} onSubmit={createBook}>{(['title', 'author', 'genre', 'cover_url'] as const).map((field) => <label key={field}>{field === 'cover_url' ? 'Cover URL' : field[0].toUpperCase() + field.slice(1)}<input value={newBook[field]} onChange={(event) => setNewBook({ ...newBook, [field]: event.target.value })} required={field === 'title' || field === 'author'} /></label>)}<label className={styles.wide}>Description<textarea value={newBook.description} onChange={(event) => setNewBook({ ...newBook, description: event.target.value })} rows={3} /></label><button className="primary-button" type="submit" disabled={busy}>Add book</button></form></section>
      <section className={styles.card}><div className={styles.cardHeading}><div><p className="eyebrow">MILESTONES</p><h2>Assign badges</h2></div><span>{members.length} members</span></div><div className={styles.memberList}>{members.map((member) => <div className={styles.memberRow} key={member.id}><div className={styles.memberIdentity}>{member.avatar_url ? <img src={member.avatar_url} alt="" /> : <span>{(member.full_name || member.username).slice(0, 1).toUpperCase()}</span>}<div><strong>{member.full_name || member.username}</strong><small>{member.username}</small></div></div><div className={styles.badgeActions}>{badgeDefinitions.map((badge) => <button type="button" className={member.badgeKeys.includes(badge.key) ? styles.assigned : styles.unassigned} key={badge.key} onClick={() => toggleBadge(member, badge.key)} title={badge.description}>{member.badgeKeys.includes(badge.key) ? '✓ ' : '+ '}{badge.title}</button>)}</div><button type="button" className={styles.deleteButton} onClick={() => deleteMember(member)} disabled={busy}>Delete user</button></div>)}</div></section>
    </main>
  </section>
}

export default Admin
