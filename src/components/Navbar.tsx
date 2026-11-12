
import { NavLink } from 'react-router-dom'
import styles from './Navbar.module.css'

const links = [
  { name: 'Home', path: '/' },
  { name: 'My Page', path: '/profile' },
  { name: 'Current Book', path: '/current-book' },
  { name: 'Backlog', path: '/backlog' },
  { name: 'Inspo', path: '/inspo' },
]

function Navbar() {
  return (
    <header className={styles.header}>
      <NavLink to="/" className={styles.brand}>
        <span className={styles.symbol}>✳</span>
        the reading room
      </NavLink>

      <nav className={styles.navigation}>
        {links.map((link) => (
          <NavLink
            key={link.path}
            to={link.path}
            end={link.path === '/'}
            className={({ isActive }) =>
              `${styles.navLink} ${isActive ? styles.active : ''}`
            }
          >
            {link.name}
          </NavLink>
        ))}
      </nav>

      <span className={styles.note}>
        a little corner for book lovers ♡
      </span>
    </header>
  )
}

export default Navbar
