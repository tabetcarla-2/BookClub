
import { useState } from 'react'
import BookCard from '../components/BookCard'
import styles from './Backlog.module.css'

interface Book {
  id: number
  title: string
  author: string
}

function Backlog() {
  const [bookTitle, setBookTitle] = useState('')

  const [books, setBooks] = useState<Book[]>([
    { id: 1, title: 'The Secret History', author: 'Donna Tartt' },
    { id: 2, title: 'Normal People', author: 'Sally Rooney' },
    {
      id: 3,
      title: 'Tomorrow, and Tomorrow, and Tomorrow',
      author: 'Gabrielle Zevin',
    },
    { id: 4, title: 'The Bell Jar', author: 'Sylvia Plath' },
  ])

  function addBook() {
    if (!bookTitle.trim()) return

    setBooks((previous) => [
      ...previous,
      {
        id: Date.now(),
        title: bookTitle.trim(),
        author: 'Author to be added',
      },
    ])

    setBookTitle('')
  }

  function removeBook(id: number) {
    setBooks((previous) => previous.filter((book) => book.id !== id))
  }

  return (
    <section className={styles.page}>
      <p className="eyebrow">THE NEVER-ENDING LIST</p>
      <h1>Books to <em>discover.</em></h1>

      <p className={styles.description}>
        All the stories waiting for their turn on your bookshelf.
      </p>

      <div className={styles.form}>
        <input
          type="text"
          placeholder="Add a book to your TBR..."
          value={bookTitle}
          onChange={(e) => setBookTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addBook()}
        />

        <button className="primary-button" onClick={addBook}>
          + Add book
        </button>
      </div>

      <p className="eyebrow">{books.length} BOOKS ON YOUR LIST</p>

      {books.length > 0 ? (
        <div className={styles.grid}>
          {books.map((book) => (
            <BookCard
              key={book.id}
              title={book.title}
              author={book.author}
              onRemove={() => removeBook(book.id)}
            />
          ))}
        </div>
      ) : (
        <p className={styles.empty}>
          Your reading list is empty. Time to discover something new!
        </p>
      )}
    </section>
  )
}

export default Backlog
