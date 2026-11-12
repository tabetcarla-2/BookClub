
import { NavLink } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import styles from './Navbar.module.css'

const links = [
  { name: 'Home', path: '/' },
  { name: 'Current Book', path: '/current-book' },
  { name: 'Backlog', path: '/backlog' },
  { name: 'Members', path: '/members' },
  { name: 'Meetups', path: '/inspo' },
]

function Navbar() {
  const { user } = useAuth()
  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Reader'
  const initials = displayName.slice(0, 1).toUpperCase()

  async function signOut() {
    await supabase?.auth.signOut()
  }

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

      <div className={styles.account}>
        <NavLink to="/profile" className={styles.profileLink}>
          <span className={styles.avatar}>{initials}</span>
          <span className={styles.accountText}><strong>My profile</strong><small>{displayName}</small></span>
        </NavLink>
        <button type="button" className={styles.signOut} onClick={signOut} aria-label="Sign out">↗</button>
      </div>
    </header>
  )
}

export default Navbar
