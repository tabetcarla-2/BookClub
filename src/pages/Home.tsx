import { Link } from 'react-router-dom'
import coverImage from '../assets/husbands-secret-cover.png'
import styles from './Home.module.css'

function Home() {
  return (
    <>
      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <div>
            <h1>Welcome to THE<br /><em>book club.</em></h1>
            <p className={styles.tagline}>Hot people read.</p>
          </div>

          <Link to="/current-book" className={styles.featuredBook} aria-label="Open November's book">
            <img src={coverImage} alt="A Husband's Secret by Liane Moriarty" />
            <div>
              <p className="eyebrow">NOVEMBER BOOK</p>
              <h2>A Husband's Secret</h2>
              <p>by Liane Moriarty</p>
            </div>
          </Link>
        </div>
      </section>

      <section className={styles.section}>
        <h2>What's happening?</h2>
        <div className={styles.grid}>
          <article className={styles.card}>
            <p className="eyebrow">NEXT MEETUP</p>
            <h3>Where are we meeting?</h3>
            <p>Find the next place to read, talk, and over-order coffee.</p>
            <Link to="/inspo">See meetups →</Link>
          </article>

          <article className={styles.card}>
            <p className="eyebrow">THE SHAWTIES</p>
            <h3>20 stunning readers</h3>
            <p>Comparison is said to be the thief of joy. Here, it is the motivation to read.</p>
            <Link to="/members">Meet the readers →</Link>
          </article>

          <article className={styles.card}>
            <p className="eyebrow">THE NEXT READ?</p>
            <h3>Hate it? Love it? Add it.</h3>
            <p>Add books to our backlog.</p>
            <Link to="/backlog">View your backlog →</Link>
          </article>
        </div>
      </section>
    </>
  )
}

export default Home
