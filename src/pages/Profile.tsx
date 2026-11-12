
import styles from './Profile.module.css'

function Profile() {
  return (
    <section className={styles.page}>
      <p className="eyebrow">YOUR PERSONAL READING JOURNAL</p>
      <h1>My reading <em>diary.</em></h1>

      <div className={styles.profile}>
        <div className={styles.avatar}>♡</div>

        <div>
          <h2>Book Lover</h2>
          <p className={styles.muted}>@yourusername</p>
          <p>A reader, a dreamer and a collector of stories.</p>
        </div>
      </div>

      <h2>Your reading life</h2>

      <div className={styles.stats}>
        <div>
          <span>01</span>
          <p>Currently reading</p>
        </div>

        <div>
          <span>04</span>
          <p>Books on your TBR</p>
        </div>

        <div>
          <span>12</span>
          <p>Yearly reading goal</p>
        </div>
      </div>

      <div className={styles.favorite}>
        <p className="eyebrow">YOUR READING PERSONALITY</p>
        <h2>Literary fiction, romance & a little mystery.</h2>
        <p className={styles.muted}>
          Your profile is a little space to express your
          reading taste and share your favourite stories.
        </p>
      </div>
    </section>
  )
}

export default Profile
