import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../api/client'
import './Operations.css'

// ---------- Fallback supplies if backend isn't reachable ----------
const DEMO_SUPPLIES = [
  { id: 1, name: 'Trauma kit',          category: 'medical', quantity: 12, minimum_quantity: 8,  unit: 'kit'    },
  { id: 2, name: 'Bandages, sterile',   category: 'medical', quantity: 84, minimum_quantity: 40, unit: 'pack'   },
  { id: 3, name: 'IV saline 1L',        category: 'medical', quantity: 6,  minimum_quantity: 12, unit: 'bag'    },
  { id: 4, name: 'Diesel, Jet-A',       category: 'fuel',    quantity: 320, minimum_quantity: 200, unit: 'gal'  },
  { id: 5, name: 'MRE',                 category: 'food',    quantity: 144, minimum_quantity: 100, unit: 'meal' },
  { id: 6, name: 'Potable water',       category: 'water',   quantity: 96, minimum_quantity: 60, unit: 'L'      },
  { id: 7, name: 'Thermal blanket',     category: 'gear',    quantity: 40, minimum_quantity: 20, unit: 'unit'   },
  { id: 8, name: 'VHF handheld',        category: 'comms',   quantity: 9,  minimum_quantity: 6,  unit: 'unit'   },
  { id: 9, name: 'PFD, adult',          category: 'gear',    quantity: 24, minimum_quantity: 30, unit: 'unit'   },
  { id: 10, name: 'Flare, signal',      category: 'gear',    quantity: 18, minimum_quantity: 12, unit: 'unit'   },
]

const CAT_COLORS = {
  medical: '#FF4D6D',
  fuel:    '#FFD166',
  food:    '#A0E548',
  water:   '#00E5FF',
  gear:    '#9B8AFB',
  comms:   '#FF9F43',
  general: '#94A3B8',
}

// ---------- BESS simulation ----------
// Models a 2 MWh / 500 kW LG Vertech-style containerized BESS
// Positive power = discharging (load draw), negative = charging (grid/PV)
function initialBess() {
  return {
    soc: 78.2,
    socTarget: 78.2,
    power: -85,            // kW, currently charging
    voltage: 826.4,
    current: -103,
    tempMax: 28.4,
    tempMin: 24.1,
    energyToday: 1284.6,   // kWh discharged today
    energyChargedToday: 942.3,
    peakPower: 412,
    health: 98.2,
    capacityKwh: 2000,
    powerRatedKw: 500,
    alarms: 0,
    racks: Array.from({ length: 16 }, () => 75 + Math.random() * 8),
    history: Array.from({ length: 60 }, (_, i) => ({
      t: i,
      p: -80 + Math.sin(i / 6) * 60 + (Math.random() - 0.5) * 30,
    })),
    site: 'SAR Ops Center — Container 01',
    serial: 'LGV-AEROS-2K-0042',
    firmware: 'AEROS 4.2.1',
  }
}

function tickBess(prev) {
  // Random walk around a slowly drifting target power
  const drift = (Math.random() - 0.5) * 40
  let nextPower = prev.power * 0.85 + drift
  // Occasionally swing modes
  if (Math.random() < 0.04) nextPower = -nextPower * 0.7
  nextPower = Math.max(-prev.powerRatedKw, Math.min(prev.powerRatedKw, nextPower))

  // SOC moves opposite to power (discharge depletes)
  const dtH = 1 / 3600 // 1 second tick in hours
  const efficiency = 0.94
  let socDelta = (-nextPower * dtH) / prev.capacityKwh * 100
  if (nextPower < 0) socDelta *= efficiency        // charging losses
  else socDelta /= efficiency                      // discharging losses
  let nextSoc = Math.max(8, Math.min(98, prev.soc + socDelta * 60)) // amplified for visible motion

  const nextHistory = [...prev.history.slice(1), { t: prev.history.length, p: nextPower }]
  const nextEnergyToday = nextPower > 0 ? prev.energyToday + nextPower * dtH : prev.energyToday
  const nextEnergyCharged = nextPower < 0 ? prev.energyChargedToday + (-nextPower) * dtH : prev.energyChargedToday

  return {
    ...prev,
    soc: nextSoc,
    power: nextPower,
    voltage: 820 + (nextSoc - 50) * 0.3 + (Math.random() - 0.5) * 1.2,
    current: (nextPower * 1000) / (820 + (nextSoc - 50) * 0.3),
    tempMax: 26 + Math.abs(nextPower) / 60 + Math.random() * 0.4,
    tempMin: 23 + Math.abs(nextPower) / 100 + Math.random() * 0.4,
    energyToday: nextEnergyToday,
    energyChargedToday: nextEnergyCharged,
    peakPower: Math.max(prev.peakPower, Math.abs(nextPower)),
    racks: prev.racks.map((r) => Math.max(60, Math.min(99, r + (Math.random() - 0.5) * 0.6))),
    history: nextHistory,
  }
}

