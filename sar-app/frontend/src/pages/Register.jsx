import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth, isRescuer } from '../auth/AuthContext'

const ROLES = [
  { value: 'victim', label: 'Person in distress' },
  { value: 'pilot', label: 'Helicopter pilot' },
  { value: 'swimmer', label: 'Rescue swimmer' },
  { value: 'watchstander', label: 'Watchstander' },
  { value: 'admin', label: 'Admin' },
]

export default function Register() {
  const [form, setForm] = useState({
    email: '', full_name: '', password: '', role: 'victim',
  })
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)
  const { register } = useAuth()
  const nav = useNavigate()

  function update(k, v) { setForm({ ...form, [k]: v }) }

  async function submit(e) {
    e.preventDefault()
    setBusy(true); setErr(null)
    try {
      const u = await register(form)
      nav(isRescuer(u) ? '/dashboard' : '/report')
    } catch (e) { setErr(e.message) }
    finally { setBusy(false) }
  }

  return (
    <div className="card" style={{ maxWidth: 480, margin: '40px auto' }}>
      <h2>Create account</h2>
      {err && <div className="alert" style={{ marginBottom: 12 }}>{err}</div>}
      <form onSubmit={submit} className="stack">
        <div>
          <label>Full name</label>
          <input value={form.full_name} onChange={(e) => update('full_name', e.target.value)} required />
        </div>
        <div>
          <label>Email</label>
          <input type="email" value={form.email} onChange={(e) => update('email', e.target.value)} required />
        </div>
        <div>
          <label>Password</label>
          <input type="password" value={form.password} onChange={(e) => update('password', e.target.value)} required minLength={6} />
        </div>
        <div>
          <label>Role</label>
          <select value={form.role} onChange={(e) => update('role', e.target.value)}>
            {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>
        <button disabled={busy}>{busy ? 'Creating…' : 'Create account'}</button>
      </form>
      <p className="small muted" style={{ marginTop: 16 }}>
        Already have an account? <Link to="/login">Sign in</Link>
      </p>
    </div>
  )
}
