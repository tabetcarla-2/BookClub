import { useEffect, useState } from 'react'
import BookCard, { type BookComment, type BookInteraction } from '../components/BookCard'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useBooks } from '../hooks/useBooks'
import type { Book } from '../types'
import styles from './Backlog.module.css'

type OpenLibraryDoc = {
  key: string
  title: string
  author_name?: string[]
  cover_i?: number
  subject?: string[]
  first_publish_year?: number
  first_sentence?: string[] | string
  isbn?: string[]
}

type OpenLibraryWork = { description?: string | { value?: string } }
type GoogleVolume = {
  volumeInfo?: {
    title?: string
    authors?: string[]
    description?: string
  }
}

type BacklogBook = Book & { addedBy?: string }
type VoteRow = { book_id: string; user_id: string; vote: 1 | -1 }
type ReadRow = { book_id: string; user_id: string }
type CommentRow = { id: string; book_id: string; user_id: string; content: string; created_at: string }

function coverUrl(coverId?: number) {
  return coverId ? `https://covers.openlibrary.org/b/id/${coverId}-M.jpg` : null
}

function cleanApiText(value?: string | null) {
  const cleaned = value?.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  if (!cleaned || /^form:/i.test(cleaned) || /^nyt:/i.test(cleaned)) return null
  return cleaned
}

function isMetadataText(value?: string | null) {
  return Boolean(value && (/^form:/i.test(value) || /^nyt:/i.test(value) || /new york times bestseller/i.test(value)))
}

function toBook(doc: OpenLibraryDoc): Omit<Book, 'id'> {
  const subjects = (doc.subject ?? []).filter((subject) => !isMetadataText(subject)).slice(0, 3)
  const sentence = Array.isArray(doc.first_sentence) ? doc.first_sentence[0] : doc.first_sentence
  const usableSentence = sentence && !isMetadataText(sentence) ? cleanApiText(sentence) : null
  return {
    title: doc.title,
    author: doc.author_name?.[0] ?? 'Unknown author',
    cover_url: coverUrl(doc.cover_i),
    genre: subjects[0] ?? 'Literary fiction',
    description: usableSentence ?? null,
    isbn: doc.isbn?.[0] ?? null,
  }
}

async function fetchGoogleDescription(book: Pick<Book, 'title' | 'author' | 'isbn'>) {
  const queries = [
    book.isbn ? `isbn:${book.isbn}` : null,
    `${book.title} ${book.author}`,
    `intitle:${book.title} inauthor:${book.author}`,
  ].filter((query): query is string => Boolean(query))

  for (const query of queries) {
    try {
      const params = new URLSearchParams({ q: query, maxResults: '10', projection: 'lite' })
      const response = await fetch(`https://www.googleapis.com/books/v1/volumes?${params}`)
      if (!response.ok) continue
      const result = await response.json() as { items?: GoogleVolume[] }
      const description = result.items
        ?.map((item) => item.volumeInfo?.description)
        .map(cleanApiText)
        .find((value): value is string => Boolean(value && !isMetadataText(value)))
      if (description) return description
    } catch {
      // Try the next query/source. Book descriptions are optional in both APIs.
    }
  }

  return null
}

async function withApiDescription(doc: OpenLibraryDoc): Promise<Omit<Book, 'id'>> {
  const book = toBook(doc)
  if (doc.key) {
    try {
      const response = await fetch(`https://openlibrary.org${doc.key}.json`)
      if (response.ok) {
        const work = await response.json() as OpenLibraryWork
        const description = typeof work.description === 'string' ? work.description : work.description?.value
        const cleaned = cleanApiText(description)
        if (cleaned && !isMetadataText(cleaned)) return { ...book, description: cleaned }
      }
    } catch {
      // Google Books below is the fallback when Open Library has no synopsis.
    }
  }

  const googleDescription = await fetchGoogleDescription(book)
  return { ...book, description: googleDescription ?? book.description }
}

