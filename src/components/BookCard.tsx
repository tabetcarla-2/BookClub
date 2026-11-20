
import { useState } from 'react'
import styles from './BookCard.module.css'

interface BookCardProps {
  title: string
  author: string
  genre?: string | null
  cover?: string | null
  description?: string | null
  addedBy?: string
  onOpen?: () => void
  onRemove?: () => void
  interaction?: BookInteraction
  onVote?: (vote: 1 | -1) => void | Promise<void>
  onToggleRead?: () => void | Promise<void>
  onAddComment?: (content: string) => void | Promise<void>
  onDeleteComment?: (commentId: string) => void | Promise<void>
}

export interface BookComment {
  id: string
  content: string
  author: string
  createdAt: string
  isMine?: boolean
}

export interface BookInteraction {
  upvotes: number
  downvotes: number
  userVote: 1 | -1 | null
  readByMe: boolean
  readers: string[]
  comments: BookComment[]
}

function BookCard({
  title,
  author,
  genre,
  cover,
  description,
  addedBy,
  onOpen,
  onRemove,
  interaction,
  onVote,
  onToggleRead,
  onAddComment,
  onDeleteComment,
}: BookCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [commenting, setCommenting] = useState(false)
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
        if ((event.target as HTMLElement).closest('button, input, textarea, select')) return
        if (onOpen) onOpen()
        else toggleExpanded()
      }}
      onKeyDown={handleCardKeyDown}
      aria-expanded={onOpen ? undefined : displayDescription ? expanded : undefined}
      aria-label={onOpen ? `${title}. Open book details.` : displayDescription ? `${title}. Click to ${expanded ? 'collapse' : 'expand'} description.` : undefined}
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

        {displayDescription && !onOpen && (
          <small className={styles.description}>
            {displayDescription}
            {!expanded && <span className={styles.readMore}> Read more</span>}
          </small>
        )}

        {interaction && (
          <div className={styles.social} onClick={(event) => event.stopPropagation()}>
            <div className={styles.socialRow}>
              <div className={styles.voteGroup} aria-label="Book votes">
                <button type="button" className={`${styles.voteButton} ${interaction.userVote === 1 ? styles.activeVote : ''}`} onClick={() => onVote?.(1)} aria-label="Upvote" aria-pressed={interaction.userVote === 1}>↑ <span>{interaction.upvotes}</span></button>
                <button type="button" className={`${styles.voteButton} ${interaction.userVote === -1 ? styles.activeDownvote : ''}`} onClick={() => onVote?.(-1)} aria-label="Downvote" aria-pressed={interaction.userVote === -1}>↓ <span>{interaction.downvotes}</span></button>
              </div>
              <button type="button" className={`${styles.readButton} ${interaction.readByMe ? styles.read : ''}`} onClick={() => onToggleRead?.()} aria-label={interaction.readByMe ? 'Remove personal read flag' : 'Mark as personally read'} aria-pressed={interaction.readByMe}>
                <span className={styles.flag} aria-hidden="true">⚑</span> {interaction.readByMe ? 'I read this' : 'I’ve read it'}
              </button>
            </div>

            {interaction.readers.length > 0 && <small className={styles.readers}>Personally read by {interaction.readers.join(', ')}</small>}

            <div className={styles.comments}>
              {interaction.comments.map((comment) => (
                <p className={styles.comment} key={comment.id}>
                  <span><strong>{comment.author}</strong> {comment.content}</span>
                  {comment.isMine && onDeleteComment && <button type="button" className={styles.deleteComment} onClick={() => onDeleteComment(comment.id)} aria-label="Delete comment">×</button>}
                </p>
              ))}
              {onAddComment && (
                <form className={styles.commentForm} onSubmit={async (event) => {
                  event.preventDefault()
                  const content = commentText.trim()
                  if (!content || commenting) return
                  setCommenting(true)
                  try {
                    await onAddComment(content)
                    setCommentText('')
                  } finally {
                    setCommenting(false)
                  }
                }}>
                  <input value={commentText} onChange={(event) => setCommentText(event.target.value)} maxLength={500} placeholder="Add a comment..." aria-label={`Comment on ${title}`} />
                  <button type="submit" disabled={!commentText.trim() || commenting}>{commenting ? '...' : 'Post'}</button>
                </form>
              )}
            </div>
          </div>
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
