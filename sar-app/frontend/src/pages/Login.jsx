import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth, isRescuer } from '../auth/AuthContext'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)
  const { login } = useAuth()
  const nav = useNavigate()

  async function submit(e) {
    e.preventDefault()
    setBusy(true); setErr(null)
    try {
      const u = await login(email, password)
      nav(isRescuer(u) ? '/dashboard' : '/report')
    } catch (e) { setErr(e.message) }
    finally { setBusy(false) }
  }

  return (
    <div className="card" style={{ maxWidth: 420, margin: '40px auto' }}>
      <h2>Sign in</h2>
      {err && <div className="alert" style={{ marginBottom: 12 }}>{err}</div>}
      <form onSubmit={submit} className="stack">
        <div>
          <label>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div>
          <label>Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <button disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
      <p className="small muted" style={{ marginTop: 16 }}>
        No account? <Link to="/register">Register</Link>
      </p>
    </div>
  )
}
