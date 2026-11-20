
import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import styles from './Login.module.css'

// This is intentionally shared for the private friends-only club. It keeps the
// UI email-only while still creating regular Supabase accounts.
const CLUB_PASSWORD = 'testing'

function Login() {
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in')
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const location = useLocation()
  const navigate = useNavigate()

  const redirectTo = location.state?.from?.pathname || '/'

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    if (!supabase) {
      setError('Login is not configured yet.')
      return
    }

    setLoading(true)
    setError('')

    const normalizedEmail = email.trim().toLowerCase()
    let user: { id: string } | null = null
    let authError: { message: string } | null = null

    if (mode === 'sign-up') {
      const signUpResult = await supabase.auth.signUp({
        email: normalizedEmail,
        password: CLUB_PASSWORD,
        options: { data: { full_name: fullName.trim() } },
      })

      user = signUpResult.data.user
      authError = signUpResult.error
    } else {
      const signInResult = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password: CLUB_PASSWORD,
      })

      user = signInResult.data.user
      authError = signInResult.error
    }

    if (authError && /email not confirmed/i.test(authError.message)) {
      setError('This account needs email confirmation turned off in Supabase: Authentication → Providers → Email → Confirm email.')
      setLoading(false)
      return
    }

    if (authError && /already registered|already exists/i.test(authError.message)) {
      setError('This email already has an account. Switch to Sign in, or remove the old account from Supabase before recreating it with the new club login.')
      setLoading(false)
      return
    }

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    if (!user) {
      setError('Supabase requires email confirmation. Disable Confirm email in Authentication settings for this private club.')
      setLoading(false)
      return
    }

    const profileResult = mode === 'sign-up'
      ? await supabase.from('profiles').upsert({
          id: user.id,
          username: normalizedEmail,
          full_name: fullName.trim(),
        })
      : await supabase.from('profiles').update({ username: normalizedEmail }).eq('id', user.id)

    const profileError = profileResult.error

    if (profileError) {
      setError(profileError.message)
      setLoading(false)
      return
    }

    navigate(redirectTo, { replace: true })
  }

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <p className={styles.kicker}>NYC BOOK CLUB</p>

        <h1>{mode === 'sign-in' ? <>Welcome <em>back.</em></> : <>Join the <em>club.</em></>}</h1>

        <p className={styles.description}>
          {mode === 'sign-in' ? 'Enter your email to return to the reading room.' : 'Create your club account with your name and email.'}
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

          {error && <p className={styles.error}>{error}</p>}

          <button
            className="primary-button"
            type="submit"
            disabled={loading}
          >
            {loading ? 'Entering the club…' : mode === 'sign-in' ? 'Enter the club →' : 'Create my account →'}
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

      </div>
    </main>
  )
}

export default Login
