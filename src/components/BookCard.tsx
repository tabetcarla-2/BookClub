
import styles from './BookCard.module.css'

interface BookCardProps {
  title: string
  author: string
  cover?: string
  description?: string
  onRemove?: () => void
}

function BookCard({
  title,
  author,
  cover,
  description,
  onRemove,
}: BookCardProps) {
  return (
    <article className={styles.card}>
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

        {description && <small>{description}</small>}

        {onRemove && (
          <button onClick={onRemove} className={styles.remove}>
            Remove
          </button>
        )}
      </div>
    </article>
  )
}

export default BookCard
