
import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import styles from './Login.module.css'

function Login() {
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [fullName, setFullName] = useState('')
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

    const result = mode === 'sign-in'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({
        email,
        password,
        options: { data: { username, full_name: fullName } },
      })

    const { error, data } = result

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    if (mode === 'sign-up' && !data.session) {
      setError('Check your email to confirm your account, then come back to sign in.')
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

        <h1>{mode === 'sign-in' ? <>Welcome <em>back.</em></> : <>Join the <em>club.</em></>}</h1>

        <p className={styles.description}>
          {mode === 'sign-in'
            ? 'Sign in to return to your reading room.'
            : 'Create your account and find your place in the reading room.'}
        </p>

        <form onSubmit={handleLogin}>
          {mode === 'sign-up' && (
            <>
              <label htmlFor="full-name">Name</label>
              <input
                id="full-name"
                type="text"
                placeholder="Your name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />

              <label htmlFor="username">Username</label>
              <input
                id="username"
                type="text"
                placeholder="yourusername"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </>
          )}

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
            {loading
              ? mode === 'sign-in' ? 'Signing in...' : 'Creating account...'
              : mode === 'sign-in' ? 'Enter the reading room →' : 'Create my account →'}
          </button>
        </form>

        <button
          className={styles.modeToggle}
          type="button"
          onClick={() => {
            setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in')
            setError('')
          }}
        >
          {mode === 'sign-in' ? 'New here? Create an account' : 'Already a member? Sign in'}
        </button>

        <p className={styles.note}>
          A private space for our little book club ♡
        </p>
      </div>
    </main>
  )
}

export default Login
