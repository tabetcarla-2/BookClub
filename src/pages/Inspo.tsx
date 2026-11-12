import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import styles from './Inspo.module.css'

type Venue = { id: string; name: string; address: string | null; notes: string | null }

function Inspo() {
  const { user } = useAuth()
  const [venues, setVenues] = useState<Venue[]>([])
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [clubId, setClubId] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadMeetups() {
      if (!supabase || !user) return
      const { data: membership } = await supabase.from('club_members').select('club_id').eq('user_id', user.id).limit(1).maybeSingle()
      if (!membership) return
      setClubId(membership.club_id)
      const { data, error: fetchError } = await supabase.from('venues').select('id, name, address, notes').eq('club_id', membership.club_id).order('created_at')
      if (fetchError) setError(fetchError.message)
      else setVenues(data ?? [])
    }
    loadMeetups()
  }, [user])

  async function suggestVenue() {
    if (!supabase || !user || !clubId || !name.trim()) return
    const { data, error: insertError } = await supabase.from('venues').insert({ club_id: clubId, name: name.trim(), address: address.trim() || null, suggested_by: user.id }).select('id, name, address, notes').single()
    if (insertError) setError(insertError.message)
    else if (data) { setVenues((previous) => [...previous, data]); setName(''); setAddress('') }
  }

  return (
    <section className={styles.page}>
      <p className="eyebrow">MEET, READ, REPEAT</p>
      <h1>Our meeting <em>spots.</em></h1>
      <p className={styles.description}>Suggest a cosy place for the next chapter of our book club.</p>
      <div className={styles.grid}>
        <article className={`${styles.card} ${styles.pink}`}><span>UPCOMING EVENT</span><h2>Next book club gathering</h2><p>Add the date and venue once the club has chosen a spot.</p></article>
        <article className={`${styles.card} ${styles.green}`}><span>HOSTING NOTE</span><h2>Good light, good coffee.</h2><p>Keep suggestions accessible and easy to find for everyone.</p></article>
      </div>
      <div className={styles.venueSection}>
        <p className="eyebrow">VENUE SUGGESTIONS</p>
        {clubId ? <div className={styles.venueForm}><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Venue name" /><input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Address (optional)" /><button className="primary-button" onClick={suggestVenue}>Suggest spot</button></div> : <p className={styles.description}>Connect this page to a club membership to start suggesting places.</p>}
        {error && <p className={styles.error}>{error}</p>}
        {venues.length > 0 && <div className={styles.venues}>{venues.map((venue) => <article key={venue.id}><h2>{venue.name}</h2><p>{venue.address ?? 'Address to come'}</p>{venue.notes && <small>{venue.notes}</small>}</article>)}</div>}
      </div>
    </section>
  )
}

export default Inspo
