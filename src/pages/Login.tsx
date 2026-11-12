
import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import styles from './Login.module.css'

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const navigate = useNavigate()
  const location = useLocation()

  const redirectTo = location.state?.from?.pathname || '/'

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    if (!supabase) {
      setError('Login is not configured yet.')
      return
    }

    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
  console.error('Supabase login error:', error.message, error.status)
  setError(error.message)
  setLoading(false)
  return
}

    navigate(redirectTo, { replace: true })
  }

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <span className={styles.symbol}>✳</span>

        <p className="eyebrow">YOUR LITTLE CORNER OF THE INTERNET</p>

        <h1>Welcome <em>back.</em></h1>

        <p className={styles.description}>
          Sign in to return to your reading room.
        </p>

        <form onSubmit={handleLogin}>
          <label htmlFor="email">Email address</label>

          <input
            id="email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <label htmlFor="password">Password</label>

          <input
            id="password"
            type="password"
            placeholder="Your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {error && <p className={styles.error}>{error}</p>}

          <button
            className="primary-button"
            type="submit"
            disabled={loading}
          >
            {loading ? 'Signing in...' : 'Enter the reading room →'}
          </button>
        </form>

        <p className={styles.note}>
          A private space for our little book club ♡
        </p>
      </div>
    </main>
  )
}

export default Login
