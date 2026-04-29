import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../api/client'
import { isRescuer, useAuth } from '../auth/AuthContext'
import AuthImage from '../components/AuthImage'

const STATUSES = ['open', 'in_progress', 'resolved', 'closed']

export default function IncidentDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const [inc, setInc] = useState(null)
  const [err, setErr] = useState(null)
  const [posting, setPosting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [text, setText] = useState('')
  const fileInput = useRef(null)
  const pollRef = useRef(null)

  async function refresh() {
    try {
      const data = await api.getIncident(id)
      setInc(data)
    } catch (e) { setErr(e.message) }
  }

  useEffect(() => {
    refresh()
    pollRef.current = setInterval(refresh, 8000)
    return () => clearInterval(pollRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function sendMessage(e) {
    e.preventDefault()
    if (!text.trim()) return
    setPosting(true); setErr(null)
    try {
      await api.postMessage(id, text)
      setText('')
      await refresh()
    } catch (e) { setErr(e.message) }
    finally { setPosting(false) }
  }

  async function uploadFile(e) {
    const f = e.target.files?.[0]
    if (!f) return
    setUploading(true); setErr(null)
    try {
      await api.uploadImage(id, f)
      e.target.value = ''
      await refresh()
    } catch (e) { setErr(e.message) }
    finally { setUploading(false) }
  }

  async function setStatus(s) {
    try {
      await api.updateIncident(id, { status: s })
      await refresh()
    } catch (e) { setErr(e.message) }
  }

  if (!inc) return <p className="muted">Loading…</p>

  const rescuer = isRescuer(user)
  const isOwner = inc.reported_by_id === user.id

  return (
    <div>
      <div className="card">
        <div className="row" style={{ alignItems: 'flex-start' }}>
          <div>
            <h2 style={{ marginBottom: 4 }}>
              Incident #{inc.id} <span className={`tag ${inc.status}`}>{inc.status}</span>
            </h2>
            <div className="muted small">
              Opened {new Date(inc.created_at).toLocaleString()} •
              Updated {new Date(inc.updated_at).toLocaleString()}
            </div>
          </div>
          {rescuer && (
            <div className="row tight" style={{ flex: 0 }}>
              {STATUSES.map((s) => (
                <button key={s} className="secondary" disabled={s === inc.status}
                        onClick={() => setStatus(s)}>{s.replace('_', ' ')}</button>
              ))}
            </div>
          )}
        </div>

        {err && <div className="alert" style={{ marginTop: 12 }}>{err}</div>}

        <div className="grid cols-3" style={{ marginTop: 16 }}>
          <div>
            <div className="muted small">Persons in distress</div>
            <div style={{ fontSize: 24 }}>{inc.persons_in_distress}</div>
          </div>
          <div>
            <div className="muted small">Last known coordinates</div>
            <div>
              {inc.last_lat != null
                ? <code>{inc.last_lat.toFixed(5)}, {inc.last_lon.toFixed(5)}</code>
                : <span className="muted">unknown</span>}
            </div>
            {inc.location_confidence && (
              <div className="small muted">source: {inc.location_confidence}</div>
            )}
          </div>
          <div>
            <div className="muted small">Inferred location</div>
            <div>{inc.inferred_location_name || <span className="muted">—</span>}</div>
          </div>
        </div>
        {inc.summary && (
          <p className="muted" style={{ marginTop: 12 }}>{inc.summary}</p>
        )}
      </div>

      <div className="grid cols-2">
        {/* Images */}
        <div className="card">
          <div className="row">
            <h3 style={{ margin: 0 }}>Photos & analysis</h3>
            <div className="row tight" style={{ flex: 0 }}>
              <input ref={fileInput} type="file" accept="image/*" capture="environment"
                     onChange={uploadFile} style={{ display: 'none' }} />
              {(isOwner || rescuer) && (
                <button onClick={() => fileInput.current?.click()} disabled={uploading}>
                  {uploading ? 'Analyzing…' : '📷 Upload photo'}
                </button>
              )}
            </div>
          </div>
          {inc.images.length === 0 ? (
            <div className="empty">No photos yet.</div>
          ) : (
            <div className="image-grid">
              {inc.images.map((img) => (
                <div className="image-tile" key={img.id}>
                  <AuthImage imageId={img.id} alt={img.caption || ''} />
                  <div className="body stack">
                    <div><strong>{img.caption || '(no caption)'}</strong></div>
                    {img.detailed_description && (
                      <div className="small muted">{img.detailed_description}</div>
                    )}
                    {img.landmarks && (
                      <div className="small">🏔 <strong>Landmarks:</strong> {img.landmarks}</div>
                    )}
                    {img.inferred_location && (
                      <div className="small">📍 <strong>Likely location:</strong> {img.inferred_location}
                        {img.confidence != null && (
                          <span className="muted"> ({Math.round(img.confidence * 100)}% conf)</span>
                        )}
                      </div>
                    )}
                    {img.location_reasoning && (
                      <div className="small muted">↳ {img.location_reasoning}</div>
                    )}
                    {img.motion_analysis && (
                      <div className="small">🎯 <strong>Motion:</strong> {img.motion_analysis}</div>
                    )}
                    {img.hazards && (
                      <div className="small">⚠️ <strong>Hazards:</strong> {img.hazards}</div>
                    )}
                    {img.gps_lat != null && (
                      <div className="small muted">EXIF GPS: {img.gps_lat.toFixed(5)}, {img.gps_lon.toFixed(5)}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Messages */}
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Messages (translated)</h3>
          <div className="stack" style={{ maxHeight: 360, overflow: 'auto', marginBottom: 12 }}>
            {inc.messages.length === 0
              ? <div className="empty">No messages yet.</div>
              : inc.messages.map((m) => (
                <div key={m.id} className="card" style={{ marginBottom: 0, background: 'var(--bg-2)' }}>
                  <div className="row" style={{ alignItems: 'baseline' }}>
                    <strong>{m.cleaned_text || m.translated_text || m.original_text}</strong>
                    {m.urgency && (
                      <span className={`tag urgency-${m.urgency}`} style={{ flex: 0 }}>{m.urgency}</span>
                    )}
                  </div>
                  {m.translated_text && m.cleaned_text && m.translated_text !== m.cleaned_text && (
                    <div className="small muted" style={{ marginTop: 4 }}>
                      Full translation: {m.translated_text}
                    </div>
                  )}
                  <div className="small muted" style={{ marginTop: 4 }}>
                    Original ({m.detected_language || 'unknown'}): "{m.original_text}"
                  </div>
                  {m.extracted_intent && (
                    <div className="small" style={{ marginTop: 4 }}>
                      Intent: {m.extracted_intent}
                    </div>
                  )}
                  <div className="small muted" style={{ marginTop: 4 }}>
                    {new Date(m.created_at).toLocaleString()}
                  </div>
                </div>
              ))}
          </div>
          {(isOwner || rescuer) && (
            <form onSubmit={sendMessage} className="stack">
              <textarea rows={3} placeholder="Type anything — broken English is fine, we'll clean it up"
                value={text} onChange={(e) => setText(e.target.value)} />
              <button disabled={posting || !text.trim()}>
                {posting ? 'Translating…' : 'Send message'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
