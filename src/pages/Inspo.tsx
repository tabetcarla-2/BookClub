import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import styles from './Inspo.module.css'

type PlaceSuggestion = { place_id: string; display_name: string; name?: string; lat: string; lon: string }
type VenueComment = { id: string; content: string; author: string }
type Venue = { id: string; name: string; address: string | null; notes: string | null; category: string; categories: string[]; keywords: string[]; latitude: number | null; longitude: number | null; suggestedBy: string; suggestedById: string; groupTried: boolean; groupMarkedBy: string | null; groupMarkedById: string | null; groupRating: number | null; groupRatingCount: number; userRating: number | null; upvotes: number; downvotes: number; userVote: 1 | -1 | null; comments: VenueComment[] }
type VoteRow = { venue_id: string; user_id: string; vote: 1 | -1 }
type GroupVisitRow = { venue_id: string; marked_by: string; tried_at: string }
type RatingRow = { venue_id: string; user_id: string; rating: number }
type CommentRow = { id: string; venue_id: string; user_id: string; content: string }
const venueCategories = ['cafe', 'library', 'bookstore', 'wine-bar', 'other']
const venueKeywords = ['bookish', 'discussion-friendly', 'good for groups', 'quiet corner', 'cozy', 'coffee', 'wine', 'daytime', 'nighttime', 'outdoor']

function googleMapsUrl(name: string, address: string | null) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address ? `${name}, ${address}` : name)}`
}

function cleanAddress(value: string | null, placeName?: string) {
  if (!value) return null
  const name = placeName?.trim().toLowerCase()
  const parts = value.split(',').map((part) => part.trim()).filter(Boolean)
  const cleaned = parts.filter((part, index) => {
    if (/manhattan community board\s*\d+/i.test(part) || /new york county|united states/i.test(part)) return false
    if (index === 0 && name && part.toLowerCase() === name) return false
    return !/^manhattan$/i.test(part)
  })
  return cleaned.join(', ') || null
}

function tileCoordinates(latitude: number, longitude: number, zoom: number) {
  const scale = 2 ** zoom
  const x = ((longitude + 180) / 360) * scale
  const y = ((1 - Math.asinh(Math.tan((latitude * Math.PI) / 180)) / Math.PI) / 2) * scale
  return { x, y }
}

function VenueMap({ venues, selectedVenueId, onSelect }: { venues: Venue[]; selectedVenueId: string | null; onSelect: (id: string) => void }) {
  const located = venues.filter((venue) => venue.latitude !== null && venue.longitude !== null)
  const center = located.length > 0
    ? { latitude: located.reduce((sum, venue) => sum + (venue.latitude as number), 0) / located.length, longitude: located.reduce((sum, venue) => sum + (venue.longitude as number), 0) / located.length }
    : { latitude: 40.725, longitude: -73.99 }
  const zoom = 13
  const centerTile = tileCoordinates(center.latitude, center.longitude, zoom)
  const originX = Math.floor(centerTile.x) - 2
  const originY = Math.floor(centerTile.y) - 1
  const centerX = (centerTile.x - originX) * 256
  const centerY = (centerTile.y - originY) * 256
  const tiles = []
  for (let x = originX; x <= originX + 4; x += 1) {
    for (let y = originY; y <= originY + 2; y += 1) tiles.push({ x, y })
  }

  return <div className={styles.mapCanvas} aria-label="Map view of saved meeting spots">
    {tiles.map((tile) => <img className={styles.mapTile} key={`${tile.x}-${tile.y}`} src={`https://tile.openstreetmap.org/${zoom}/${tile.x}/${tile.y}.png`} alt="" style={{ left: `calc(50% + ${(tile.x - originX) * 256 - centerX}px)`, top: `calc(50% + ${(tile.y - originY) * 256 - centerY}px)` }} />)}
    {located.map((venue, index) => { const point = tileCoordinates(venue.latitude as number, venue.longitude as number, zoom); return <button type="button" className={`${styles.mapPin} ${selectedVenueId === venue.id ? styles.selectedPin : ''}`} style={{ left: `calc(50% + ${(point.x - originX) * 256 - centerX}px)`, top: `calc(50% + ${(point.y - originY) * 256 - centerY}px)` }} key={venue.id} onClick={() => { onSelect(venue.id); window.open(googleMapsUrl(venue.name, venue.address), '_blank', 'noopener,noreferrer') }} title={`Open ${venue.name} in Google Maps`}><span>{index + 1}</span><strong>{venue.name}</strong></button> })}
    {located.length === 0 && <p className={styles.mapNote}>Select addresses from search to place them on the map.</p>}
    <span className={styles.mapAttribution}>© OpenStreetMap contributors</span>
  </div>
}