// ---------- Page ----------
export default function Operations() {
  const [supplies, setSupplies] = useState(DEMO_SUPPLIES)
  const [suppliesError, setSuppliesError] = useState(false)
  const [bess, setBess] = useState(initialBess)
  const [filter, setFilter] = useState('all')

  // Pull supplies from the existing backend; fall back to demo data
  useEffect(() => {
    let live = true
    api.get('/supplies')
      .then((res) => { if (live && Array.isArray(res?.data)) setSupplies(res.data) })
      .catch(() => { if (live) setSuppliesError(true) })
    return () => { live = false }
  }, [])

  // Live BESS ticker
  useEffect(() => {
    const id = setInterval(() => setBess((p) => tickBess(p)), 1000)
    return () => clearInterval(id)
  }, [])

  const filtered = useMemo(() => {
    if (filter === 'all') return supplies
    if (filter === 'low') return supplies.filter((s) => s.quantity <= s.minimum_quantity)
    return supplies.filter((s) => s.category === filter)
  }, [supplies, filter])

  const lowCount = supplies.filter((s) => s.quantity <= s.minimum_quantity).length
  const isCharging = bess.power < 0
  const runtimeHrs = bess.power > 0 ? (bess.soc / 100 * bess.capacityKwh) / bess.power : Infinity

  return (
    <div className="ops-page">
      <Header bess={bess} />

      <div className="ops-grid">
        {/* ---------- LEFT: SUPPLIES ---------- */}
        <section className="panel supplies-panel">
          <div className="panel-head">
            <div>
              <h2 className="panel-title">Supplies</h2>
              <p className="panel-sub">
                {supplies.length} items · <span className={lowCount ? 'low' : 'ok'}>{lowCount} low</span>
                {suppliesError && <span className="muted"> · offline data</span>}
              </p>
            </div>
            <div className="filter-row">
              {['all', 'low', 'medical', 'fuel', 'food', 'water', 'gear', 'comms'].map((c) => (
                <button
                  key={c}
                  className={`chip ${filter === c ? 'chip-active' : ''}`}
                  onClick={() => setFilter(c)}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <ul className="supply-list">
            {filtered.map((s) => {
              const pct = Math.min(150, (s.quantity / Math.max(s.minimum_quantity, 1)) * 100)
              const low = s.quantity <= s.minimum_quantity
              const color = CAT_COLORS[s.category] || CAT_COLORS.general
              return (
                <li key={s.id} className={`supply-row ${low ? 'is-low' : ''}`}>
                  <div className="supply-cat" style={{ background: color }} />
                  <div className="supply-main">
                    <div className="supply-name">{s.name}</div>
                    <div className="supply-meta">
                      <span className="cat-tag" style={{ color }}>{s.category}</span>
                      <span className="muted">min {s.minimum_quantity} {s.unit}</span>
                      {low && <span className="badge badge-low">LOW</span>}
                    </div>
                    <div className="supply-bar">
                      <div
                        className="supply-bar-fill"
                        style={{
                          width: `${Math.min(100, pct)}%`,
                          background: low ? 'var(--alarm)' : color,
                        }}
                      />
                    </div>
                  </div>
                  <div className="supply-qty">
                    <div className="qty-num">{s.quantity}</div>
                    <div className="qty-unit">{s.unit}</div>
                  </div>
                </li>
              )
            })}
            {filtered.length === 0 && <li className="empty">No items match this filter.</li>}
          </ul>
        </section>

        {/* ---------- RIGHT: BESS ---------- */}
        <section className="panel bess-panel">
          <div className="bess-bg" aria-hidden="true">
            <div className="grid-lines" />
            <div className="glow glow-1" />
            <div className="glow glow-2" />
          </div>

          <div className="bess-head">
            <div>
              <div className="bess-tag">LG ENERGY SOLUTION VERTECH · BESS</div>
              <h2 className="bess-title">{bess.site}</h2>
              <div className="bess-meta">
                <span>{bess.serial}</span>
                <span className="dot">·</span>
                <span>{bess.firmware}</span>
                <span className="dot">·</span>
                <span className={`pill ${isCharging ? 'pill-charge' : 'pill-discharge'}`}>
                  <span className="pill-dot" />
                  {isCharging ? 'CHARGING' : 'DISCHARGING'}
                </span>
              </div>
            </div>
            <div className="bess-rated">
              <div><b>{bess.capacityKwh.toLocaleString()}</b> kWh</div>
              <div><b>{bess.powerRatedKw}</b> kW</div>
            </div>
          </div>

          <div className="bess-main">
            <SocRing soc={bess.soc} charging={isCharging} />
            <div className="bess-stats">
              <Stat label="Power"   value={Math.abs(bess.power).toFixed(1)} unit="kW"
                    accent={isCharging ? 'charge' : 'discharge'}
                    arrow={isCharging ? 'down' : 'up'} />
              <Stat label="Voltage" value={bess.voltage.toFixed(1)} unit="V DC" />
              <Stat label="Current" value={Math.abs(bess.current).toFixed(0)} unit="A" />
              <Stat label="Temp"    value={`${bess.tempMin.toFixed(1)}–${bess.tempMax.toFixed(1)}`} unit="°C" />
              <Stat label="kWh today (out)" value={bess.energyToday.toFixed(0)} unit="kWh"
                    accent="discharge" />
              <Stat label="kWh today (in)" value={bess.energyChargedToday.toFixed(0)} unit="kWh"
                    accent="charge" />
              <Stat label="Health"  value={bess.health.toFixed(1)} unit="%" />
              <Stat label="Runtime" value={isFinite(runtimeHrs) ? runtimeHrs.toFixed(1) : '∞'} unit="h" />
            </div>
          </div>

          <div className="bess-flow">
            <FlowChart history={bess.history} charging={isCharging} />
          </div>

          <div className="bess-racks">
            <div className="racks-head">
              <span className="bess-tag">RACK STATE OF CHARGE · 16 STRINGS</span>
              <span className="muted small">σ {rackSigma(bess.racks).toFixed(2)}</span>
            </div>
            <div className="rack-grid">
              {bess.racks.map((r, i) => (
                <div key={i} className="rack" title={`Rack ${i + 1}: ${r.toFixed(1)}%`}>
                  <div className="rack-fill" style={{ height: `${r}%`, background: rackColor(r) }} />
                  <div className="rack-label">{String(i + 1).padStart(2, '0')}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

// ---------- Header ----------
function Header({ bess }) {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return (
    <header className="ops-header">
      <div>
        <div className="eyebrow">SAR · OPERATIONS CENTER</div>
        <h1 className="page-title">Logistics &amp; Power</h1>
      </div>
      <div className="header-right">
        <div className="clock">{now.toLocaleTimeString([], { hour12: false })}</div>
        <div className="muted small">{now.toDateString()}</div>
        <div className={`status ${bess.alarms ? 'status-alarm' : 'status-ok'}`}>
          <span className="status-dot" />
          {bess.alarms ? `${bess.alarms} ALARMS` : 'ALL SYSTEMS NOMINAL'}
        </div>
      </div>
    </header>
  )
}

// ---------- SOC ring ----------
function SocRing({ soc, charging }) {
  const r = 92
  const c = 2 * Math.PI * r
  const dash = (soc / 100) * c
  return (
    <div className="soc-wrap">
      <svg viewBox="-110 -110 220 220" className="soc-svg">
        <defs>
          <linearGradient id="socGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%"  stopColor={charging ? '#00FFD1' : '#FF7847'} />
            <stop offset="100%" stopColor={charging ? '#00B7FF' : '#FFD166'} />
          </linearGradient>
          <filter id="socGlow">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        {/* track */}
        <circle r={r} fill="none" stroke="rgba(255,255,255,.06)" strokeWidth="14" />
        {/* fill */}
        <circle
          r={r}
          fill="none"
          stroke="url(#socGrad)"
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c - dash}`}
          transform="rotate(-90)"
          filter="url(#socGlow)"
          style={{ transition: 'stroke-dasharray 800ms cubic-bezier(.2,.8,.2,1)' }}
        />
        {/* tick marks */}
        {Array.from({ length: 60 }).map((_, i) => {
          const a = (i / 60) * Math.PI * 2 - Math.PI / 2
          const x1 = Math.cos(a) * (r + 14)
          const y1 = Math.sin(a) * (r + 14)
          const x2 = Math.cos(a) * (r + (i % 5 === 0 ? 22 : 18))
          const y2 = Math.sin(a) * (r + (i % 5 === 0 ? 22 : 18))
          return (
            <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
                  stroke={i % 5 === 0 ? 'rgba(255,255,255,.35)' : 'rgba(255,255,255,.12)'}
                  strokeWidth={i % 5 === 0 ? 1.4 : 0.8} />
          )
        })}
      </svg>
      <div className="soc-text">
        <div className="soc-num">{soc.toFixed(1)}<span className="soc-pct">%</span></div>
        <div className="soc-label">STATE OF CHARGE</div>
        <div className={`soc-mode ${charging ? 'is-charge' : 'is-discharge'}`}>
          {charging ? '↓ CHARGING' : '↑ DISCHARGING'}
        </div>
      </div>
    </div>
  )
}

// ---------- Stat tile ----------
function Stat({ label, value, unit, accent, arrow }) {
  return (
    <div className={`stat ${accent ? `stat-${accent}` : ''}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">
        {arrow && <span className={`stat-arrow arrow-${arrow}`}>{arrow === 'up' ? '↑' : '↓'}</span>}
        {value}
        <span className="stat-unit">{unit}</span>
      </div>
    </div>
  )
}

// ---------- Live power flow chart ----------
function FlowChart({ history, charging }) {
  const W = 800, H = 160, PAD = 8
  const max = 500
  const points = history.map((d, i) => {
    const x = (i / (history.length - 1)) * (W - PAD * 2) + PAD
    const y = H / 2 - (d.p / max) * (H / 2 - PAD)
    return [x, y]
  })
  const pathLine = points.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const pathArea = `${pathLine} L${W - PAD},${H / 2} L${PAD},${H / 2} Z`

  return (
    <div className="flow-wrap">
      <div className="flow-head">
        <span className="bess-tag">REAL-TIME POWER · 60 s</span>
        <span className="flow-legend">
          <span className="lg-charge" />charge
          <span className="lg-discharge" />discharge
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="flow-svg" preserveAspectRatio="none">
        <defs>
          <linearGradient id="flowGradD" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"  stopColor="#FF7847" stopOpacity=".55" />
            <stop offset="100%" stopColor="#FF7847" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="flowGradC" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%"  stopColor="#00FFD1" stopOpacity=".55" />
            <stop offset="100%" stopColor="#00FFD1" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* zero line */}
        <line x1={PAD} y1={H / 2} x2={W - PAD} y2={H / 2}
              stroke="rgba(255,255,255,.18)" strokeDasharray="4 4" />
        {/* grid */}
        {[0.25, 0.75].map((f) => (
          <line key={f} x1={PAD} y1={H * f} x2={W - PAD} y2={H * f}
                stroke="rgba(255,255,255,.05)" />
        ))}
        {/* area */}
        <path d={pathArea} fill={charging ? 'url(#flowGradC)' : 'url(#flowGradD)'} />
        {/* line */}
        <path d={pathLine} fill="none"
              stroke={charging ? '#00FFD1' : '#FF7847'} strokeWidth="2"
              style={{ filter: 'drop-shadow(0 0 6px currentColor)' }} />
        {/* head dot */}
        {points.length > 0 && (
          <circle cx={points[points.length - 1][0]} cy={points[points.length - 1][1]} r="4"
                  fill={charging ? '#00FFD1' : '#FF7847'}>
            <animate attributeName="r" values="3;6;3" dur="1.6s" repeatCount="indefinite" />
          </circle>
        )}
        {/* axis labels */}
        <text x={PAD + 4} y={14} className="ax-lbl">+{max} kW</text>
        <text x={PAD + 4} y={H - 4} className="ax-lbl">−{max} kW</text>
      </svg>
    </div>
  )
}

// ---------- Helpers ----------
function rackColor(soc) {
  if (soc > 85) return '#00FFD1'
  if (soc > 70) return '#7CF0BD'
  if (soc > 50) return '#FFD166'
  return '#FF7847'
}
function rackSigma(arr) {
  const m = arr.reduce((a, b) => a + b, 0) / arr.length
  return Math.sqrt(arr.reduce((a, b) => a + (b - m) ** 2, 0) / arr.length)
}
