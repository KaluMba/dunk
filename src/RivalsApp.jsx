import { useState, useEffect, useRef } from 'react'

// Auto-prefix https:// if env var was set without a protocol
const _raw = import.meta.env.VITE_RIVALS_API ?? ''
const API  = _raw ? (_raw.startsWith('http') ? _raw : `https://${_raw}`) : 'http://localhost:8080'

const RANKS   = ['Bronze','Silver','Gold','Platinum','Diamond','Celestial','One Above All']
const REGIONS = ['NA-East','NA-West','EU','Asia','SA','OCE']
const FREE_REVEALS = 3

const ROLE_COLOR = { vanguard:'#5b8fe8', duelist:'#e05858', strategist:'#52c47a' }
const ROLE_LABEL = { vanguard:'VG', duelist:'DL', strategist:'ST' }

function timeAgo(iso) {
  const d = (Date.now() - new Date(iso)) / 1000
  if (d < 3600)  return `${Math.floor(d / 60)}m ago`
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`
  return `${Math.floor(d / 86400)}d ago`
}

// ── Character portrait — tries CDN image, falls back to initials ──────────────
function Portrait({ id, name, role, size = 48 }) {
  const [failed, setFailed] = useState(false)
  const col = ROLE_COLOR[role] ?? '#888'
  const initials = name.split(/[\s\-&]+/).map(w => w[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div style={{ width: size, height: size, flexShrink: 0, overflow: 'hidden', position: 'relative' }}>
      {!failed ? (
        <img
          src={`https://marvelrivalsapi.com/rivals/heroes/${id}/portrait.png`}
          alt={name}
          onError={() => setFailed(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top', display: 'block' }}
        />
      ) : (
        <div style={{
          width: '100%', height: '100%',
          background: `linear-gradient(135deg, ${col}28 0%, ${col}10 100%)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: MONO, fontSize: size * 0.27, fontWeight: 700, color: col,
          letterSpacing: '0.05em',
        }}>
          {initials}
        </div>
      )}
      {/* role tag overlay */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        background: `${col}22`, borderTop: `1px solid ${col}30`,
        fontSize: size * 0.17, fontWeight: 700, letterSpacing: '0.1em',
        color: col, textAlign: 'center', padding: '1px 0',
        fontFamily: MONO,
      }}>
        {ROLE_LABEL[role]}
      </div>
    </div>
  )
}

// ── Input with underline (Apple-style) ────────────────────────────────────────
function FieldInput({ label, inputRef, value, onChange, placeholder }) {
  const [focused, setFocused] = useState(false)
  return (
    <div style={s.field}>
      <span style={s.fieldLbl}>{label}</span>
      <input
        ref={inputRef}
        style={s.input}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
      <div style={{ ...s.inputLine, ...(focused ? s.inputLineFocused : {}) }} />
    </div>
  )
}

function FieldSelect({ label, value, onChange, options }) {
  const [focused, setFocused] = useState(false)
  return (
    <div style={s.field}>
      <span style={s.fieldLbl}>{label}</span>
      <select
        style={s.select}
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      >
        <option value="">Any</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
      <div style={{ ...s.inputLine, ...(focused ? s.inputLineFocused : {}) }} />
    </div>
  )
}

// ── Stat block ────────────────────────────────────────────────────────────────
function Stat({ label, value }) {
  return (
    <div style={s.stat}>
      <span style={s.statVal}>{value}</span>
      <span style={s.statLbl}>{label}</span>
    </div>
  )
}

// ── Player card ───────────────────────────────────────────────────────────────
function PlayerCard({ result, searchedChars, revealedNames, revealsLeft, onReveal }) {
  const { profile, matchScore } = result
  const revealed  = revealedNames[profile.id]
  const [busy, setBusy]     = useState(false)
  const [copied, setCopied] = useState(false)

  const sortedMains = [...(profile.mainCharacters || [])].sort((a, b) => {
    const am = searchedChars.includes(a), bm = searchedChars.includes(b)
    return am === bm ? 0 : am ? -1 : 1
  })
  const matched = sortedMains.filter(n => searchedChars.includes(n))

  async function doReveal() {
    if (busy || revealsLeft <= 0) return
    setBusy(true)
    try {
      const r = await fetch(`${API}/api/reveal/${profile.id}`, { method: 'POST' })
      const d = await r.json()
      onReveal(profile.id, d.username)
    } finally { setBusy(false) }
  }

  async function copyName() {
    if (!revealed) return
    await navigator.clipboard.writeText(revealed)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={s.card}>
      <div style={{ ...s.cardAccent, opacity: matchScore > 1 ? 1 : 0.35 }} />

      <div style={s.cardTop}>
        {/* Identity + mains */}
        <div style={s.cardMain}>
          <div style={s.identity}>
            {revealed
              ? <span style={s.nameRevealed}>{revealed}</span>
              : <span style={s.nameAnon}>
                  <span style={s.anonGlyph}>◈</span>
                  <span style={s.anonBlocks}>{'▓'.repeat(8)}</span>
                </span>
            }
            <span style={s.cardId}>{profile.id}</span>
          </div>

          <div style={s.mainsRow}>
            {sortedMains.map(n => (
              <span key={n} style={{ ...s.mainChip, ...(searchedChars.includes(n) ? s.mainChipOn : s.mainChipOff) }}>{n}</span>
            ))}
          </div>

          <div style={s.metaRow}>
            {profile.rank   && <span style={s.metaTag}>{profile.rank}</span>}
            {profile.region && <span style={s.metaTag}>{profile.region}</span>}
            <span style={s.metaDim}>{timeAgo(profile.lastActive)}</span>
          </div>
        </div>

        {/* Match score */}
        <div style={s.matchBadge}>
          <span style={s.matchNum}>{matchScore}</span>
          <span style={s.matchWord}>MATCH{matchScore !== 1 ? 'ES' : ''}</span>
        </div>
      </div>

      {/* Stats for matched heroes */}
      {matched.length > 0 && (
        <div style={s.statsWrap}>
          {matched.map(n => {
            const cs = profile.stats?.[n]
            if (!cs) return null
            return (
              <div key={n} style={s.statRow}>
                <span style={s.statHero}>{n}</span>
                <div style={s.statCols}>
                  <Stat label="KDA"  value={cs.kda.toFixed(2)} />
                  <Stat label="WR"   value={`${cs.winRate.toFixed(1)}%`} />
                  <Stat label="TIME" value={`${cs.playtimeHours.toFixed(1)}h`} />
                  <Stat label="GP"   value={cs.games} />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Actions */}
      <div style={s.cardActions}>
        {revealed ? (
          <>
            <button style={{ ...s.btn, borderColor: '#52c47a44', color: '#52c47a' }} onClick={copyName}>
              {copied ? '✓ COPIED' : 'COPY USERNAME'}
            </button>
            <span style={s.copyHint}>Social → Add Friend in Marvel Rivals</span>
          </>
        ) : (
          <>
            <button
              style={{ ...s.btn, ...(revealsLeft <= 0 ? s.btnDim : {}) }}
              onClick={doReveal}
              disabled={busy || revealsLeft <= 0}
            >
              {busy ? 'SCANNING...' : revealsLeft > 0 ? '◈ REVEAL IDENTITY' : 'NO REVEALS LEFT'}
            </button>
            {revealsLeft <= 0 && (
              <button
                style={{ ...s.btn, borderColor: `${A}55`, color: A }}
                onClick={() => alert('Pro tier coming soon — unlimited reveals.')}
              >
                ✦ GO PRO
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ── Main overlay ──────────────────────────────────────────────────────────────
export default function RivalsOverlay({ onClose }) {
  const [chars, setChars]           = useState([])
  const [step, setStep]             = useState('form')
  const [username, setUsername]     = useState('')
  const [rank, setRank]             = useState('')
  const [region, setRegion]         = useState('')
  const [selected, setSelected]     = useState([])
  const [roleFilter, setRoleFilter] = useState('all')
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState('')
  const [myProfile, setMyProfile]   = useState(null)
  const [results, setResults]       = useState([])
  const [revealed, setRevealed]     = useState({})
  const [revealsLeft, setRevLeft]   = useState(FREE_REVEALS)
  const inputRef = useRef()

  useEffect(() => {
    fetch(`${API}/api/characters`).then(r => r.json()).then(setChars).catch(() => {})
    setTimeout(() => inputRef.current?.focus(), 150)
  }, [])

  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  function toggle(name) {
    setSelected(p => p.includes(name) ? p.filter(c => c !== name) : [...p, name])
  }

  async function submit(e) {
    e.preventDefault()
    if (!username.trim()) return setError('Username required')
    if (!selected.length) return setError('Select at least one character')
    setError(''); setLoading(true)
    try {
      const rr = await fetch(`${API}/api/register`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), rank, region }),
      })
      const rd = await rr.json()
      if (!rr.ok) throw new Error(rd.error || 'Registration failed')
      setMyProfile(rd)

      const params = new URLSearchParams({ characters: selected.join(','), exclude: rd.playerId })
      const sr = await fetch(`${API}/api/search?${params}`)
      setResults((await sr.json()) ?? [])
      setStep('results')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function onReveal(id, name) {
    setRevealed(p => ({ ...p, [id]: name }))
    setRevLeft(p => p - 1)
  }

  const visible = roleFilter === 'all' ? chars : chars.filter(c => c.role === roleFilter)

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
          <button style={s.esc} onClick={onClose}>ESC</button>
        </div>
        <div style={s.rule} />

        {/* Scrollable body */}
        <div style={s.body} className="rivals-scroll">

          {step === 'form' && (
            <form onSubmit={submit} style={s.form}>

              <section style={s.section}>
                <p style={s.sectionLbl}>IDENTIFY</p>
                <FieldInput label="MARVEL RIVALS USERNAME" inputRef={inputRef}
                  value={username} onChange={setUsername} placeholder="e.g. IronCore99" />
                <div style={s.row}>
                  <FieldSelect label="RANK"   value={rank}   onChange={setRank}   options={RANKS} />
                  <FieldSelect label="REGION" value={region} onChange={setRegion} options={REGIONS} />
                </div>
                <p style={s.note}>Stats are fetched live from the Marvel Rivals API and stored anonymously.</p>
              </section>

              <div style={s.divider} />

              <section style={s.section}>
                <p style={s.sectionLbl}>FIND TEAMMATES WHO PLAY</p>

                <div style={s.rolePills}>
                  {['all','vanguard','duelist','strategist'].map(r => (
                    <button key={r} type="button"
                      style={{ ...s.pill, ...(roleFilter === r ? s.pillOn : {}) }}
                      onClick={() => setRoleFilter(r)}
                    >
                      {r === 'all' ? 'ALL' : r.slice(0,2).toUpperCase()}
                    </button>
                  ))}
                </div>

                {selected.length > 0 && (
                  <div style={s.chips}>
                    {selected.map((name, i) => (
                      <span key={name} style={s.chip}>
                        <span style={s.chipIdx}>{i + 1}</span>
                        {name}
                        <button type="button" style={s.chipX} onClick={() => toggle(name)}>×</button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Character portrait grid */}
                <div style={s.charGrid}>
                  {visible.map(c => {
                    const on  = selected.includes(c.name)
                    const col = ROLE_COLOR[c.role] ?? '#888'
                    return (
                      <button key={c.id} type="button"
                        style={{ ...s.charCard, ...(on ? { borderColor: col, background: `${col}14` } : {}) }}
                        onClick={() => toggle(c.name)}
                      >
                        <Portrait id={c.id} name={c.name} role={c.role} size={52} />
                        <span style={{ ...s.charName, ...(on ? { color: col } : {}) }}>{c.name}</span>
                        {on && <span style={{ ...s.charCheck, color: col }}>✓</span>}
                      </button>
                    )
                  })}
                </div>
              </section>

              {error && <p style={s.error}>{error}</p>}

              <button type="submit" style={s.submitBtn} disabled={loading}>
                {loading ? '— SCANNING REGISTRY...' : 'SEARCH REGISTRY ──────────────────→'}
              </button>
            </form>
          )}

          {step === 'results' && (
            <div style={s.results}>
              {myProfile && (
                <div style={s.myCard}>
                  <div style={s.myTop}>
                    <span style={s.myLbl}>● REGISTERED</span>
                    <span style={s.myId}>{myProfile.playerId}</span>
                  </div>
                  {myProfile.mainCharacters?.length > 0 && (
                    <div style={s.myMains}>
                      {myProfile.mainCharacters.map(n => {
                        const cs = myProfile.stats?.[n]
                        return (
                          <span key={n} style={s.myMain}>
                            {n}
                            {cs && <span style={s.myMainStat}>{cs.kda.toFixed(2)} KDA · {cs.winRate.toFixed(1)}% WR</span>}
                          </span>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              <div style={s.resultsHead}>
                <button style={s.backBtn} onClick={() => setStep('form')}>← NEW SEARCH</button>
                <div style={s.resultsRight}>
                  {revealsLeft > 0 && <span style={s.revLeft}>{revealsLeft} REVEAL{revealsLeft !== 1 ? 'S' : ''} LEFT</span>}
                  <span style={s.resultCt}>{results.length} PLAYER{results.length !== 1 ? 'S' : ''} FOUND</span>
                </div>
              </div>

              <div style={s.divider} />

              {results.length === 0
                ? <div style={s.empty}>
                    <p style={s.emptyT}>NO MATCHES YET</p>
                    <p style={s.emptyH}>You're in the registry. As more players join, matches appear here.</p>
                  </div>
                : <div style={s.cards}>
                    {results.map(r => (
                      <PlayerCard key={r.profile.id} result={r}
                        searchedChars={selected} revealedNames={revealed}
                        revealsLeft={revealsLeft} onReveal={onReveal} />
                    ))}
                  </div>
              }
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Tokens ────────────────────────────────────────────────────────────────────
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
    // Glass: transparent on left edge → readable dark on right
    background: 'linear-gradient(to right, rgba(4,3,10,0) 0%, rgba(4,3,10,0.68) 52px, rgba(4,3,10,0.78) 100%)',
    backdropFilter: 'blur(32px) saturate(1.7)',
    WebkitBackdropFilter: 'blur(32px) saturate(1.7)',
    display: 'flex', flexDirection: 'column',
    fontFamily: SANS, color: T,
    animation: 'rivalsPanelIn 0.38s cubic-bezier(0.16,1,0.3,1)',
  },

  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '20px 24px 16px', flexShrink: 0,
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 10 },
  dot:   { width: 6, height: 6, borderRadius: '50%', background: A, boxShadow: `0 0 10px ${A}`, flexShrink: 0 },
  title: { fontSize: 12, fontWeight: 700, letterSpacing: '0.22em', color: A },
  subtitle: { fontSize: 9, fontWeight: 500, letterSpacing: '0.14em', color: TD },
  esc: {
    background: 'none', border: `1px solid ${BDR}`, color: TD,
    fontSize: 9, fontWeight: 700, letterSpacing: '0.14em',
    padding: '5px 10px', cursor: 'pointer', fontFamily: SANS,
  },
  rule: { height: 1, flexShrink: 0, background: `linear-gradient(90deg, ${A}55 0%, ${A}18 40%, transparent 80%)` },
  body: { flex: 1, overflowY: 'auto', padding: '24px 24px 52px' },

  form: { display: 'flex', flexDirection: 'column', gap: 24 },
  section: { display: 'flex', flexDirection: 'column', gap: 16 },
  sectionLbl: { fontSize: 9, fontWeight: 700, letterSpacing: '0.22em', color: TD, margin: 0 },
  divider: { height: 1, background: BDR, flexShrink: 0 },

  // Fields
  field: { display: 'flex', flexDirection: 'column', gap: 6, flex: 1 },
  fieldLbl: { fontSize: 8, fontWeight: 700, letterSpacing: '0.2em', color: TDD },
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
  inputLine:        { height: 1, background: BDR, transition: 'background 0.2s, box-shadow 0.2s' },
  inputLineFocused: { background: A, boxShadow: `0 0 8px ${A}55` },
  row:  { display: 'flex', gap: 20 },
  note: { fontSize: 10, color: TDD, margin: 0, lineHeight: 1.7, fontWeight: 400 },

  // Role pills
  rolePills: { display: 'flex', gap: 5 },
  pill: {
    background: 'none', border: `1px solid ${BDR}`, color: TD,
    fontSize: 8, fontWeight: 700, letterSpacing: '0.16em',
    padding: '5px 12px', cursor: 'pointer', fontFamily: SANS,
    transition: 'border-color 0.12s, color 0.12s',
  },
  pillOn: { borderColor: A, color: A },

  // Selected chips
  chips: { display: 'flex', flexWrap: 'wrap', gap: 5 },
  chip: {
    display: 'inline-flex', alignItems: 'center', gap: 5,
    border: `1px solid ${A}`, color: A, fontSize: 10, fontWeight: 600, padding: '4px 8px',
  },
  chipIdx: { fontSize: 8, color: `${A}88` },
  chipX: {
    background: 'none', border: 'none', cursor: 'pointer',
    color: `${A}88`, fontSize: 14, padding: 0, lineHeight: 1, marginLeft: 1, fontFamily: SANS,
  },

  // Character grid with portraits
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
  charCheck: {
    position: 'absolute', top: 4, right: 5,
    fontSize: 10, fontWeight: 700,
  },

  // Submit
  error: { color: '#e84848', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', margin: 0 },
  submitBtn: {
    background: 'none', border: `1px solid ${A}`, color: A,
    fontSize: 9, fontWeight: 700, letterSpacing: '0.1em',
    padding: '14px 18px', cursor: 'pointer', fontFamily: SANS,
    textAlign: 'left', transition: 'background 0.15s', marginTop: 4,
  },

  // Results
  results: { display: 'flex', flexDirection: 'column', gap: 14 },
  myCard: {
    borderLeft: `2px solid ${A}`, border: `1px solid rgba(200,149,42,0.18)`,
    padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 7,
  },
  myTop: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  myLbl: { fontSize: 8, fontWeight: 700, letterSpacing: '0.2em', color: A },
  myId:  { fontSize: 9, color: TD, fontFamily: MONO, letterSpacing: '0.05em' },
  myMains: { display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  myMain: { fontSize: 12, fontWeight: 600, color: T, display: 'flex', gap: 7, alignItems: 'center' },
  myMainStat: { fontSize: 10, color: TD },

  resultsHead:  { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  backBtn: {
    background: 'none', border: `1px solid ${BDR}`, color: TD,
    fontSize: 8, fontWeight: 700, letterSpacing: '0.14em',
    padding: '6px 11px', cursor: 'pointer', fontFamily: SANS,
  },
  resultsRight: { display: 'flex', alignItems: 'center', gap: 14 },
  revLeft:  { fontSize: 8, fontWeight: 700, letterSpacing: '0.14em', color: A },
  resultCt: { fontSize: 8, fontWeight: 600, letterSpacing: '0.1em', color: TD },

  // Cards
  cards: { display: 'flex', flexDirection: 'column', gap: 5 },
  card: {
    border: `1px solid ${BDR}`, padding: '12px 14px 12px 18px',
    display: 'flex', flexDirection: 'column', gap: 9, position: 'relative',
  },
  cardAccent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 2, background: A },
  cardTop:  { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  cardMain: { display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 },
  identity: { display: 'flex', flexDirection: 'column', gap: 2 },
  nameRevealed: { fontSize: 16, fontWeight: 700, color: T },
  nameAnon:  { display: 'flex', alignItems: 'center', gap: 6 },
  anonGlyph: { color: TDD, fontSize: 11 },
  anonBlocks:{ color: TDD, fontSize: 13, fontWeight: 700, letterSpacing: '0.04em', userSelect: 'none' },
  cardId:    { fontSize: 8, color: TDD, fontFamily: MONO, letterSpacing: '0.06em' },

  mainsRow: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  mainChip:    { fontSize: 10, fontWeight: 600, letterSpacing: '0.02em' },
  mainChipOn:  { color: T },
  mainChipOff: { color: TDD },

  metaRow: { display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' },
  metaTag: { fontSize: 8, fontWeight: 600, color: TD, border: `1px solid ${BDR}`, padding: '2px 6px', letterSpacing: '0.06em' },
  metaDim: { fontSize: 8, color: TDD, letterSpacing: '0.04em', fontFamily: MONO },

  matchBadge: { flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end' },
  matchNum:   { fontSize: 22, fontWeight: 700, color: A, lineHeight: 1, fontFamily: SANS },
  matchWord:  { fontSize: 6, fontWeight: 700, letterSpacing: '0.16em', color: TD },

  statsWrap: { display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 4, borderTop: `1px solid ${BDR}` },
  statRow:   { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  statHero:  { fontSize: 8, fontWeight: 700, letterSpacing: '0.1em', color: TD, minWidth: 80, textTransform: 'uppercase' },
  statCols:  { display: 'flex', gap: 16 },
  stat:      { display: 'flex', flexDirection: 'column', gap: 0 },
  statVal:   { fontSize: 13, fontWeight: 700, color: T, lineHeight: 1.1, fontFamily: SANS },
  statLbl:   { fontSize: 6, fontWeight: 700, letterSpacing: '0.14em', color: TDD, textTransform: 'uppercase', fontFamily: MONO },

  cardActions: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
  btn: {
    background: 'none', border: `1px solid ${BDR}`, color: TD,
    fontSize: 8, fontWeight: 700, letterSpacing: '0.16em',
    padding: '8px 14px', cursor: 'pointer', fontFamily: SANS,
    transition: 'border-color 0.15s, color 0.15s',
  },
  btnDim:   { color: TDD, cursor: 'not-allowed' },
  copyHint: { fontSize: 8, color: TDD, letterSpacing: '0.03em', fontFamily: MONO },

  empty: { display: 'flex', flexDirection: 'column', gap: 8, padding: '36px 0' },
  emptyT: { fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', color: TD, margin: 0 },
  emptyH: { fontSize: 11, color: TDD, margin: 0, lineHeight: 1.8 },
}
