
import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
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
  const location = useLocation()
  const [profile, setProfile] = useState<{ full_name: string | null; username: string | null; avatar_url: string | null } | null>(null)
  useEffect(() => {
    let cancelled = false
    if (!supabase || !user) { setProfile(null); return }
    supabase.from('profiles').select('full_name, username, avatar_url').eq('id', user.id).maybeSingle().then(({ data }) => {
      if (!cancelled) setProfile(data)
    })
    return () => { cancelled = true }
  }, [user])
  const displayName = profile?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Reader'
  const avatarUrl = profile?.avatar_url || user?.user_metadata?.avatar_url || null
  const initials = displayName.slice(0, 1).toUpperCase()

  return (
    <header className={`${styles.header} ${location.pathname === '/' ? styles.homeHeader : ''}`}>
      <NavLink to="/" className={styles.brand}>
        nyc book club
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
          {avatarUrl ? <img className={styles.avatar} src={avatarUrl} alt={`${displayName}'s profile`} /> : <span className={styles.avatar}>{initials}</span>}
          <span className={styles.accountText}><strong>My profile</strong><small>{displayName}</small></span>
        </NavLink>
      </div>
    </header>
  )
}

export default Navbar
