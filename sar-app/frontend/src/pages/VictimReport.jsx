import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'

export default function VictimReport() {
  const [activeIncident, setActiveIncident] = useState(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)
  const [persons, setPersons] = useState(1)
  const [summary, setSummary] = useState('')
  const [coords, setCoords] = useState(null)
  const [creating, setCreating] = useState(false)
  const nav = useNavigate()

  useEffect(() => {
    api.listIncidents()
      .then((list) => {
        const open = list.find((i) => i.status === 'open' || i.status === 'in_progress')
        setActiveIncident(open || null)
      })
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false))
  }, [])

  function getLocation() {
    if (!navigator.geolocation) { setErr('Geolocation not supported by your browser'); return }
    navigator.geolocation.getCurrentPosition(
      (pos) => setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      (e) => setErr(`Could not get GPS: ${e.message}`),
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  async function startIncident(e) {
    e.preventDefault()
    setCreating(true); setErr(null)
    try {
      const inc = await api.createIncident({
        summary,
        last_lat: coords?.lat,
        last_lon: coords?.lon,
        persons_in_distress: Number(persons) || 1,
      })
      nav(`/incidents/${inc.id}`)
    } catch (e) { setErr(e.message) }
    finally { setCreating(false) }
  }

  if (loading) return <p className="muted">Loading…</p>

  if (activeIncident) {
    return (
      <div className="card">
        <h2>You have an active distress signal</h2>
        <p className="muted">
          Stay calm. Open your incident page to send more photos and messages —
          rescuers can see them in real time.
        </p>
        <button onClick={() => nav(`/incidents/${activeIncident.id}`)}>
          Open incident #{activeIncident.id}
        </button>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <div className="card">
        <h2>🆘 Send distress signal</h2>
        <p className="muted">
          We will share your location, photos, and messages with search-and-rescue
          teams immediately. Don't worry about spelling or grammar — we will
          translate and clean up any message you send.
        </p>
        {err && <div className="alert" style={{ marginBottom: 12 }}>{err}</div>}
        <form onSubmit={startIncident} className="stack">
          <div>
            <label>Quick description (optional)</label>
            <textarea
              rows={3}
              placeholder="e.g. ship sinking, can see island"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
            />
          </div>
          <div>
            <label>How many people are in trouble?</label>
            <input
              type="number" min={1}
              value={persons}
              onChange={(e) => setPersons(e.target.value)}
            />
          </div>
          <div className="row tight">
            <button type="button" className="secondary" onClick={getLocation}>
              {coords ? '📍 Update GPS' : '📍 Share GPS location'}
            </button>
            {coords && (
              <span className="small muted">
                {coords.lat.toFixed(5)}, {coords.lon.toFixed(5)}
              </span>
            )}
          </div>
          <button disabled={creating} style={{ background: 'var(--danger)', color: '#fff' }}>
            {creating ? 'Sending…' : '🆘 SEND DISTRESS SIGNAL'}
          </button>
        </form>
      </div>
    </div>
  )
}