function Inspo() {
  const { user } = useAuth()
  const [venues, setVenues] = useState<Venue[]>([])
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [notes, setNotes] = useState('')
  const [category, setCategory] = useState('cafe')
  const [categories, setCategories] = useState<string[]>(['cafe'])
  const [keywords, setKeywords] = useState<string[]>([])
  const [keywordInput, setKeywordInput] = useState('')
  const [editingVenueId, setEditingVenueId] = useState<string | null>(null)
  const [coordinates, setCoordinates] = useState<{ latitude: number; longitude: number } | null>(null)
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([])
  const [view, setView] = useState<'cards' | 'map'>('cards')
  const [trialFilter, setTrialFilter] = useState<'all' | 'tried' | 'untried'>('all')
  const [tagFilter, setTagFilter] = useState('all')
  const [showAddForm, setShowAddForm] = useState(false)
  const [placeSelected, setPlaceSelected] = useState(false)
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const query = name.trim()
    if (placeSelected || query.length < 2) { setSuggestions([]); return }
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setSearching(true)
      try {
        const params = new URLSearchParams({ format: 'jsonv2', q: `${query}, New York, NY`, viewbox: '-74.03,40.88,-73.90,40.68', bounded: '1', limit: '6', addressdetails: '1', namedetails: '1', countrycodes: 'us' })
        const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, { signal: controller.signal, headers: { 'Accept-Language': 'en' } })
        if (!response.ok) throw new Error('Place search is unavailable right now.')
        setSuggestions(await response.json() as PlaceSuggestion[])
      } catch (searchError) {
        if (searchError instanceof DOMException && searchError.name === 'AbortError') return
        setError(searchError instanceof Error ? searchError.message : 'Place search is unavailable right now.')
      } finally { setSearching(false) }
    }, 350)
    return () => { controller.abort(); window.clearTimeout(timer) }
  }, [name, placeSelected])

  useEffect(() => {
    let cancelled = false
    async function loadMeetups() {
      if (!supabase || !user) { setLoading(false); return }
      const cacheKey = `bookclub-meetups-${user.id}`
      try {
        const cached = localStorage.getItem(cacheKey)
        if (cached) {
          const parsed = JSON.parse(cached) as Venue[]
          if (Array.isArray(parsed)) { setVenues(parsed); setLoading(false) }
        }
      } catch {
        // Ignore unavailable or malformed browser cache and load from Supabase.
      }
      const { data, error: fetchError } = await supabase.from('venues').select('id, name, address, notes, category, categories, keywords, latitude, longitude, suggested_by').order('created_at')
      if (fetchError) { setError(fetchError.message); setLoading(false); return }
      const venueIds = (data ?? []).map((venue) => venue.id)
      const baseVenues = (data ?? []).map((venue) => ({ id: venue.id, name: venue.name, address: cleanAddress(venue.address), notes: venue.notes, category: venue.category, categories: venue.categories?.length ? venue.categories : [venue.category], keywords: venue.keywords ?? [], latitude: venue.latitude, longitude: venue.longitude, suggestedBy: 'a member', suggestedById: venue.suggested_by, groupTried: false, groupMarkedBy: null, groupMarkedById: null, groupRating: null, groupRatingCount: 0, userRating: null, upvotes: 0, downvotes: 0, userVote: null, comments: [] })) as Venue[]
      if (cancelled) return
      setVenues(baseVenues)
      setLoading(false)
      const [groupVisitResult, profileResult, voteResult, ratingResult, commentResult] = venueIds.length > 0 ? await Promise.all([
        supabase.from('venue_group_visits').select('venue_id, marked_by, tried_at').in('venue_id', venueIds),
        supabase.from('profiles').select('id, full_name, username'),
        supabase.from('venue_votes').select('venue_id, user_id, vote').in('venue_id', venueIds),
        supabase.from('venue_ratings').select('venue_id, user_id, rating').in('venue_id', venueIds),
        supabase.from('venue_comments').select('id, venue_id, user_id, content').in('venue_id', venueIds).order('created_at', { ascending: true }),
      ]) : [{ data: [] as GroupVisitRow[] }, { data: [] }, { data: [] as VoteRow[] }, { data: [] as RatingRow[] }, { data: [] as CommentRow[] }]
      if (cancelled) return
      const names = new Map((profileResult.data ?? []).map((profile) => [profile.id, profile.full_name || `@${profile.username}`]))
      const groupVisits = (groupVisitResult.data ?? []) as GroupVisitRow[]
      const votes = (voteResult.data ?? []) as VoteRow[]
      const ratings = (ratingResult.data ?? []) as RatingRow[]
      const comments = (commentResult.data ?? []) as CommentRow[]
      const loadedVenues = (data ?? []).map((venue) => {
        const groupVisit = groupVisits.find((visit) => visit.venue_id === venue.id)
        const venueRatings = ratings.filter((rating) => rating.venue_id === venue.id)
        const venueVotes = votes.filter((vote) => vote.venue_id === venue.id)
        const groupRating = venueRatings.length > 0 ? venueRatings.reduce((sum, rating) => sum + Number(rating.rating), 0) / venueRatings.length : null
        const venueTagCategories = venue.categories?.length ? venue.categories : [venue.category]
        return { id: venue.id, name: venue.name, address: cleanAddress(venue.address), notes: venue.notes, category: venue.category, categories: venueTagCategories, keywords: venue.keywords ?? [], latitude: venue.latitude, longitude: venue.longitude, suggestedBy: names.get(venue.suggested_by) ?? 'a member', suggestedById: venue.suggested_by, groupTried: Boolean(groupVisit), groupMarkedBy: groupVisit ? names.get(groupVisit.marked_by) ?? 'a member' : null, groupMarkedById: groupVisit?.marked_by ?? null, groupRating, groupRatingCount: venueRatings.length, userRating: venueRatings.find((rating) => rating.user_id === user.id)?.rating ?? null, upvotes: venueVotes.filter((vote) => vote.vote === 1).length, downvotes: venueVotes.filter((vote) => vote.vote === -1).length, userVote: venueVotes.find((vote) => vote.user_id === user.id)?.vote ?? null, comments: comments.filter((comment) => comment.venue_id === venue.id).map((comment) => ({ id: comment.id, content: comment.content, author: names.get(comment.user_id) ?? 'a member' })) }
      })
      setVenues(loadedVenues)
      try { localStorage.setItem(cacheKey, JSON.stringify(loadedVenues)) } catch { /* Cache is optional. */ }
    }
    loadMeetups()
    return () => { cancelled = true }
  }, [user])

  useEffect(() => {
    if (!user || venues.length === 0) return
    try { localStorage.setItem(`bookclub-meetups-${user.id}`, JSON.stringify(venues)) } catch { /* Cache is optional. */ }
  }, [user, venues])

  function chooseSuggestion(suggestion: PlaceSuggestion) {
    const selectedName = suggestion.name || suggestion.display_name.split(',')[0]
    setName(selectedName)
    setAddress(cleanAddress(suggestion.display_name, selectedName) ?? suggestion.display_name)
    setCoordinates({ latitude: Number(suggestion.lat), longitude: Number(suggestion.lon) })
    setPlaceSelected(true)
    setSuggestions([])
  }

  function categoryLabel(value: string) { return value.split(',').map((item) => item === 'wine-bar' ? 'Wine bar' : item.charAt(0).toUpperCase() + item.slice(1)).join(' · ') }

  function toggleCategory(value: string) {
    setCategories((current) => current.includes(value) ? (current.length > 1 ? current.filter((item) => item !== value) : current) : [...current, value])
  }

  function addKeyword(value: string) {
    const keyword = value.trim().toLowerCase()
    if (keyword && !keywords.includes(keyword)) setKeywords((current) => [...current, keyword])
    setKeywordInput('')
  }

  function editVenue(venue: Venue) {
    setEditingVenueId(venue.id)
    setName(venue.name)
    setAddress(venue.address ?? '')
    setNotes(venue.notes ?? '')
    setCategory(venue.categories[0] ?? venue.category)
    setCategories(venue.categories.length ? venue.categories : [venue.category])
    setKeywords(venue.keywords)
    setCoordinates(venue.latitude !== null && venue.longitude !== null ? { latitude: venue.latitude, longitude: venue.longitude } : null)
    setPlaceSelected(true)
    setShowAddForm(false)
  }

  function cancelEditing() {
    setEditingVenueId(null)
    setShowAddForm(false)
    setName('')
    setAddress('')
    setNotes('')
    setCategories(['cafe'])
    setKeywords([])
    setKeywordInput('')
    setCoordinates(null)
    setPlaceSelected(false)
  }

  async function suggestVenue() {
    if (!supabase || !user || !name.trim() || categories.length === 0 || saving) return
    setSaving(true); setError('')
    const payload = { name: name.trim(), address: address.trim() || null, notes: notes.trim() || null, category: categories[0] ?? 'other', categories, keywords, latitude: coordinates?.latitude ?? null, longitude: coordinates?.longitude ?? null }
    const result = editingVenueId
      ? await supabase.from('venues').update(payload).eq('id', editingVenueId).eq('suggested_by', user.id).select('id, name, address, notes, category, categories, keywords, latitude, longitude, suggested_by').single()
      : await supabase.from('venues').insert({ ...payload, club_id: null, suggested_by: user.id }).select('id, name, address, notes, category, categories, keywords, latitude, longitude, suggested_by').single()
    const { data, error: insertError } = result
    if (insertError) setError(insertError.message)
    else if (data) {
      const displayName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'you'
      const updatedVenue = { id: data.id, name: data.name, address: cleanAddress(data.address), notes: data.notes, category: data.category, categories: data.categories ?? categories, keywords: data.keywords ?? keywords, latitude: data.latitude, longitude: data.longitude, suggestedBy: displayName, suggestedById: user.id, groupTried: editingVenueId ? venues.find((venue) => venue.id === editingVenueId)?.groupTried ?? false : false, groupMarkedBy: editingVenueId ? venues.find((venue) => venue.id === editingVenueId)?.groupMarkedBy ?? null : null, groupMarkedById: editingVenueId ? venues.find((venue) => venue.id === editingVenueId)?.groupMarkedById ?? null : null, groupRating: editingVenueId ? venues.find((venue) => venue.id === editingVenueId)?.groupRating ?? null : null, groupRatingCount: editingVenueId ? venues.find((venue) => venue.id === editingVenueId)?.groupRatingCount ?? 0 : 0, userRating: editingVenueId ? venues.find((venue) => venue.id === editingVenueId)?.userRating ?? null : null, upvotes: editingVenueId ? venues.find((venue) => venue.id === editingVenueId)?.upvotes ?? 0 : 0, downvotes: editingVenueId ? venues.find((venue) => venue.id === editingVenueId)?.downvotes ?? 0 : 0, userVote: editingVenueId ? venues.find((venue) => venue.id === editingVenueId)?.userVote ?? null : null, comments: editingVenueId ? venues.find((venue) => venue.id === editingVenueId)?.comments ?? [] : [] }
      setVenues((previous) => editingVenueId ? previous.map((venue) => venue.id === editingVenueId ? updatedVenue : venue) : [...previous, updatedVenue])
      setName(''); setAddress(''); setNotes(''); setCategory('cafe'); setCategories(['cafe']); setKeywords([]); setKeywordInput(''); setCoordinates(null); setPlaceSelected(false); setSuggestions([]); setShowAddForm(false); setEditingVenueId(null)
    }
    setSaving(false)
  }

  async function toggleTried(venue: Venue) {
    if (!supabase || !user) return
    if (venue.groupTried && venue.groupMarkedById !== user.id) {
      setError('Only the member who marked the meetup as tried can undo it.'); return
    }
    const result = venue.groupTried ? await supabase.from('venue_group_visits').delete().eq('venue_id', venue.id).eq('marked_by', user.id) : await supabase.from('venue_group_visits').insert({ venue_id: venue.id, marked_by: user.id })
    if (result.error) { setError(result.error.message); return }
    const displayName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'you'
    setVenues((previous) => previous.map((item) => item.id === venue.id ? { ...item, groupTried: !venue.groupTried, groupMarkedBy: venue.groupTried ? null : displayName } : item))
  }

  async function rateVenue(venue: Venue, rating: number) {
    if (!supabase || !user || !venue.groupTried) return
    const { error: ratingError } = await supabase.from('venue_ratings').upsert({ venue_id: venue.id, user_id: user.id, rating, updated_at: new Date().toISOString() }, { onConflict: 'venue_id,user_id' })
    if (ratingError) { setError(ratingError.message); return }
    const oldRating = venue.userRating
    const count = oldRating === null ? venue.groupRatingCount + 1 : venue.groupRatingCount
    const total = (venue.groupRating ?? 0) * venue.groupRatingCount - (oldRating ?? 0) + rating
    setVenues((previous) => previous.map((item) => item.id === venue.id ? { ...item, userRating: rating, groupRatingCount: count, groupRating: total / count } : item))
  }

  async function voteOnVenue(venue: Venue, vote: 1 | -1) {
    if (!supabase || !user) return
    const nextVote = venue.userVote === vote ? null : vote
    const result = nextVote ? await supabase.from('venue_votes').upsert({ venue_id: venue.id, user_id: user.id, vote: nextVote }) : await supabase.from('venue_votes').delete().eq('venue_id', venue.id).eq('user_id', user.id)
    if (result.error) { setError(result.error.message); return }
    setVenues((previous) => previous.map((item) => {
      if (item.id !== venue.id) return item
      return { ...item, upvotes: item.upvotes - (item.userVote === 1 ? 1 : 0) + (nextVote === 1 ? 1 : 0), downvotes: item.downvotes - (item.userVote === -1 ? 1 : 0) + (nextVote === -1 ? 1 : 0), userVote: nextVote }
    }))
  }

  async function addComment(venue: Venue, content: string) {
    if (!supabase || !user) return
    const { data, error: commentError } = await supabase.from('venue_comments').insert({ venue_id: venue.id, user_id: user.id, content }).select('id, content').single()
    if (commentError || !data) { setError(commentError?.message ?? 'Could not add comment.'); return }
    const author = user.user_metadata?.full_name || user.email?.split('@')[0] || 'you'
    setVenues((previous) => previous.map((item) => item.id === venue.id ? { ...item, comments: [...item.comments, { id: data.id, content: data.content, author }] } : item))
  }

  async function deleteVenue(venue: Venue) {
    if (!supabase || !user || venue.suggestedById !== user.id) return
    const { error: deleteError } = await supabase.from('venues').delete().eq('id', venue.id).eq('suggested_by', user.id)
    if (deleteError) { setError(deleteError.message); return }
    setVenues((previous) => previous.filter((item) => item.id !== venue.id))
  }

  const visibleVenues = venues.filter((venue) => {
    const matchesTrial = trialFilter === 'all' || (trialFilter === 'tried' ? venue.groupTried : !venue.groupTried)
    const matchesTag = tagFilter === 'all' || venue.categories.includes(tagFilter) || venue.keywords.includes(tagFilter)
    return matchesTrial && matchesTag
  })

  return <section className={styles.page}>
    <p className="eyebrow">MEET, READ, REPEAT</p><h1>Our meeting <em>spots.</em></h1><p className={styles.description}>Recommend a place for the next chapter of the book club, then keep track of where you have actually been.</p>
    <div className={styles.venueSection} data-trial-filter={trialFilter} data-visible-count={visibleVenues.length}>
      <div className={styles.sectionHeading}><div><p className="eyebrow">VENUE SUGGESTIONS</p><h2>Where should we meet?</h2></div><div className={styles.headingActions}><button type="button" className="primary-button" onClick={() => setShowAddForm((open) => !open)}>{showAddForm ? 'Close' : '+ Add place'}</button><div className={styles.viewToggle}><button type="button" className={view === 'cards' ? styles.activeView : ''} onClick={() => setView('cards')}>Cards</button><button type="button" className={view === 'map' ? styles.activeView : ''} onClick={() => setView('map')}>Map view</button></div></div></div>
      {showAddForm && <div className={styles.addPanel}><div className={styles.addPanelIntro}><strong>Add a meeting spot</strong><span>Search a place and choose the exact result so its pin lands correctly.</span></div><div className={styles.venueForm}><div className={styles.addressSearch}><label htmlFor="venue-search">Place name</label><input id="venue-search" value={name} onChange={(e) => { setName(e.target.value); setPlaceSelected(false); setCoordinates(null); setAddress('') }} placeholder="Search a cafe, library, or restaurant..." autoComplete="off" />{(searching || suggestions.length > 0) && <div className={styles.suggestions}>{searching && <p>Searching Manhattan...</p>}{suggestions.map((suggestion) => <button type="button" key={suggestion.place_id} onClick={() => chooseSuggestion(suggestion)}><strong>{suggestion.name || suggestion.display_name.split(',')[0]}</strong><small>{cleanAddress(suggestion.display_name, suggestion.name || suggestion.display_name.split(',')[0])}</small></button>)}</div>}</div>{address && <p className={styles.selectedAddress}><span>Address selected</span><strong>{address}</strong></p>}<label className={styles.categoryField}>Category<select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Place category"><option value="cafe">Cafe</option><option value="library">Library</option><option value="bookstore">Bookstore</option><option value="wine-bar">Wine bar</option><option value="other">Other</option></select></label><label className={styles.notesField}>Note<input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Why recommend it? (optional)" /></label><button className="primary-button" onClick={suggestVenue} disabled={saving || !address}>{saving ? 'Adding...' : 'Save place'}</button></div></div>}
      {showAddForm && !editingVenueId && <div className={styles.tagEditor}><div><span className={styles.fieldLabel}>Categories</span><div className={styles.tagChoices}>{venueCategories.map((value) => <button type="button" key={value} className={categories.includes(value) ? styles.selectedTag : ''} onClick={() => toggleCategory(value)}>{categoryLabel(value)}</button>)}</div></div><div><span className={styles.fieldLabel}>Keywords</span><div className={styles.tagChoices}>{venueKeywords.map((value) => <button type="button" key={value} className={keywords.includes(value) ? styles.selectedTag : ''} onClick={() => addKeyword(value)}>{value}</button>)}</div><div className={styles.keywordInput}><input value={keywordInput} onChange={(event) => setKeywordInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addKeyword(keywordInput) } }} placeholder="Add another keyword" /><button type="button" onClick={() => addKeyword(keywordInput)}>Add</button></div><div className={styles.activeTags}>{keywords.map((value) => <button type="button" key={value} onClick={() => setKeywords((current) => current.filter((item) => item !== value))}>{value} ×</button>)}</div></div></div>}
      <div className={styles.filterRow}><span>Show</span><button type="button" className={trialFilter === 'all' ? styles.activeFilter : ''} onClick={() => setTrialFilter('all')}>All spots</button><button type="button" className={trialFilter === 'tried' ? styles.activeFilter : ''} onClick={() => setTrialFilter('tried')}>Tried by us</button><button type="button" className={trialFilter === 'untried' ? styles.activeFilter : ''} onClick={() => setTrialFilter('untried')}>Not tried yet</button></div>
      <div className={styles.filterRow}><span>Tags</span><label className={styles.filterSelect}><span className="sr-only">Filter venues by tag</span><select value={tagFilter} onChange={(event) => setTagFilter(event.target.value)}><option value="all">All tags</option><optgroup label="Categories">{venueCategories.map((value) => <option value={value} key={value}>{categoryLabel(value)}</option>)}</optgroup><optgroup label="Book club vibes">{venueKeywords.map((value) => <option value={value} key={value}>{value}</option>)}</optgroup></select></label>{tagFilter !== 'all' && <button type="button" className={styles.clearFilter} onClick={() => setTagFilter('all')}>Clear</button>}</div>
      {error && <p className={styles.error}>{error}</p>}
      {loading ? <div className={styles.empty}>Loading saved spots...</div> : venues.length === 0 ? <div className={styles.empty}>No spots yet. Add the first one above.</div> : view === 'cards' ? <div className={styles.venues}>{visibleVenues.map((venue) => <article className={`${styles.venueCard} ${venue.groupTried ? styles.groupTriedCard : ''}`} key={venue.id}><div className={styles.cardTop}><div><span className={`${styles.category} ${styles[venue.category] || styles.other}`}>{venue.categories.map((value) => categoryLabel(value)).join(' · ')}</span><h2 className={styles.venueTitle} onClick={() => window.open(googleMapsUrl(venue.name, venue.address), '_blank', 'noopener,noreferrer')} title="Open in Google Maps">{venue.name}</h2><p className={styles.address}>{venue.address || 'Address to come'}</p>{venue.keywords.length > 0 && <div className={styles.cardTags}>{venue.keywords.map((keyword) => <span key={keyword}>{keyword}</span>)}</div>}</div><div className={styles.cardActions}>{venue.suggestedById === user?.id && <button type="button" className={styles.deleteButton} onClick={() => deleteVenue(venue)}>Delete</button>} {venue.suggestedById === user?.id && <button type="button" className={styles.editButton} onClick={() => editVenue(venue)}>Edit place</button>}<button type="button" className={`${styles.triedButton} ${venue.groupTried ? styles.tried : ''}`} onClick={() => toggleTried(venue)}>{venue.groupTried ? '✓ Tried by book club' : 'Mark club tried'}</button></div></div>{venue.notes && <p className={styles.notes}>{venue.notes}</p>}{venue.groupTried ? <div className={styles.groupRating}><div><strong>Club rating</strong><span className={styles.ratingStars}>{[1, 2, 3, 4, 5].map((star) => <button type="button" key={star} className={venue.groupRating !== null && star <= Math.round(venue.groupRating) ? styles.filledStar : ''} onClick={() => rateVenue(venue, star)} aria-label={`Rate ${star} out of 5`}>★</button>)}</span><small>{venue.groupRating ? `${venue.groupRating.toFixed(1)} / 5 · ${venue.groupRatingCount} rating${venue.groupRatingCount === 1 ? '' : 's'}` : 'Be the first to rate it'}</small></div><span className={styles.triedLabel}>Met here{venue.groupMarkedBy ? ` · marked by ${venue.groupMarkedBy}` : ''}</span></div> : <p className={styles.untriedLabel}>Not yet tried by the book club · ratings unlock after a meetup</p>}<div className={styles.socialRow}><div className={styles.voteGroup}><button type="button" className={venue.userVote === 1 ? styles.activeVote : ''} onClick={() => voteOnVenue(venue, 1)}>↑ {venue.upvotes}</button><button type="button" className={venue.userVote === -1 ? styles.activeDownvote : ''} onClick={() => voteOnVenue(venue, -1)}>↓ {venue.downvotes}</button></div><button type="button" className={styles.mapLink} onClick={() => window.open(googleMapsUrl(venue.name, venue.address), '_blank', 'noopener,noreferrer')}>Open in Google Maps</button></div><div className={styles.cardFooter}><span>Suggested by {venue.suggestedBy}</span></div>{editingVenueId === venue.id && <InlineTagEditor categories={categories} keywords={keywords} keywordInput={keywordInput} onToggleCategory={toggleCategory} onAddKeyword={addKeyword} onKeywordInput={setKeywordInput} onRemoveKeyword={(value) => setKeywords((current) => current.filter((item) => item !== value))} onCancel={cancelEditing} onSave={suggestVenue} />}<div className={styles.comments}>{venue.comments.map((comment) => <p key={comment.id}><strong>{comment.author}</strong> {comment.content}</p>)}<CommentForm onSubmit={(content) => addComment(venue, content)} /></div></article>)}</div> : <div className={styles.mapView}><VenueMap venues={visibleVenues} selectedVenueId={selectedVenueId} onSelect={setSelectedVenueId} /><div className={styles.mapList}>{visibleVenues.map((venue, index) => <button type="button" className={`${styles.mapListItem} ${selectedVenueId === venue.id ? styles.selectedMapItem : ''}`} onClick={() => { setSelectedVenueId(venue.id); window.open(googleMapsUrl(venue.name, venue.address), '_blank', 'noopener,noreferrer') }} key={venue.id}><span>{index + 1}</span><strong>{venue.name}</strong><small>{venue.address || 'Address to come'}</small></button>)}</div>{selectedVenueId && venues.find((venue) => venue.id === selectedVenueId) && <div className={styles.mapDetails}><strong>{venues.find((venue) => venue.id === selectedVenueId)?.name}</strong><span>{venues.find((venue) => venue.id === selectedVenueId)?.address}</span></div>}</div>}
    </div>
  </section>
}

