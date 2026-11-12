
import styles from './Inspo.module.css'

const inspiration = [
  {
    category: 'A LITTLE REMINDER',
    title: 'Read slowly.',
    description: 'You do not have to finish every book quickly.',
    className: 'pink',
  },
  {
    category: 'BOOKISH RITUAL',
    title: 'A slow Sunday.',
    description: 'A warm drink, a rainy afternoon and a few chapters.',
    className: 'green',
  },
  {
    category: 'A FAVOURITE QUOTE',
    title: 'Paradise is a library.',
    description: '— Jorge Luis Borges',
    className: 'yellow',
  },
  {
    category: 'READING MOOD',
    title: 'Somewhere between reality and fiction.',
    description: 'Make room for imagination.',
    className: 'lilac',
  },
]

function Inspo() {
  return (
    <section className={styles.page}>
      <p className="eyebrow">A COLLECTION OF LITTLE THINGS</p>
      <h1>The inspiration <em>shelf.</em></h1>

      <p className={styles.description}>
        Quotes, reading rituals, beautiful words and all
        the things that make us fall in love with books.
      </p>

      <div className={styles.grid}>
        {inspiration.map((item) => (
          <article
            key={item.title}
            className={`${styles.card} ${styles[item.className]}`}
          >
            <span>{item.category}</span>
            <h2>{item.title}</h2>
            <p>{item.description}</p>
          </article>
        ))}
      </div>
    </section>
  )
}

export default Inspo
