import { useState, useEffect, useRef } from 'react'

// Auto-prefix with https:// if the env var was set without a protocol
const _rawApi = import.meta.env.VITE_RIVALS_API ?? ''
const API = _rawApi
  ? (_rawApi.startsWith('http') ? _rawApi : `https://${_rawApi}`)
  : 'http://localhost:8080'
const RANKS   = ['Bronze','Silver','Gold','Platinum','Diamond','Celestial','One Above All']
const REGIONS = ['NA-East','NA-West','EU','Asia','SA','OCE']
const FREE_REVEALS = 3

const ROLE_COLOR = {
  vanguard:   '#5b8fe8',
  duelist:    '#e05858',
  strategist: '#52c47a',
}

function timeAgo(iso) {
  const diff = (Date.now() - new Date(iso)) / 1000
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

// ── Sub-components ────────────────────────────────────────────────────────────

function FieldInput({ label, inputRef, value, onChange, placeholder }) {
  return (
    <div style={s.fieldWrap} className="ds-input-wrap">
      <span style={s.fieldLabel}>{label}</span>
      <input
        ref={inputRef}
        className="ds-input"
        style={s.fieldInput}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
      />
      <div style={s.fieldLine} className="ds-line" />
    </div>
  )
}

function FieldSelect({ label, value, onChange, options }) {
  return (
    <div style={s.fieldWrap} className="ds-select-wrap">
      <span style={s.fieldLabel}>{label}</span>
      <select
        className="ds-select"
        style={s.fieldSelect}
        value={value}
        onChange={e => onChange(e.target.value)}
      >
        <option value="">Any</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
      <div style={s.fieldLine} className="ds-line" />
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div style={s.stat}>
      <span style={s.statVal}>{value}</span>
      <span style={s.statLbl}>{label}</span>
    </div>
  )
}

function PlayerCard({ result, searchedChars, revealedNames, revealsLeft, onReveal }) {
  const { profile, matchScore } = result
  const revealed = revealedNames[profile.id]
  const [revealing, setRevealing] = useState(false)
  const [copied, setCopied] = useState(false)

  const sortedMains = [...(profile.mainCharacters || [])].sort((a, b) => {
    const am = searchedChars.includes(a), bm = searchedChars.includes(b)
    return am === bm ? 0 : am ? -1 : 1
  })

  async function handleReveal() {
    if (revealsLeft <= 0 || revealing) return
    setRevealing(true)
    try {
      const res = await fetch(`${API}/api/reveal/${profile.id}`, { method: 'POST' })
      const data = await res.json()
      onReveal(profile.id, data.username)
    } finally { setRevealing(false) }
  }

  async function copyName() {
    if (!revealed) return
    await navigator.clipboard.writeText(revealed)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const matchedMains = sortedMains.filter(n => searchedChars.includes(n))

  return (
    <div style={s.card}>
      {/* amber left accent on match */}
      <div style={{ ...s.cardAccent, opacity: matchScore > 1 ? 1 : 0.4 }} />

      <div style={s.cardTop}>
        <div style={s.cardLeft}>
          {/* Identity */}
          <div style={s.identity}>
            {revealed
              ? <span style={s.revealedName}>{revealed}</span>
              : <span style={s.anonRow}>
                  <span style={s.anonGlyph}>◈</span>
                  <span style={s.anonHash}>{'▓'.repeat(9)}</span>
                </span>
            }
          </div>
          <span style={s.cardIdStr}>{profile.id}</span>

          {/* Mains */}
          <div style={s.mainsRow}>
            {sortedMains.map(name => {
              const isMatch = searchedChars.includes(name)
              return (
                <span key={name} style={{ ...s.mainTag, ...(isMatch ? s.mainTagMatch : s.mainTagDim) }}>
                  {name}
                </span>
              )
            })}
          </div>

          {/* Meta */}
          <div style={s.cardMetaRow}>
            {profile.rank   && <span style={s.metaPill}>{profile.rank}</span>}
            {profile.region && <span style={s.metaPill}>{profile.region}</span>}
            <span style={s.metaDim}>{timeAgo(profile.lastActive)}</span>
          </div>
        </div>

        {/* Match score */}
        <div style={s.matchBadge}>
          <span style={s.matchNum}>{matchScore}</span>
          <span style={s.matchWord}>MATCH{matchScore !== 1 ? 'ES' : ''}</span>
        </div>
      </div>

      {/* Stats for matched characters */}
      {matchedMains.length > 0 && (
        <div style={s.statsSection}>
          {matchedMains.map(name => {
            const cs = profile.stats?.[name]
            if (!cs) return null
            return (
              <div key={name} style={s.statRow}>
                <span style={s.statCharName}>{name}</span>
                <div style={s.statBlocks}>
                  <Stat label="KDA"      value={cs.kda.toFixed(2)} />
                  <Stat label="WIN RATE" value={`${cs.winRate.toFixed(1)}%`} />
                  <Stat label="PLAYED"   value={`${cs.playtimeHours.toFixed(1)}h`} />
                  <Stat label="GAMES"    value={cs.games} />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Action */}
      <div style={s.cardActions}>
        {revealed ? (
          <>
            <button
              className="reveal-btn"
              style={{ ...s.actionBtn, borderColor: 'rgba(82,196,122,0.4)', color: '#52c47a' }}
              onClick={copyName}
            >
              {copied ? '✓  COPIED' : 'COPY USERNAME'}
            </button>
            <span style={s.copyHint}>Social → Add Friend in Marvel Rivals</span>
          </>
        ) : (
          <>
            <button
              className="reveal-btn"
              style={{ ...s.actionBtn, ...(revealsLeft <= 0 ? s.actionBtnOut : {}) }}
              onClick={handleReveal}
              disabled={revealing || revealsLeft <= 0}
            >
              {revealing ? 'SCANNING...' : revealsLeft > 0 ? '◈  REVEAL IDENTITY' : 'NO REVEALS LEFT'}
            </button>
            {revealsLeft <= 0 && (
              <button
                className="reveal-btn"
                style={{ ...s.actionBtn, borderColor: 'rgba(200,149,42,0.4)', color: '#c8952a' }}
                onClick={() => alert('Pro tier coming soon — unlimited reveals.')}
              >
                ✦  GO PRO
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
  const [characters, setCharacters]       = useState([])
  const [step, setStep]                   = useState('form')
  const [username, setUsername]           = useState('')
  const [rank, setRank]                   = useState('')
  const [region, setRegion]               = useState('')
  const [selected, setSelected]           = useState([])
  const [roleFilter, setRoleFilter]       = useState('all')
  const [loading, setLoading]             = useState(false)
  const [error, setError]                 = useState('')
  const [myProfile, setMyProfile]         = useState(null)
  const [results, setResults]             = useState([])
  const [revealedNames, setRevealedNames] = useState({})
  const [revealsLeft, setRevealsLeft]     = useState(FREE_REVEALS)
  const inputRef = useRef()

  useEffect(() => {
    fetch(`${API}/api/characters`)
      .then(r => r.json())
      .then(setCharacters)
      .catch(() => setError('Cannot reach backend'))
    setTimeout(() => inputRef.current?.focus(), 120)
  }, [])

  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  function toggleChar(name) {
    setSelected(prev => prev.includes(name) ? prev.filter(c => c !== name) : [...prev, name])
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!username.trim()) return setError('Username required')
    if (!selected.length) return setError('Select at least one character')
    setError('')
    setLoading(true)
    try {
      const regRes = await fetch(`${API}/api/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), rank, region }),
      })
      const regData = await regRes.json()
      if (!regRes.ok) throw new Error(regData.error || 'Registration failed')
      setMyProfile(regData)

      const params = new URLSearchParams({ characters: selected.join(','), exclude: regData.playerId })
      const searchRes = await fetch(`${API}/api/search?${params}`)
      const searchData = await searchRes.json()
      setResults(searchData ?? [])
      setStep('results')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function handleReveal(id, name) {
    setRevealedNames(prev => ({ ...prev, [id]: name }))
    setRevealsLeft(prev => prev - 1)
  }

  const visible = roleFilter === 'all'
    ? characters
    : characters.filter(c => c.role === roleFilter)

  return (
    <div style={s.backdrop} onClick={onClose}>
      <div style={s.panel} className="rivals-panel" onClick={e => e.stopPropagation()}>

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div style={s.header}>
          <div style={s.headerLeft}>
            <span style={s.amberDot} />
            <span style={s.headerTitle}>RIVALS</span>
            <span style={s.headerSub}>TEAMMATE REGISTRY</span>
          </div>
          <button style={s.escBtn} onClick={onClose}>ESC</button>
        </div>
        <div style={s.headerRule} />

        {/* ── Scrollable body ────────────────────────────────────────────── */}
        <div style={s.body} className="rivals-scroll">

          {step === 'form' && (
            <form onSubmit={handleSubmit} style={s.form}>

              {/* IDENTIFY */}
              <section style={s.section}>
                <span style={s.sectionLbl}>IDENTIFY</span>
                <FieldInput
                  label="MARVEL RIVALS USERNAME"
                  inputRef={inputRef}
                  value={username}
                  onChange={setUsername}
                  placeholder="e.g. IronCore99"
                />
                <div style={s.selectPair}>
                  <FieldSelect label="RANK"   value={rank}   onChange={setRank}   options={RANKS}   />
                  <FieldSelect label="REGION" value={region} onChange={setRegion} options={REGIONS} />
                </div>
                <p style={s.note}>
                  Stats are fetched live from the Marvel Rivals API and added to the anonymous registry.
                </p>
              </section>

              <div style={s.rule} />

              {/* FIND */}
              <section style={s.section}>
                <span style={s.sectionLbl}>FIND PLAYERS WHO MAIN</span>

                <div style={s.rolePills}>
                  {['all','vanguard','duelist','strategist'].map(r => (
                    <button key={r} type="button"
                      style={{ ...s.rolePill, ...(roleFilter === r ? s.rolePillOn : {}) }}
                      onClick={() => setRoleFilter(r)}
                    >
                      {r === 'all' ? 'ALL' : r.slice(0,2).toUpperCase()}
                    </button>
                  ))}
                </div>

                {selected.length > 0 && (
                  <div style={s.selectedRow}>
                    {selected.map((name, i) => (
                      <span key={name} style={s.selChip}>
                        <span style={s.selIdx}>{i + 1}</span>
                        {name}
                        <button type="button" style={s.selX} onClick={() => toggleChar(name)}>×</button>
                      </span>
                    ))}
                  </div>
                )}

                <div style={s.charGrid}>
                  {visible.map(c => {
                    const on  = selected.includes(c.name)
                    const col = ROLE_COLOR[c.role] ?? '#888'
                    return (
                      <button key={c.id} type="button"
                        className="char-btn"
                        style={{ ...s.charBtn, ...(on ? { borderColor: col, color: col } : {}) }}
                        onClick={() => toggleChar(c.name)}
                      >
                        {on && <span style={{ ...s.charDot, background: col }} />}
                        <span style={s.charName}>{c.name}</span>
                      </button>
                    )
                  })}
                </div>
              </section>

              {error && <p style={s.error}>{error}</p>}

              <button
                type="submit"
                className="submit-btn"
                style={s.submitBtn}
                disabled={loading}
              >
                {loading
                  ? '— SCANNING REGISTRY...'
                  : 'SEARCH REGISTRY ─────────────────────────────→'}
              </button>

            </form>
          )}

          {step === 'results' && (
            <div style={s.results}>

              {/* Your registration summary */}
              {myProfile && (
                <div style={s.myCard}>
                  <div style={s.myCardTop}>
                    <span style={s.myCardLbl}>● REGISTERED</span>
                    <span style={s.myCardId}>{myProfile.playerId}</span>
                  </div>
                  {myProfile.mainCharacters?.length > 0 && (
                    <div style={s.myMains}>
                      {myProfile.mainCharacters.map(name => {
                        const cs = myProfile.stats?.[name]
                        return (
                          <span key={name} style={s.myMain}>
                            {name}
                            {cs && (
                              <span style={s.myMainStat}>
                                {cs.kda.toFixed(2)} KDA · {cs.winRate.toFixed(1)}% WR
                              </span>
                            )}
                          </span>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Results header */}
              <div style={s.resultsTop}>
                <button style={s.backBtn} onClick={() => setStep('form')}>← NEW SEARCH</button>
                <div style={s.resultsRight}>
                  {revealsLeft > 0 && (
                    <span style={s.revealsLeft}>
                      {revealsLeft} REVEAL{revealsLeft !== 1 ? 'S' : ''} LEFT
                    </span>
                  )}
                  <span style={s.resultCount}>
                    {results.length} PLAYER{results.length !== 1 ? 'S' : ''} FOUND
                  </span>
                </div>
              </div>

              <div style={s.rule} />

              {results.length === 0 ? (
                <div style={s.empty}>
                  <span style={s.emptyTitle}>NO MATCHES YET</span>
                  <span style={s.emptyHint}>
                    You've been added to the registry. As more players register,
                    matches will appear here.
                  </span>
                </div>
              ) : (
                <div style={s.cards}>
                  {results.map(r => (
                    <PlayerCard
                      key={r.profile.id}
                      result={r}
                      searchedChars={selected}
                      revealedNames={revealedNames}
                      revealsLeft={revealsLeft}
                      onReveal={handleReveal}
                    />
                  ))}
                </div>
              )}

            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Design tokens ─────────────────────────────────────────────────────────────

const A  = '#c8952a'          // amber
const AD = 'rgba(200,149,42,0.14)'
const T  = '#ede8df'          // warm white
const TD = '#6b6458'          // dim
const TDD= '#302c26'          // very dim
const BDR= 'rgba(255,255,255,0.07)'

// ── Styles ────────────────────────────────────────────────────────────────────

const s = {
  // Full-screen backdrop — transparent so 3D scene shows everywhere
  backdrop: {
    position: 'fixed', inset: 0, zIndex: 100,
    display: 'flex', justifyContent: 'flex-end',
    animation: 'rivalsFadeIn 0.25s ease',
  },

  // Glass panel — slides in from right, transparent so scene bleeds through
  panel: {
    width: '100%', maxWidth: 580, height: '100dvh',
    // Gradient: transparent on left edge → dark glass on right
    background: 'linear-gradient(to right, rgba(4,3,10,0) 0%, rgba(4,3,10,0.72) 48px, rgba(4,3,10,0.82) 100%)',
    backdropFilter: 'blur(28px) saturate(1.6)',
    WebkitBackdropFilter: 'blur(28px) saturate(1.6)',
    display: 'flex', flexDirection: 'column',
    fontFamily: "'Syne', system-ui, sans-serif",
    color: T,
    // No hard left border — gradient handles the fade
    animation: 'rivalsPanelIn 0.38s cubic-bezier(0.16,1,0.3,1)',
  },

  // Header
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '22px 28px 18px', flexShrink: 0,
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 12 },
  amberDot: {
    width: 6, height: 6, borderRadius: '50%',
    background: A, boxShadow: `0 0 10px ${A}`,
    flexShrink: 0,
  },
  headerTitle: {
    fontSize: 12, fontWeight: 800, letterSpacing: '0.22em', color: A,
  },
  headerSub: {
    fontSize: 9, fontWeight: 700, letterSpacing: '0.14em',
    color: TD, textTransform: 'uppercase',
  },
  escBtn: {
    background: 'none', border: `1px solid ${BDR}`,
    color: TD, fontSize: 9, fontWeight: 800, letterSpacing: '0.14em',
    padding: '5px 11px', cursor: 'pointer', fontFamily: 'inherit',
    flexShrink: 0,
  },
  headerRule: {
    height: 1, flexShrink: 0,
    background: `linear-gradient(90deg, ${A}55 0%, ${A}18 40%, transparent 80%)`,
  },

  // Body
  body: {
    flex: 1, overflowY: 'auto', padding: '28px 28px 56px',
    display: 'flex', flexDirection: 'column',
  },

  // Form
  form: { display: 'flex', flexDirection: 'column', gap: 28 },
  section: { display: 'flex', flexDirection: 'column', gap: 18 },
  sectionLbl: {
    fontSize: 9, fontWeight: 800, letterSpacing: '0.22em',
    color: TD, textTransform: 'uppercase',
  },

  // Inputs
  fieldWrap: { display: 'flex', flexDirection: 'column', gap: 7 },
  fieldLabel: {
    fontSize: 8, fontWeight: 800, letterSpacing: '0.2em',
    color: TDD, textTransform: 'uppercase',
  },
  fieldInput: {
    background: 'transparent', border: 'none', outline: 'none',
    color: T, fontSize: 20, fontWeight: 600, fontFamily: 'inherit',
    padding: '4px 0', width: '100%', caretColor: A,
  },
  fieldLine: { height: 1, background: BDR, transition: 'background 0.2s, box-shadow 0.2s' },
  selectPair: { display: 'flex', gap: 24 },
  fieldSelect: {
    background: 'transparent', border: 'none', outline: 'none',
    color: T, fontSize: 15, fontWeight: 600, fontFamily: 'inherit',
    padding: '4px 0', width: '100%', cursor: 'pointer', appearance: 'none',
  },
  note: { fontSize: 10, color: TDD, lineHeight: 1.7, margin: 0 },
  rule: { height: 1, background: BDR, flexShrink: 0 },

  // Role pills
  rolePills: { display: 'flex', gap: 5 },
  rolePill: {
    background: 'none', border: `1px solid ${BDR}`,
    color: TD, fontSize: 8, fontWeight: 800, letterSpacing: '0.16em',
    padding: '5px 12px', cursor: 'pointer', fontFamily: 'inherit',
    transition: 'border-color 0.12s, color 0.12s',
  },
  rolePillOn: { borderColor: A, color: A },

  // Selected chips
  selectedRow: { display: 'flex', flexWrap: 'wrap', gap: 5 },
  selChip: {
    display: 'inline-flex', alignItems: 'center', gap: 5,
    border: `1px solid ${A}`, color: A,
    fontSize: 10, fontWeight: 700, padding: '4px 9px',
  },
  selIdx: { fontSize: 8, color: `${A}88`, marginRight: 2 },
  selX: {
    background: 'none', border: 'none', cursor: 'pointer',
    color: `${A}88`, fontSize: 14, padding: 0, lineHeight: 1,
    marginLeft: 2, fontFamily: 'inherit',
  },

  // Character grid
  charGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
    gap: 3,
  },
  charBtn: {
    background: 'transparent', border: `1px solid ${BDR}`,
    color: TD, fontSize: 11, fontWeight: 700,
    padding: '7px 10px', cursor: 'pointer', fontFamily: 'inherit',
    textAlign: 'left', display: 'flex', alignItems: 'center', gap: 6,
    transition: 'border-color 0.1s, color 0.1s',
  },
  charDot: { width: 5, height: 5, borderRadius: '50%', flexShrink: 0 },
  charName: { fontSize: 11 },

  // Error + submit
  error: { color: '#e84848', fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', margin: 0 },
  submitBtn: {
    background: 'none', border: `1px solid ${A}`,
    color: A, fontSize: 9, fontWeight: 800, letterSpacing: '0.1em',
    padding: '15px 20px', cursor: 'pointer', fontFamily: 'inherit',
    textAlign: 'left', transition: 'background 0.15s', marginTop: 8,
  },

  // Results
  results: { display: 'flex', flexDirection: 'column', gap: 16 },

  myCard: {
    borderLeft: `2px solid ${A}`, border: `1px solid ${AD}`,
    padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8,
  },
  myCardTop: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  myCardLbl: { fontSize: 8, fontWeight: 800, letterSpacing: '0.2em', color: A },
  myCardId:  { fontSize: 9, color: TD, fontFamily: 'monospace', letterSpacing: '0.05em' },
  myMains: { display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' },
  myMain: { fontSize: 12, fontWeight: 700, color: T, display: 'flex', gap: 8, alignItems: 'center' },
  myMainStat: { fontSize: 10, color: TD },

  resultsTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  backBtn: {
    background: 'none', border: `1px solid ${BDR}`,
    color: TD, fontSize: 8, fontWeight: 800, letterSpacing: '0.14em',
    padding: '6px 12px', cursor: 'pointer', fontFamily: 'inherit',
  },
  resultsRight: { display: 'flex', alignItems: 'center', gap: 16 },
  revealsLeft:  { fontSize: 8, fontWeight: 800, letterSpacing: '0.14em', color: A },
  resultCount:  { fontSize: 8, fontWeight: 700, letterSpacing: '0.12em', color: TD },

  // Cards
  cards: { display: 'flex', flexDirection: 'column', gap: 6 },
  card: {
    border: `1px solid ${BDR}`,
    padding: '14px 16px 14px 20px',
    display: 'flex', flexDirection: 'column', gap: 10,
    position: 'relative',
  },
  cardAccent: {
    position: 'absolute', left: 0, top: 0, bottom: 0,
    width: 2, background: A,
  },
  cardTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  cardLeft: { display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 },

  identity: {},
  revealedName: { fontSize: 16, fontWeight: 800, color: T },
  anonRow: { display: 'flex', alignItems: 'center', gap: 6 },
  anonGlyph: { color: TDD, fontSize: 11 },
  anonHash: { color: TDD, fontSize: 14, fontWeight: 800, letterSpacing: '0.05em', userSelect: 'none' },
  cardIdStr: { fontSize: 8, color: TDD, fontFamily: 'monospace', letterSpacing: '0.06em' },

  mainsRow: { display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' },
  mainTag:      { fontSize: 10, fontWeight: 700, letterSpacing: '0.04em' },
  mainTagMatch: { color: T },
  mainTagDim:   { color: TDD },

  cardMetaRow: { display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' },
  metaPill: {
    fontSize: 8, fontWeight: 700, letterSpacing: '0.1em',
    color: TD, border: `1px solid ${BDR}`, padding: '2px 7px',
  },
  metaDim: { fontSize: 8, color: TDD, letterSpacing: '0.04em' },

  matchBadge: {
    display: 'flex', flexDirection: 'column', alignItems: 'flex-end',
    flexShrink: 0,
  },
  matchNum:  { fontSize: 22, fontWeight: 800, color: A, lineHeight: 1 },
  matchWord: { fontSize: 6, fontWeight: 800, letterSpacing: '0.16em', color: TD },

  // Stats
  statsSection: {
    display: 'flex', flexDirection: 'column', gap: 8,
    paddingTop: 4, borderTop: `1px solid ${BDR}`,
  },
  statRow: { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  statCharName: {
    fontSize: 8, fontWeight: 800, letterSpacing: '0.12em',
    color: TD, minWidth: 84, textTransform: 'uppercase',
  },
  statBlocks: { display: 'flex', gap: 18 },
  stat: { display: 'flex', flexDirection: 'column', gap: 1 },
  statVal: { fontSize: 14, fontWeight: 800, color: T, lineHeight: 1 },
  statLbl: { fontSize: 6, fontWeight: 700, letterSpacing: '0.14em', color: TDD, textTransform: 'uppercase' },

  // Actions
  cardActions: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  actionBtn: {
    background: 'none', border: `1px solid ${BDR}`,
    color: TD, fontSize: 8, fontWeight: 800, letterSpacing: '0.16em',
    padding: '8px 15px', cursor: 'pointer', fontFamily: 'inherit',
    transition: 'border-color 0.15s, color 0.15s',
  },
  actionBtnOut: { color: TDD, cursor: 'not-allowed' },
  copyHint: { fontSize: 8, color: TDD, letterSpacing: '0.04em' },

  // Empty state
  empty: {
    display: 'flex', flexDirection: 'column', gap: 10,
    padding: '40px 0',
  },
  emptyTitle: { fontSize: 11, fontWeight: 800, letterSpacing: '0.16em', color: TD },
  emptyHint:  { fontSize: 11, color: TDD, lineHeight: 1.8 },
}