function InlineTagEditor({ categories, keywords, keywordInput, onToggleCategory, onAddKeyword, onKeywordInput, onRemoveKeyword, onCancel, onSave }: { categories: string[]; keywords: string[]; keywordInput: string; onToggleCategory: (value: string) => void; onAddKeyword: (value: string) => void; onKeywordInput: (value: string) => void; onRemoveKeyword: (value: string) => void; onCancel: () => void; onSave: () => void }) {
  return <div className={styles.inlineTagEditor}><div><span className={styles.fieldLabel}>Categories</span><div className={styles.tagChoices}>{venueCategories.map((value) => <button type="button" key={value} className={categories.includes(value) ? styles.selectedTag : ''} onClick={() => onToggleCategory(value)}>{value === 'wine-bar' ? 'Wine bar' : value.charAt(0).toUpperCase() + value.slice(1)}</button>)}</div></div><div><span className={styles.fieldLabel}>Keywords</span><div className={styles.tagChoices}>{venueKeywords.map((value) => <button type="button" key={value} className={keywords.includes(value) ? styles.selectedTag : ''} onClick={() => onAddKeyword(value)}>{value}</button>)}</div><div className={styles.keywordInput}><input value={keywordInput} onChange={(event) => onKeywordInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); onAddKeyword(keywordInput) } }} placeholder="Add another keyword" /><button type="button" onClick={() => onAddKeyword(keywordInput)}>Add</button></div><div className={styles.activeTags}>{keywords.map((value) => <button type="button" key={value} onClick={() => onRemoveKeyword(value)}>{value} ×</button>)}</div></div><div className={styles.inlineEditActions}><button type="button" className={styles.saveEdit} onClick={onSave}>Save changes</button><button type="button" className={styles.cancelEdit} onClick={onCancel}>Cancel edit</button></div></div>
}

function CommentForm({ onSubmit }: { onSubmit: (content: string) => void | Promise<void> }) {
  const [value, setValue] = useState('')
  async function submit(event: React.FormEvent) { event.preventDefault(); const content = value.trim(); if (!content) return; await onSubmit(content); setValue('') }
  return <form className={styles.commentForm} onSubmit={submit}><input value={value} onChange={(event) => setValue(event.target.value)} maxLength={500} placeholder="Add a comment..." aria-label="Add a venue comment" /><button type="submit" disabled={!value.trim()}>Post</button></form>
}

export default Inspo