async function refreshSavedDescription(book: Book): Promise<Book> {
  try {
    const params = new URLSearchParams({ q: `${book.title} ${book.author}`, limit: '1', fields: 'key,title,author_name,cover_i,subject,first_publish_year,first_sentence,isbn' })
    const response = await fetch(`https://openlibrary.org/search.json?${params}`)
    if (response.ok) {
      const result = await response.json() as { docs?: OpenLibraryDoc[] }
      const match = result.docs?.[0]
      if (match) {
        const apiBook = await withApiDescription(match)
        return { ...book, description: apiBook.description ?? book.description, genre: apiBook.genre ?? book.genre, cover_url: book.cover_url ?? apiBook.cover_url }
      }
    }

    const googleDescription = await fetchGoogleDescription(book)
    return { ...book, description: googleDescription ?? book.description }
  } catch {
    const googleDescription = await fetchGoogleDescription(book)
    return { ...book, description: googleDescription ?? book.description }
  }
}

function Backlog() {
  const { user } = useAuth()
  const { books: catalog, addBook } = useBooks()
  const [bookTitle, setBookTitle] = useState('')
  const [books, setBooks] = useState<BacklogBook[]>([])
  const [suggestions, setSuggestions] = useState<OpenLibraryDoc[]>([])
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [selectedGenre, setSelectedGenre] = useState('all')
  const [selectedOrder, setSelectedOrder] = useState('default')
  const [interactions, setInteractions] = useState<Record<string, BookInteraction>>({})
  const [backlogLoading, setBacklogLoading] = useState(true)

  const genreOptions = Array.from(
    new Set(books.map((book) => book.genre?.trim()).filter((genre): genre is string => Boolean(genre))),
  ).sort((a, b) => a.localeCompare(b))
  const filteredBooks = selectedGenre === 'all'
    ? books
    : books.filter((book) => book.genre?.trim() === selectedGenre)
  const orderedBooks = [...filteredBooks].sort((a, b) => {
    const first = interactions[a.id]
    const second = interactions[b.id]
    if (selectedOrder === 'upvotes') return (second?.upvotes ?? 0) - (first?.upvotes ?? 0) || a.title.localeCompare(b.title)
    if (selectedOrder === 'downvotes') return (second?.downvotes ?? 0) - (first?.downvotes ?? 0) || a.title.localeCompare(b.title)
    if (selectedOrder === 'unread') return (first?.readers.length ?? 0) - (second?.readers.length ?? 0) || a.title.localeCompare(b.title)
    return 0
  })

  useEffect(() => {
    let cancelled = false

    async function loadBacklog() {
      if (!supabase || !user) { setBacklogLoading(false); return }
      const [{ data, error: fetchError }, { data: profiles }] = await Promise.all([
        supabase.from('backlog_items').select('book_id, user_id').or(`user_id.eq.${user.id},visibility.eq.club`),
        supabase.from('profiles').select('id, full_name, username'),
      ])
      if (fetchError) { setError(fetchError.message); setBacklogLoading(false); return }
      const ids = new Set((data ?? []).map((item) => item.book_id))
      const names = new Map((profiles ?? []).map((profile) => [profile.id, profile.full_name || `@${profile.username}`]))
      const contributors = new Map<string, string[]>()
      for (const item of data ?? []) {
        const current = contributors.get(item.book_id) ?? []
        const name = names.get(item.user_id) ?? 'a member'
        if (!current.includes(name)) current.push(name)
        contributors.set(item.book_id, current)
      }
      const { data: savedBooks, error: booksError } = ids.size > 0
        ? await supabase.from('books').select('*').in('id', Array.from(ids))
        : { data: [], error: null }
      if (booksError) { setError(booksError.message); setBacklogLoading(false); return }
      const baseBooks = savedBooks.map((book) => ({ ...book, addedBy: contributors.get(book.id)?.join(', ') }))
      if (cancelled) return
      setBooks(baseBooks)
      setBacklogLoading(false)

      // Show the saved club list immediately. Description and cover lookups can
      // take a moment, so enrich the cards in the background instead of making
      // the whole backlog wait for external book APIs.
      const enrichedBooksPromise = Promise.all(savedBooks.map(refreshSavedDescription))
      const bookIds = savedBooks.map((book) => book.id)
      const interactionPromise = bookIds.length > 0
        ? Promise.all([
          supabase.from('book_votes').select('book_id, user_id, vote').in('book_id', bookIds),
          supabase.from('book_reads').select('book_id, user_id').in('book_id', bookIds),
          supabase.from('book_comments').select('id, book_id, user_id, content, created_at').in('book_id', bookIds).order('created_at', { ascending: true }),
        ])
        : [{ data: [] as VoteRow[] }, { data: [] as ReadRow[] }, { data: [] as CommentRow[] }]
      const [enrichedBooks, [voteResult, readResult, commentResult]] = await Promise.all([enrichedBooksPromise, interactionPromise])
      const votes = (voteResult.data ?? []) as VoteRow[]
      const reads = (readResult.data ?? []) as ReadRow[]
      const comments = (commentResult.data ?? []) as CommentRow[]
      const interactionMap: Record<string, BookInteraction> = {}
      for (const book of savedBooks) {
        const bookVotes = votes.filter((vote) => vote.book_id === book.id)
        const bookReads = reads.filter((read) => read.book_id === book.id)
        const bookComments = comments.filter((comment) => comment.book_id === book.id)
        interactionMap[book.id] = {
          upvotes: bookVotes.filter((vote) => vote.vote === 1).length,
          downvotes: bookVotes.filter((vote) => vote.vote === -1).length,
          userVote: bookVotes.find((vote) => vote.user_id === user.id)?.vote ?? null,
          readByMe: bookReads.some((read) => read.user_id === user.id),
          readers: bookReads.map((read) => names.get(read.user_id) ?? 'a member'),
          comments: bookComments.map((comment): BookComment => ({ id: comment.id, content: comment.content, author: names.get(comment.user_id) ?? 'a member', createdAt: comment.created_at, isMine: comment.user_id === user.id })),
        }
      }
      if (cancelled) return
      setBooks(enrichedBooks.map((book) => ({ ...book, addedBy: contributors.get(book.id)?.join(', ') })))
      setInteractions(interactionMap)
    }
    loadBacklog()

    return () => { cancelled = true }
  }, [user])

  useEffect(() => {
    const query = bookTitle.trim()
    if (query.length < 2) { setSuggestions([]); return }
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setSearching(true)
      try {
        const params = new URLSearchParams({ q: query, limit: '6', fields: 'key,title,author_name,cover_i,subject,first_publish_year,first_sentence,isbn' })
        const response = await fetch(`https://openlibrary.org/search.json?${params}`, { signal: controller.signal })
        if (!response.ok) throw new Error('Book search is unavailable right now.')
        const result = await response.json() as { docs?: OpenLibraryDoc[] }
        setSuggestions(result.docs ?? [])
      } catch (searchError) {
        if (searchError instanceof DOMException && searchError.name === 'AbortError') return
        setError(searchError instanceof Error ? searchError.message : 'Book search is unavailable right now.')
      } finally { setSearching(false) }
    }, 350)
    return () => { controller.abort(); window.clearTimeout(timer) }
  }, [bookTitle])

  async function addBookToBacklog(suggestion?: OpenLibraryDoc) {
    const metadata = suggestion ? await withApiDescription(suggestion) : { title: bookTitle.trim(), author: 'Author to be added' }
    if (!metadata.title || saving) return
    setSaving(true)
    setError('')

    if (!supabase || !user) {
      setBooks((previous) => [...previous, { id: `demo-${Date.now()}`, ...metadata }])
      setBookTitle(''); setSuggestions([]); setSaving(false); return
    }

    // Older accounts may not have a profile row yet, but backlog_items has a
    // foreign key to profiles.id. Create it before adding the recommendation.
    const { data: profile } = await supabase.from('profiles').select('id').eq('id', user.id).maybeSingle()
    if (!profile) {
      const username = user.user_metadata?.username || `reader_${user.id.replaceAll('-', '').slice(0, 10)}`
      const { error: profileError } = await supabase.from('profiles').insert({
        id: user.id,
        username,
        full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Reader',
      })
      if (profileError && profileError.code !== '23505') {
        setError(profileError.message)
        setSaving(false)
        return
      }
    }

    const existing = catalog.find((book) => book.title.toLowerCase() === metadata.title.toLowerCase())
    const bookResult = existing ? { data: existing, error: null } : await addBook(metadata.title, metadata.author, metadata)
    if (bookResult.error || !bookResult.data) { setError(bookResult.error ?? 'Could not add that book.'); setSaving(false); return }
    const addedBook = bookResult.data

    const { error: insertError } = await supabase.from('backlog_items').insert({ user_id: user.id, book_id: addedBook.id, visibility: 'club' })
    if (insertError && insertError.code !== '23505') setError(insertError.message)
    else {
      const displayName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'you'
      setBooks((previous) => [...previous.filter((book) => book.id !== addedBook.id), { ...addedBook, addedBy: displayName }])
    }
    setBookTitle(''); setSuggestions([]); setSaving(false)
  }

  async function removeBook(book: BacklogBook) {
    if (supabase && user && !book.id.startsWith('demo-')) await supabase.from('backlog_items').delete().eq('book_id', book.id).eq('user_id', user.id)
    setBooks((previous) => previous.filter((item) => item.id !== book.id))
    setInteractions((previous) => {
      const next = { ...previous }
      delete next[book.id]
      return next
    })
  }

  function memberName() {
    return user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'you'
  }

  async function voteOnBook(bookId: string, vote: 1 | -1) {
    if (!supabase || !user) return
    const current = interactions[bookId]
    const nextVote = current?.userVote === vote ? null : vote
    const result = nextVote
      ? await supabase.from('book_votes').upsert({ book_id: bookId, user_id: user.id, vote: nextVote })
      : await supabase.from('book_votes').delete().eq('book_id', bookId).eq('user_id', user.id)
    if (result.error) { setError(result.error.message); return }
    setInteractions((previous) => {
      const existing = previous[bookId]
      if (!existing) return previous
      let upvotes = existing.upvotes
      let downvotes = existing.downvotes
      if (existing.userVote === 1) upvotes -= 1
      if (existing.userVote === -1) downvotes -= 1
      if (nextVote === 1) upvotes += 1
      if (nextVote === -1) downvotes += 1
      return { ...previous, [bookId]: { ...existing, upvotes, downvotes, userVote: nextVote } }
    })
  }

  async function toggleRead(bookId: string) {
    if (!supabase || !user) return
    const current = interactions[bookId]
    const readByMe = current?.readByMe ?? false
    const result = readByMe
      ? await supabase.from('book_reads').delete().eq('book_id', bookId).eq('user_id', user.id)
      : await supabase.from('book_reads').insert({ book_id: bookId, user_id: user.id })
    if (result.error) { setError(result.error.message); return }
    setInteractions((previous) => {
      const existing = previous[bookId]
      if (!existing) return previous
      const readers = readByMe ? existing.readers.filter((reader) => reader !== memberName()) : [...existing.readers, memberName()]
      return { ...previous, [bookId]: { ...existing, readByMe: !readByMe, readers } }
    })
  }

  async function addComment(bookId: string, content: string) {
    if (!supabase || !user) return
    const { data, error: commentError } = await supabase.from('book_comments').insert({ book_id: bookId, user_id: user.id, content }).select('id, content, created_at').single()
    if (commentError || !data) { setError(commentError?.message ?? 'Could not add comment.'); return }
    const comment: BookComment = { id: data.id, content: data.content, author: memberName(), createdAt: data.created_at }
    setInteractions((previous) => {
      const existing = previous[bookId]
      if (!existing) return previous
      return { ...previous, [bookId]: { ...existing, comments: [...existing.comments, comment] } }
    })
  }

  async function deleteComment(bookId: string, commentId: string) {
    if (!supabase || !user) return
    const { error: deleteError } = await supabase.from('book_comments').delete().eq('id', commentId).eq('user_id', user.id)
    if (deleteError) { setError(deleteError.message); return }
    setInteractions((previous) => {
      const existing = previous[bookId]
      if (!existing) return previous
      return { ...previous, [bookId]: { ...existing, comments: existing.comments.filter((comment) => comment.id !== commentId) } }
    })
  }

  return (
    <section className={styles.page}>
      <p className="eyebrow">THE NEVER-ENDING LIST</p>
      <h1>Books to <em>discover.</em></h1>
      <p className={styles.description}>Search the library, find the one, and add it to the club backlog.</p>
      <div className={styles.searchArea}>
        <div className={styles.form}><input type="search" placeholder="Search by title, author, or ISBN..." value={bookTitle} onChange={(e) => setBookTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addBookToBacklog()} /><button className="primary-button" onClick={() => addBookToBacklog()} disabled={saving}>{saving ? 'Adding...' : '+ Add book'}</button></div>
        {(searching || suggestions.length > 0) && <div className={styles.suggestions} aria-live="polite">{searching && <p className={styles.searchMessage}>Searching Open Library...</p>}{suggestions.map((suggestion) => { const metadata = toBook(suggestion); return <button type="button" className={styles.suggestion} key={suggestion.key} onClick={() => addBookToBacklog(suggestion)}><span className={styles.suggestionCover}>{metadata.cover_url ? <img src={metadata.cover_url} alt="" /> : '—'}</span><span><strong>{metadata.title}</strong><small>{metadata.author} · {metadata.genre}</small></span><span className={styles.addIcon}>+</span></button> })}</div>}
      </div>
      {error && <p className={styles.error}>{error}</p>}
      {backlogLoading ? (
        <div className={styles.loading} role="status" aria-live="polite">
          <span className={styles.loadingDot} />
          <p>Loading the club list...</p>
        </div>
      ) : <>
      <div className={styles.listHeader}>
        <p className="eyebrow">{filteredBooks.length} OF {books.length} BOOKS ON YOUR LIST</p>
        <div className={styles.filters}>
          {genreOptions.length > 0 && (
            <label className={styles.filter}>
              <span>Genre</span>
              <select value={selectedGenre} onChange={(event) => setSelectedGenre(event.target.value)}>
                <option value="all">All genres</option>
                {genreOptions.map((genre) => <option key={genre} value={genre}>{genre}</option>)}
              </select>
            </label>
          )}
          <label className={styles.filter}>
            <span>Order</span>
            <select value={selectedOrder} onChange={(event) => setSelectedOrder(event.target.value)}>
              <option value="default">Recently added</option>
              <option value="upvotes">Most upvoted</option>
              <option value="downvotes">Most downvoted</option>
              <option value="unread">Most unread</option>
            </select>
          </label>
        </div>
      </div>
      {books.length === 0 ? (
        <p className={styles.empty}>Your reading list is empty. Search above to find your next read.</p>
      ) : filteredBooks.length > 0 ? (
        <div className={styles.grid}>{orderedBooks.map((book) => <BookCard key={book.id} title={book.title} author={book.author} genre={book.genre} cover={book.cover_url} description={book.description} addedBy={book.addedBy} onRemove={() => removeBook(book)} interaction={user ? interactions[book.id] : undefined} onVote={(vote) => voteOnBook(book.id, vote)} onToggleRead={() => toggleRead(book.id)} onAddComment={(content) => addComment(book.id, content)} onDeleteComment={(commentId) => deleteComment(book.id, commentId)} />)}</div>
      ) : (
        <p className={styles.empty}>No books in this genre yet. Try another filter.</p>
      )}
      </>}
    </section>
  )
}

export default Backlog
