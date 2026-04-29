import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'

const FILTERS = [
  { value: '', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
]

export default function RescuerDashboard() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')

  useEffect(() => {
    setLoading(true)
    api.listIncidents(filter || undefined)
      .then(setItems)
      .finally(() => setLoading(false))
  }, [filter])

  return (
    <div>
      <div className="card">
        <h2>Active operations</h2>
        <div className="row" style={{ marginBottom: 12 }}>
          <select value={filter} onChange={(e) => setFilter(e.target.value)} style={{ maxWidth: 200 }}>
            {FILTERS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        </div>
        {loading ? <p className="muted">Loading…</p>
          : items.length === 0 ? <div className="empty">No incidents.</div>
          : (
            <table>
              <thead>
                <tr>
                  <th>ID</th><th>Status</th><th>Persons</th>
                  <th>Last known location</th><th>Latest message</th><th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {items.map((inc) => (
                  <tr key={inc.id} style={{ cursor: 'pointer' }}>
                    <td><Link to={`/incidents/${inc.id}`}>#{inc.id}</Link></td>
                    <td><span className={`tag ${inc.status}`}>{inc.status}</span></td>
                    <td>{inc.persons_in_distress}</td>
                    <td>
                      {inc.last_lat != null
                        ? <span>{inc.last_lat.toFixed(4)}, {inc.last_lon.toFixed(4)}</span>
                        : <span className="muted">unknown</span>}
                      {inc.inferred_location_name && (
                        <div className="small muted">↳ {inc.inferred_location_name}</div>
                      )}
                    </td>
                    <td className="small">
                      {inc.last_message
                        ? inc.last_message.length > 80 ? inc.last_message.slice(0, 80) + '…' : inc.last_message
                        : <span className="muted">—</span>}
                    </td>
                    <td className="small muted">{new Date(inc.updated_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </div>
    </div>
  )
}
