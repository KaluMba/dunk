import { useState, useEffect, useRef } from 'react'

const _raw = (import.meta.env.VITE_RIVALS_API ?? '').trim()
const API  = (_raw ? (_raw.startsWith('http') ? _raw : `https://${_raw}`) : 'http://localhost:8080').replace(/\/+$/, '')

const RANKS   = ['Bronze','Silver','Gold','Platinum','Diamond','Celestial','One Above All']
const REGIONS = ['NA-East','NA-West','EU','Asia','SA','OCE']
const ROLE_COLOR = { vanguard:'#5b8fe8', duelist:'#e05858', strategist:'#52c47a' }
const ROLE_TAG   = { vanguard:'VG', duelist:'DL', strategist:'ST' }

// Hero name → CDN slug: "Iron Man" → "iron-man", "Cloak & Dagger" → "cloak-dagger"
function heroSlug(name) {
  if (!name) return ''
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
}

function timeAgo(iso) {
  const d = (Date.now() - new Date(iso)) / 1000
  if (d < 60)    return 'just now'
  if (d < 3600)  return `${Math.floor(d / 60)}m ago`
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`
  return `${Math.floor(d / 86400)}d ago`
}

// Portrait from hero name string (registry rows)
function HeroPortrait({ name, size = 36 }) {
  const [err, setErr] = useState(false)
  const slug = heroSlug(name)
  const initials = (name || '?').split(/[\s\-&]+/).map(w => w[0]).filter(Boolean).join('').slice(0, 2).toUpperCase()
  return (
    <div style={{ width: size, height: size, flexShrink: 0, borderRadius: 2, overflow: 'hidden', background: '#12100e' }}>
      {!err && slug
        ? <img src={`https://marvelrivalsapi.com/rivals/heroes/transformations/${slug}-headbig-0.webp`}
               alt={name} onError={() => setErr(true)}
               style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }} />
        : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: size * 0.3, fontWeight: 700, color: '#4a4438', fontFamily: MONO }}>{initials}</div>
      }
    </div>
  )
}

// Portrait from character ID (picker grid)
function CharPortrait({ id, name, role, size = 52 }) {
  const [err, setErr] = useState(false)
  const col = ROLE_COLOR[role] ?? '#888'
  const initials = name.split(/[\s\-&]+/).map(w => w[0]).filter(Boolean).join('').slice(0, 2).toUpperCase()
  return (
    <div style={{ width: size, height: size, flexShrink: 0, overflow: 'hidden', position: 'relative' }}>
      {!err
        ? <img src={`https://marvelrivalsapi.com/rivals/heroes/transformations/${id}-headbig-0.webp`}
               alt={name} onError={() => setErr(true)}
               style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }} />
        : <div style={{ width: '100%', height: '100%', background: `${col}18`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: size * 0.27, fontWeight: 700, color: col, fontFamily: MONO }}>{initials}</div>
      }
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0,
                    background: `${col}22`, borderTop: `1px solid ${col}30`,
                    fontSize: size * 0.17, fontWeight: 700, color: col,
                    textAlign: 'center', padding: '1px 0', fontFamily: MONO, letterSpacing: '0.08em' }}>
        {ROLE_TAG[role] ?? role.slice(0,2).toUpperCase()}
      </div>
    </div>
  )
}

