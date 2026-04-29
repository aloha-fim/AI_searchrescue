import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { isRescuer, useAuth } from '../auth/AuthContext'

const CATEGORIES = ['medical', 'fuel', 'food', 'water', 'gear', 'comms', 'general']

export default function Supplies() {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)
  const [filter, setFilter] = useState('')
  const [lowOnly, setLowOnly] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [newItem, setNewItem] = useState({
    name: '', category: 'general', unit: 'each',
    quantity: 0, minimum_quantity: 0, location: 'HQ', notes: '',
  })

  async function refresh() {
    setLoading(true)
    try {
      const params = {}
      if (filter) params.category = filter
      if (lowOnly) params.low_stock_only = true
      setItems(await api.listSupplies(params))
    } catch (e) { setErr(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { refresh() /* eslint-disable-next-line */ }, [filter, lowOnly])

  async function adjust(item, change, phase, reason) {
    try {
      await api.addTransaction(item.id, { change, phase, reason })
      await refresh()
    } catch (e) { setErr(e.message) }
  }

  async function createItem(e) {
    e.preventDefault()
    try {
      await api.createSupply(newItem)
      setShowNew(false)
      setNewItem({ name: '', category: 'general', unit: 'each', quantity: 0, minimum_quantity: 0, location: 'HQ', notes: '' })
      await refresh()
    } catch (e) { setErr(e.message) }
  }

  const canEdit = user && ['watchstander', 'admin'].includes(user.role)
  const canTransact = isRescuer(user)

  return (
    <div>
      <div className="card">
        <div className="row" style={{ alignItems: 'center' }}>
          <h2 style={{ margin: 0 }}>Supplies</h2>
          <div className="row tight" style={{ flex: 0 }}>
            <select value={filter} onChange={(e) => setFilter(e.target.value)} style={{ minWidth: 140 }}>
              <option value="">All categories</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <label className="row tight small" style={{ gap: 6 }}>
              <input type="checkbox" style={{ width: 'auto' }}
                     checked={lowOnly} onChange={(e) => setLowOnly(e.target.checked)} />
              Low stock only
            </label>
            {canEdit && (
              <button onClick={() => setShowNew((s) => !s)}>
                {showNew ? 'Cancel' : '+ New supply'}
              </button>
            )}
          </div>
        </div>

        {err && <div className="alert" style={{ marginTop: 12 }}>{err}</div>}

        {showNew && canEdit && (
          <form onSubmit={createItem} className="card" style={{ marginTop: 12, background: 'var(--bg-2)' }}>
            <div className="grid cols-3">
              <div><label>Name</label>
                <input required value={newItem.name}
                  onChange={(e) => setNewItem({ ...newItem, name: e.target.value })} />
              </div>
              <div><label>Category</label>
                <select value={newItem.category}
                  onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div><label>Unit</label>
                <input value={newItem.unit}
                  onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })} />
              </div>
              <div><label>Quantity</label>
                <input type="number" value={newItem.quantity}
                  onChange={(e) => setNewItem({ ...newItem, quantity: Number(e.target.value) })} />
              </div>
              <div><label>Minimum</label>
                <input type="number" value={newItem.minimum_quantity}
                  onChange={(e) => setNewItem({ ...newItem, minimum_quantity: Number(e.target.value) })} />
              </div>
              <div><label>Location</label>
                <input value={newItem.location}
                  onChange={(e) => setNewItem({ ...newItem, location: e.target.value })} />
              </div>
            </div>
            <button style={{ marginTop: 12 }}>Create</button>
          </form>
        )}

        {loading ? <p className="muted">Loading…</p>
          : items.length === 0 ? <div className="empty">No supplies match this filter.</div>
          : (
            <table style={{ marginTop: 12 }}>
              <thead>
                <tr>
                  <th>Item</th><th>Category</th><th>Location</th>
                  <th>Stock</th><th>Min</th><th style={{ width: 200 }}>Adjust</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => {
                  const low = it.quantity <= it.minimum_quantity
                  const pct = it.minimum_quantity > 0
                    ? Math.min(100, (it.quantity / (it.minimum_quantity * 2)) * 100)
                    : 100
                  return (
                    <tr key={it.id}>
                      <td>
                        <div><strong>{it.name}</strong></div>
                        {it.notes && <div className="small muted">{it.notes}</div>}
                      </td>
                      <td><span className="tag">{it.category}</span></td>
                      <td className="small">{it.location}</td>
                      <td>
                        <div>{it.quantity} {it.unit}{it.quantity === 1 ? '' : 's'}</div>
                        <div className={`progress ${low ? 'low' : ''}`} style={{ marginTop: 4 }}>
                          <div style={{ width: `${pct}%` }} />
                        </div>
                        {low && <span className="tag" style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}>LOW</span>}
                      </td>
                      <td>{it.minimum_quantity}</td>
                      <td>
                        {canTransact ? (
                          <div className="row tight">
                            <button className="secondary" onClick={() => adjust(it, -1, 'during', 'deployed')}>-1 deploy</button>
                            <button className="secondary" onClick={() => adjust(it, +1, 'post', 'restocked')}>+1 restock</button>
                          </div>
                        ) : <span className="muted small">read only</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
      </div>
    </div>
  )
}
