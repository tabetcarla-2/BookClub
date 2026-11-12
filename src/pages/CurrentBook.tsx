
import { useState } from 'react'
import styles from './CurrentBook.module.css'

function CurrentBook() {
  const [progress, setProgress] = useState(45)

  return (
    <section className={styles.page}>
      <p className="eyebrow">OUR BOOK OF THE MONTH</p>
      <h1>Currently <em>reading.</em></h1>

      <div className={styles.book}>
        <div className={styles.cover}>
          <span>THE<br />GREAT<br />GATSBY</span>
          <small>F. SCOTT FITZGERALD</small>
        </div>

        <div className={styles.info}>
          <p className="eyebrow">NOVEMBER'S BOOK PICK</p>
          <h2>The Great Gatsby</h2>
          <p className={styles.muted}>F. Scott Fitzgerald</p>

          <p>
            A story of love, ambition, wealth and the
            American Dream. Join the club as we explore
            this month's selection.
          </p>

          <div className={styles.progressLabel}>
            <span>My reading progress</span>
            <strong>{progress}%</strong>
          </div>

          <input
            type="range"
            min="0"
            max="100"
            value={progress}
            onChange={(e) => setProgress(Number(e.target.value))}
          />

          <p className={styles.muted}>
            Your progress is currently a local demo.
          </p>
        </div>
      </div>

      <div className={styles.discussion}>
        <p className="eyebrow">LET'S TALK ABOUT IT</p>
        <h2>Book club discussions</h2>
        <p className={styles.muted}>
          This is where we'll eventually share chapter
          discussions, favourite quotes, questions and reviews.
        </p>
      </div>
    </section>
  )
}

export default CurrentBook
