
import { useState } from 'react'
import styles from './BookCard.module.css'

interface BookCardProps {
  title: string
  author: string
  genre?: string | null
  cover?: string | null
  description?: string | null
  addedBy?: string
  onRemove?: () => void
}

function BookCard({
  title,
  author,
  genre,
  cover,
  description,
  addedBy,
  onRemove,
}: BookCardProps) {
  const [expanded, setExpanded] = useState(false)
  const displayDescription = description && !/^form:|^nyt:|new york times bestseller/i.test(description) ? description : null
  const displayGenre = genre && !/^form:|^nyt:|new york times bestseller/i.test(genre) ? genre : null
  const genreText = displayGenre?.toLowerCase() ?? ''
  const genreTone = genreText.includes('romance') ? 'romance' : genreText.includes('fantasy') || genreText.includes('magic') ? 'fantasy' : genreText.includes('mystery') || genreText.includes('thriller') ? 'mystery' : genreText.includes('history') ? 'history' : genreText.includes('science') ? 'science' : 'fiction'

  function toggleExpanded() {
    if (displayDescription) setExpanded((isExpanded) => !isExpanded)
  }

  function handleCardKeyDown(event: React.KeyboardEvent<HTMLElement>) {
    if (event.target !== event.currentTarget) return
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      toggleExpanded()
    }
  }

  return (
    <article
      className={`${styles.card} ${expanded ? styles.expanded : ''}`}
      onClick={(event) => {
        if ((event.target as HTMLElement).closest('button')) return
        toggleExpanded()
      }}
      onKeyDown={handleCardKeyDown}
      aria-expanded={displayDescription ? expanded : undefined}
      aria-label={displayDescription ? `${title}. Click to ${expanded ? 'collapse' : 'expand'} description.` : undefined}
      role={displayDescription ? 'button' : undefined}
      tabIndex={displayDescription ? 0 : undefined}
    >
      {cover ? (
        <img
          className={styles.cover}
          src={cover}
          alt={`Cover of ${title}`}
        />
      ) : (
        <div className={styles.placeholder}>
          <span>{title}</span>
        </div>
      )}

      <div className={styles.info}>
        <h3>{title}</h3>
        <p>{author}</p>

        {displayGenre && <small className={`${styles.genre} ${styles[genreTone]}`}>{displayGenre}</small>}

        {addedBy && <small className={styles.addedBy}>Added by {addedBy}</small>}

        {displayDescription && (
          <small className={styles.description}>
            {displayDescription}
            {!expanded && <span className={styles.readMore}> Read more</span>}
          </small>
        )}

        {onRemove && (
          <button onClick={(event) => { event.stopPropagation(); onRemove() }} className={styles.remove}>
            Remove
          </button>
        )}
      </div>
    </article>
  )
}

export default BookCard