// ── Main overlay ──────────────────────────────────────────────────────────────
export default function RivalsOverlay({ onClose }) {
  const [view, setView]         = useState('registry') // 'registry' | 'join'
  const [players, setPlayers]   = useState([])
  const [chars, setChars]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [newId, setNewId]       = useState(null)

  // Join form
  const [username, setUsername] = useState('')
  const [rank, setRank]         = useState('')
  const [region, setRegion]     = useState('')
  const [selected, setSelected] = useState([])
  const [roleFilter, setFilter] = useState('all')
  const [joining, setJoining]   = useState(false)
  const [joinErr, setJoinErr]   = useState('')
  const usernameRef = useRef()

  useEffect(() => {
    const h = e => {
      if (e.key === 'Escape') { view === 'join' ? setView('registry') : onClose() }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [view, onClose])

  useEffect(() => {
    Promise.all([
      fetch(`${API}/api/players`).then(r => r.json()).catch(() => []),
      fetch(`${API}/api/characters`).then(r => r.json()).catch(() => []),
    ]).then(([pl, ch]) => {
      setPlayers(Array.isArray(pl) ? pl : [])
      setChars(Array.isArray(ch) ? ch : [])
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    if (view === 'join') setTimeout(() => usernameRef.current?.focus(), 80)
  }, [view])

  function toggle(name) {
    setSelected(p => p.includes(name) ? p.filter(c => c !== name) : [...p, name])
  }

  async function join(e) {
    e.preventDefault()
    if (!username.trim()) return setJoinErr('Username required')
    if (!selected.length) return setJoinErr('Select at least one character')
    setJoinErr(''); setJoining(true)
    try {
      const r = await fetch(`${API}/api/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), rank, region, mainCharacters: selected }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Registration failed')
      // Refresh registry
      const updated = await fetch(`${API}/api/players`).then(r => r.json()).catch(() => [])
      setPlayers(Array.isArray(updated) ? updated : [])
      setNewId(d.playerId)
      setView('registry')
      setUsername(''); setRank(''); setRegion(''); setSelected([])
    } catch (err) {
      setJoinErr(err.message)
    } finally {
      setJoining(false)
    }
  }

  const visibleChars = roleFilter === 'all' ? chars : chars.filter(c => c.role === roleFilter)

  return (
    <div style={s.backdrop} onClick={onClose}>
      <div style={s.panel} className="rivals-panel" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={s.header}>
          <div style={s.headerLeft}>
            <span style={s.dot} />
            <span style={s.title}>RIVALS</span>
            <span style={s.subtitle}>TEAMMATE REGISTRY</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {view === 'join'
              ? <button style={s.cancelBtn} onClick={() => setView('registry')}>← BACK</button>
              : <button style={s.joinBtn} onClick={() => setView('join')}>＋ JOIN</button>
            }
            <button style={s.escBtn} onClick={onClose}>ESC</button>
          </div>
        </div>
        <div style={s.rule} />

        {/* Body */}
        <div style={s.body} className="rivals-scroll">

          {/* ── Registry view ───────────────────────────────────────────────── */}
          {view === 'registry' && (
            <>
              {loading ? (
                <div style={s.empty}><span style={s.emptyT}>SCANNING REGISTRY…</span></div>
              ) : players.length === 0 ? (
                <div style={s.empty}>
                  <span style={s.emptyT}>REGISTRY EMPTY</span>
                  <span style={s.emptyH}>Be the first to join. Click ＋ JOIN above.</span>
                </div>
              ) : (<>
                {/* Column headers */}
                <div style={s.colHead}>
                  <span style={{ ...s.colLbl, flex: 1 }}>PLAYER</span>
                  <span style={{ ...s.colLbl, width: 80, textAlign: 'right' }}>TOP CHAR</span>
                  <span style={{ ...s.colLbl, width: 52, textAlign: 'right' }}>WR</span>
                  <span style={{ ...s.colLbl, width: 48, textAlign: 'right' }}>KDA</span>
                  <span style={{ ...s.colLbl, width: 52, textAlign: 'right' }}>LAST ON</span>
                </div>
                <div style={s.divider} />
                <div style={s.table}>
                  {players.map(p => {
                    const main = p.mainCharacters?.[0]
                    const st   = main && p.stats?.[main]
                    const isNew = p.id === newId
                    return (
                      <div key={p.id} style={{ ...s.row, ...(isNew ? s.rowNew : {}) }}>
                        <HeroPortrait name={main ?? ''} size={36} />
                        <div style={s.rowMid}>
                          <span style={s.rowName}>{p.username}</span>
                          <div style={s.rowMeta}>
                            {p.rank   && <span style={s.metaTag}>{p.rank}</span>}
                            {p.region && <span style={s.metaTag}>{p.region}</span>}
                          </div>
                        </div>
                        <span style={{ ...s.rowCell, width: 80, color: '#6b6458', fontSize: 10 }}>
                          {p.mainCharacters?.slice(0, 2).join(', ') || '—'}
                        </span>
                        <span style={{ ...s.rowCell, width: 52, color: st ? A : '#3a3530' }}>
                          {st ? `${st.winRate.toFixed(0)}%` : '—'}
                        </span>
                        <span style={{ ...s.rowCell, width: 48, color: st ? T : '#3a3530' }}>
                          {st ? st.kda.toFixed(2) : '—'}
                        </span>
                        <span style={{ ...s.rowCell, width: 52, color: '#4a4438', fontSize: 9, fontFamily: MONO }}>
                          {timeAgo(p.lastActive)}
                        </span>
                      </div>
                    )
                  })}
                </div>
                <div style={s.rowCount}>{players.length} PLAYER{players.length !== 1 ? 'S' : ''} REGISTERED</div>
              </>)}
            </>
          )}

          {/* ── Join form ────────────────────────────────────────────────────── */}
          {view === 'join' && (
            <form onSubmit={join} style={s.form}>

              <section style={s.section}>
                <p style={s.sectionLbl}>YOUR IDENTITY</p>
                <div style={s.field}>
                  <span style={s.fieldLbl}>MARVEL RIVALS USERNAME</span>
                  <input ref={usernameRef} style={s.input}
                    value={username} onChange={e => setUsername(e.target.value)}
                    placeholder="e.g. IronCore99" autoComplete="off" spellCheck={false} />
                  <div style={s.inputLine} />
                </div>
                <div style={s.fieldRow}>
                  <div style={s.field}>
                    <span style={s.fieldLbl}>RANK</span>
                    <select style={s.select} value={rank} onChange={e => setRank(e.target.value)}>
                      <option value="">—</option>
                      {RANKS.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                    <div style={s.inputLine} />
                  </div>
                  <div style={s.field}>
                    <span style={s.fieldLbl}>REGION</span>
                    <select style={s.select} value={region} onChange={e => setRegion(e.target.value)}>
                      <option value="">—</option>
                      {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                    <div style={s.inputLine} />
                  </div>
                </div>
              </section>

              <div style={s.divider} />

              <section style={s.section}>
                <p style={s.sectionLbl}>CHARACTERS YOU PLAY</p>
                <div style={s.rolePills}>
                  {['all','vanguard','duelist','strategist'].map(r => (
                    <button key={r} type="button"
                      style={{ ...s.pill, ...(roleFilter === r ? s.pillOn : {}) }}
                      onClick={() => setFilter(r)}>
                      {r === 'all' ? 'ALL' : r.slice(0,2).toUpperCase()}
                    </button>
                  ))}
                </div>
                {selected.length > 0 && (
                  <div style={s.chips}>
                    {selected.map(name => (
                      <span key={name} style={s.chip}>
                        {name}
                        <button type="button" style={s.chipX} onClick={() => toggle(name)}>×</button>
                      </span>
                    ))}
                  </div>
                )}
                <div style={s.charGrid}>
                  {visibleChars.map(c => {
                    const on  = selected.includes(c.name)
                    const col = ROLE_COLOR[c.role] ?? '#888'
                    return (
                      <button key={c.id} type="button"
                        style={{ ...s.charCard, ...(on ? { borderColor: col, background: `${col}14` } : {}) }}
                        onClick={() => toggle(c.name)}>
                        <CharPortrait id={c.id} name={c.name} role={c.role} size={52} />
                        <span style={{ ...s.charName, ...(on ? { color: col } : {}) }}>{c.name}</span>
                        {on && <span style={{ ...s.charCheck, color: col }}>✓</span>}
                      </button>
                    )
                  })}
                </div>
              </section>

              {joinErr && <p style={s.error}>{joinErr}</p>}

              <button type="submit" style={s.submitBtn} disabled={joining}>
                {joining ? '— REGISTERING...' : 'JOIN REGISTRY ──────────────────→'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Design tokens ─────────────────────────────────────────────────────────────
const SANS = "'Space Grotesk', system-ui, sans-serif"
const MONO = "'Space Mono', monospace"
const A    = '#c8952a'
const T    = '#ede8df'
const TD   = '#6b6458'
const TDD  = '#302c26'
const BDR  = 'rgba(255,255,255,0.07)'

// ── Styles ────────────────────────────────────────────────────────────────────
const s = {
  backdrop: {
    position: 'fixed', inset: 0, zIndex: 100,
    display: 'flex', justifyContent: 'flex-end',
    animation: 'rivalsFadeIn 0.22s ease',
  },
  panel: {
    width: '100%', maxWidth: 600, height: '100dvh',
    background: 'linear-gradient(to right, rgba(4,3,10,0) 0%, rgba(4,3,10,0.78) 52px, rgba(4,3,10,0.92) 100%)',
    backdropFilter: 'blur(6px) saturate(1.4)',
    WebkitBackdropFilter: 'blur(6px) saturate(1.4)',
    display: 'flex', flexDirection: 'column',
    fontFamily: SANS, color: T,
    animation: 'rivalsPanelIn 0.38s cubic-bezier(0.16,1,0.3,1)',
  },

  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '18px 22px 14px', flexShrink: 0,
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 10 },
  dot:        { width: 6, height: 6, borderRadius: '50%', background: A, boxShadow: `0 0 10px ${A}`, flexShrink: 0 },
  title:      { fontSize: 12, fontWeight: 700, letterSpacing: '0.22em', color: A },
  subtitle:   { fontSize: 9, fontWeight: 500, letterSpacing: '0.14em', color: TD },

  joinBtn: {
    background: `${A}18`, border: `1px solid ${A}55`, color: A,
    fontSize: 9, fontWeight: 700, letterSpacing: '0.14em',
    padding: '6px 12px', cursor: 'pointer', fontFamily: SANS,
    transition: 'background 0.15s',
  },
  cancelBtn: {
    background: 'none', border: `1px solid ${BDR}`, color: TD,
    fontSize: 9, fontWeight: 700, letterSpacing: '0.12em',
    padding: '6px 12px', cursor: 'pointer', fontFamily: SANS,
  },
  escBtn: {
    background: 'none', border: `1px solid ${BDR}`, color: TDD,
    fontSize: 9, fontWeight: 700, letterSpacing: '0.14em',
    padding: '6px 10px', cursor: 'pointer', fontFamily: SANS,
  },

  rule: { height: 1, flexShrink: 0, background: `linear-gradient(90deg, ${A}55 0%, ${A}18 40%, transparent 80%)` },
  body: { flex: 1, overflowY: 'auto', padding: '0 0 52px' },

  // Registry
  colHead: { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 22px 6px' },
  colLbl:  { fontSize: 7, fontWeight: 700, letterSpacing: '0.2em', color: TDD },
  divider: { height: 1, background: BDR, margin: '0 22px' },
  table:   { display: 'flex', flexDirection: 'column' },
  row: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '10px 22px', borderBottom: `1px solid ${BDR}`,
    transition: 'background 0.15s',
  },
  rowNew: { background: `${A}08`, borderLeft: `2px solid ${A}` },
  rowMid: { flex: 1, display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 },
  rowName: { fontSize: 13, fontWeight: 600, color: T, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  rowMeta: { display: 'flex', gap: 4, flexWrap: 'wrap' },
  metaTag: { fontSize: 7, fontWeight: 700, color: TDD, border: `1px solid ${BDR}`, padding: '1px 5px', letterSpacing: '0.06em' },
  rowCell: { flexShrink: 0, fontSize: 11, fontWeight: 600, textAlign: 'right', fontFamily: MONO },
  rowCount: { fontSize: 7, color: TDD, letterSpacing: '0.16em', textAlign: 'center', padding: '16px 0 0' },

  empty:  { display: 'flex', flexDirection: 'column', gap: 8, padding: '48px 22px' },
  emptyT: { fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', color: TD },
  emptyH: { fontSize: 11, color: TDD, lineHeight: 1.8 },

  // Join form
  form:       { display: 'flex', flexDirection: 'column', gap: 22, padding: '20px 22px' },
  section:    { display: 'flex', flexDirection: 'column', gap: 14 },
  sectionLbl: { fontSize: 9, fontWeight: 700, letterSpacing: '0.22em', color: TD, margin: 0 },
  field:      { display: 'flex', flexDirection: 'column', gap: 5, flex: 1 },
  fieldLbl:   { fontSize: 8, fontWeight: 700, letterSpacing: '0.2em', color: TDD },
  fieldRow:   { display: 'flex', gap: 18 },
  input: {
    background: 'transparent', border: 'none', outline: 'none',
    color: T, fontSize: 18, fontWeight: 500, fontFamily: SANS,
    padding: '3px 0', caretColor: A, width: '100%',
  },
  select: {
    background: 'transparent', border: 'none', outline: 'none',
    color: T, fontSize: 14, fontWeight: 500, fontFamily: SANS,
    padding: '3px 0', cursor: 'pointer', appearance: 'none', width: '100%',
  },
  inputLine: { height: 1, background: BDR },

  rolePills: { display: 'flex', gap: 5 },
  pill: {
    background: 'none', border: `1px solid ${BDR}`, color: TD,
    fontSize: 8, fontWeight: 700, letterSpacing: '0.16em',
    padding: '5px 12px', cursor: 'pointer', fontFamily: SANS,
  },
  pillOn: { borderColor: A, color: A },

  chips: { display: 'flex', flexWrap: 'wrap', gap: 5 },
  chip: {
    display: 'inline-flex', alignItems: 'center', gap: 5,
    border: `1px solid ${A}`, color: A, fontSize: 10, fontWeight: 600, padding: '3px 8px',
  },
  chipX: {
    background: 'none', border: 'none', cursor: 'pointer',
    color: `${A}88`, fontSize: 14, padding: 0, lineHeight: 1, fontFamily: SANS,
  },

  charGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(88px, 1fr))',
    gap: 4,
  },
  charCard: {
    background: 'rgba(255,255,255,0.02)', border: `1px solid ${BDR}`,
    cursor: 'pointer', fontFamily: SANS,
    display: 'flex', flexDirection: 'column', alignItems: 'stretch',
    padding: 0, overflow: 'hidden', position: 'relative',
    transition: 'border-color 0.12s, background 0.12s',
  },
  charName: {
    fontSize: 9, fontWeight: 700, color: TD, letterSpacing: '0.02em',
    padding: '5px 5px 6px', textAlign: 'center', lineHeight: 1.25,
  },
  charCheck: { position: 'absolute', top: 4, right: 5, fontSize: 10, fontWeight: 700 },

  error:     { color: '#e84848', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', margin: 0 },
  submitBtn: {
    background: 'none', border: `1px solid ${A}`, color: A,
    fontSize: 9, fontWeight: 700, letterSpacing: '0.1em',
    padding: '14px 18px', cursor: 'pointer', fontFamily: SANS,
    textAlign: 'left', transition: 'background 0.15s',
  },
}
