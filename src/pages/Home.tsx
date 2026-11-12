
import { Link } from 'react-router-dom'
import styles from './Home.module.css'

function Home() {
  return (
    <>
      <section className={styles.hero}>
        <p className="eyebrow">WELCOME TO YOUR READING ROOM</p>

        <h1>
          A world between<br />
          the <em>pages.</em>
        </h1>

        <p className={styles.description}>
          A little corner of the internet dedicated to
          good books, great conversations and everything
          in between.
        </p>

        <Link to="/current-book" className="primary-button">
          Explore this month's book →
        </Link>

        <span className={styles.decoration}>❧</span>
      </section>

      <section className={styles.section}>
        <p className="eyebrow">THE BOOK CLUB</p>
        <h2>What's happening in our reading room?</h2>

        <div className={styles.grid}>
          <article className={styles.card}>
            <p className="eyebrow">THIS MONTH'S PICK</p>
            <h3>The Great Gatsby</h3>
            <p>By F. Scott Fitzgerald</p>
            <Link to="/current-book">Read more →</Link>
          </article>

          <article className={styles.card}>
            <p className="eyebrow">THE COMMUNITY</p>
            <h3>20 readers, endless stories.</h3>
            <p>A little place to share our love of books.</p>
            <Link to="/profile">Meet the readers →</Link>
          </article>

          <article className={styles.card}>
            <p className="eyebrow">YOUR NEXT READ</p>
            <h3>Something new awaits.</h3>
            <p>Explore all the books on your reading list.</p>
            <Link to="/backlog">View your backlog →</Link>
          </article>
        </div>
      </section>
    </>
  )
}

export default Home
