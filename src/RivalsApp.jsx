import { useState, useEffect } from 'react'

const API = import.meta.env.VITE_RIVALS_API ?? 'http://localhost:8080'

const ROLE = {
  vanguard:   { bg: '#0d2040', text: '#5090e0', label: 'VG' },
  duelist:    { bg: '#2a0d0d', text: '#e05050', label: 'DL' },
  strategist: { bg: '#0d2a14', text: '#50c070', label: 'ST' },
}
const RANKS   = ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Celestial', 'One Above All']
const REGIONS = ['NA-East', 'NA-West', 'EU', 'Asia', 'SA', 'OCE']
const FREE_REVEALS = 3

function timeAgo(iso) {
  const diff = (Date.now() - new Date(iso)) / 1000
  if (diff < 3600)   return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400)  return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function StatChip({ label, value, highlight }) {
  return (
    <span style={{ ...s.chip, ...(highlight ? s.chipHL : {}) }}>
      <span style={s.chipLabel}>{label}</span>
      <span style={s.chipValue}>{value}</span>
    </span>
  )
}

function PlayerCard({ result, searchedChars, revealedNames, revealsLeft, onReveal }) {
  const { profile, matchScore } = result
  const revealed = revealedNames[profile.id]
  const [revealing, setRevealing] = useState(false)

  // Sort mains: matched ones first
  const sortedMains = [...(profile.mainCharacters || [])].sort((a, b) => {
    const am = searchedChars.includes(a), bm = searchedChars.includes(b)
    return am === bm ? 0 : am ? -1 : 1
  })

  async function handleReveal() {
    if (revealsLeft <= 0) return
    setRevealing(true)
    try {
      const res = await fetch(`${API}/api/reveal/${profile.id}`, { method: 'POST' })
      const data = await res.json()
      onReveal(profile.id, data.username)
    } finally {
      setRevealing(false)
    }
  }

  return (
    <div style={s.card}>
      {/* Header */}
      <div style={s.cardHead}>
        <div style={s.cardLeft}>
          <div style={s.cardIdentity}>
            {revealed
              ? <span style={s.cardName}>{revealed}</span>
              : <span style={s.anonName}>
                  <span style={s.lockIcon}>🔒</span>
                  <span style={s.anonBlur}>████████████</span>
                </span>
            }
            <span style={s.cardId}>{profile.id}</span>
          </div>
          <div style={s.cardMeta}>
            {profile.rank && <span style={s.metaTag}>{profile.rank}</span>}
            {profile.region && <span style={s.metaTag}>{profile.region}</span>}
            <span style={s.metaTag}>⏱ {timeAgo(profile.lastActive)}</span>
          </div>
        </div>
        <div style={s.matchScore}>
          <span style={s.matchNum}>{matchScore}</span>
          <span style={s.matchWord}>match{matchScore !== 1 ? 'es' : ''}</span>
        </div>
      </div>

      {/* Per-character stats */}
      <div style={s.heroRows}>
        {sortedMains.map(name => {
          const cs = profile.stats?.[name]
          const isMatch = searchedChars.includes(name)
          // Find role from character name
          return (
            <div key={name} style={{ ...s.heroRow, ...(isMatch ? s.heroRowMatch : s.heroRowDim) }}>
              <span style={s.heroName}>{name}</span>
              {cs ? (
                <div style={s.heroStats}>
                  <StatChip label="KDA"  value={cs.kda.toFixed(2)}  highlight={isMatch} />
                  <StatChip label="WR"   value={`${cs.winRate.toFixed(1)}%`} highlight={isMatch} />
                  <StatChip label="TIME" value={`${cs.playtimeHours.toFixed(1)}h`} highlight={isMatch} />
                  <StatChip label="GP"   value={cs.games} />
                </div>
              ) : (
                <span style={s.noStats}>no data</span>
              )}
            </div>
          )
        })}
      </div>

      {/* Actions */}
      <div style={s.cardActions}>
        {revealed ? (
          <CopyButton username={revealed} />
        ) : (
          <button
            style={{ ...s.revealBtn, ...(revealsLeft <= 0 ? s.revealBtnDisabled : {}) }}
            onClick={handleReveal}
            disabled={revealing || revealsLeft <= 0}
          >
            {revealing ? 'Revealing...' : revealsLeft > 0 ? `Reveal username →` : 'No reveals left'}
          </button>
        )}
        {!revealed && revealsLeft <= 0 && (
          <button style={s.proBtn} onClick={() => alert('Pro tier coming soon — get unlimited reveals and first-dibs invites.')}>
            ⭐ Go Pro
          </button>
        )}
      </div>
    </div>
  )
}

function CopyButton({ username }) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    await navigator.clipboard.writeText(username)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <div style={s.revealedActions}>
      <span style={s.revealedName}>{username}</span>
      <button style={{ ...s.copyBtn, ...(copied ? s.copyBtnDone : {}) }} onClick={copy}>
        {copied ? '✓ Copied' : 'Copy username'}
      </button>
      <span style={s.copyHint}>Search in Marvel Rivals → Social → Add friend</span>
    </div>
  )
}

export default function RivalsApp() {
  const [characters, setCharacters]  = useState([])
  const [step, setStep]              = useState('form')  // form | results
  const [username, setUsername]      = useState('')
  const [rank, setRank]              = useState('')
  const [region, setRegion]          = useState('')
  const [selected, setSelected]      = useState([])
  const [roleFilter, setRoleFilter]  = useState('all')
  const [loading, setLoading]        = useState(false)
  const [error, setError]            = useState('')
  const [myProfile, setMyProfile]    = useState(null)
  const [results, setResults]        = useState([])
  const [revealedNames, setRevealedNames] = useState({})
  const [revealsLeft, setRevealsLeft] = useState(FREE_REVEALS)

  useEffect(() => {
    fetch(`${API}/api/characters`)
      .then(r => r.json())
      .then(setCharacters)
      .catch(() => setError('Cannot reach backend — start the Go server: cd backend && go run .'))
  }, [])

  function toggleChar(name) {
    setSelected(prev => prev.includes(name) ? prev.filter(c => c !== name) : [...prev, name])
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!username.trim()) return setError('Enter your Marvel Rivals username')
    if (!selected.length) return setError('Select at least one character to search for')
    setError('')
    setLoading(true)

    try {
      // Register self (fetches real stats from API)
      const regRes = await fetch(`${API}/api/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), rank, region }),
      })
      const regData = await regRes.json()
      if (!regRes.ok) throw new Error(regData.error || 'Registration failed')
      setMyProfile(regData)

      // Search for teammates
      const params = new URLSearchParams({
        characters: selected.join(','),
        exclude: regData.playerId,
      })
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

  const visible = roleFilter === 'all' ? characters : characters.filter(c => c.role === roleFilter)

  return (
    <div style={s.page}>
      <header style={s.header}>
        <a href="#" style={s.back}>← back</a>
        <div style={s.logo}>
          <span style={s.logoDunk}>dunk</span>
          <span style={s.logoSep}> // </span>
          <span style={s.logoRivals}>RIVALS</span>
        </div>
        <div style={{ width: 60 }} />
      </header>

      <main style={s.main}>

        {step === 'form' && (
          <form onSubmit={handleSubmit} style={s.form}>
            <div style={s.section}>
              <h2 style={s.sectionTitle}>Your account</h2>
              <div style={s.fieldRow}>
                <div style={s.field}>
                  <label style={s.label}>Marvel Rivals username</label>
                  <input
                    style={s.input}
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder="e.g. IronCore99"
                    autoComplete="off"
                  />
                </div>
                <div style={s.field}>
                  <label style={s.label}>Rank <span style={s.opt}>(optional)</span></label>
                  <select style={s.select} value={rank} onChange={e => setRank(e.target.value)}>
                    <option value="">Any</option>
                    {RANKS.map(r => <option key={r}>{r}</option>)}
                  </select>
                </div>
                <div style={s.field}>
                  <label style={s.label}>Region <span style={s.opt}>(optional)</span></label>
                  <select style={s.select} value={region} onChange={e => setRegion(e.target.value)}>
                    <option value="">Any</option>
                    {REGIONS.map(r => <option key={r}>{r}</option>)}
                  </select>
                </div>
              </div>
              <p style={s.hint}>
                We'll fetch your stats from the Marvel Rivals API and add you to the registry so others can find you.
              </p>
            </div>

            <div style={s.section}>
              <div style={s.pickerTop}>
                <div>
                  <h2 style={s.sectionTitle}>I want to team up with someone who plays…</h2>
                  <p style={s.sublabel}>Select in priority order</p>
                </div>
                <div style={s.roleFilters}>
                  {['all','vanguard','duelist','strategist'].map(r => (
                    <button key={r} type="button"
                      style={{ ...s.roleBtn, ...(roleFilter === r ? s.roleBtnOn : {}) }}
                      onClick={() => setRoleFilter(r)}
                    >{r}</button>
                  ))}
                </div>
              </div>

              {selected.length > 0 && (
                <div style={s.badges}>
                  {selected.map((name, i) => (
                    <span key={name} style={s.badge}>
                      <span style={s.badgeNum}>{i+1}</span>
                      {name}
                      <button type="button" style={s.badgeX} onClick={() => toggleChar(name)}>×</button>
                    </span>
                  ))}
                </div>
              )}

              <div style={s.grid}>
                {visible.map(c => {
                  const idx = selected.indexOf(c.name)
                  const on = idx !== -1
                  const rc = ROLE[c.role] ?? ROLE.duelist
                  return (
                    <button key={c.id} type="button"
                      style={{ ...s.charCard, ...(on ? { borderColor: rc.text, background: rc.bg } : {}) }}
                      onClick={() => toggleChar(c.name)}
                    >
                      {on && <span style={{ ...s.charIdx, color: rc.text }}>{idx+1}</span>}
                      <span style={s.charName}>{c.name}</span>
                      <span style={{ ...s.roleTag, background: rc.bg, color: rc.text }}>{rc.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {error && <p style={s.error}>{error}</p>}

            <button type="submit" style={s.submitBtn} disabled={loading}>
              {loading ? 'Fetching your stats…' : 'Find teammates →'}
            </button>
          </form>
        )}

        {step === 'results' && (
          <div style={s.results}>
            {/* Your profile card */}
            {myProfile && (
              <div style={s.myCard}>
                <div style={s.myCardHead}>
                  <span style={s.myCardTitle}>You're registered</span>
                  <span style={s.myId}>{myProfile.playerId}</span>
                </div>
                {myProfile.mainCharacters?.length > 0 ? (
                  <div style={s.myMains}>
                    <span style={s.myMainsLabel}>Detected mains:</span>
                    {myProfile.mainCharacters.map(name => {
                      const cs = myProfile.stats?.[name]
                      return (
                        <span key={name} style={s.myMain}>
                          {name}
                          {cs && <span style={s.myMainStats}> · {cs.kda.toFixed(2)} KDA · {cs.winRate.toFixed(1)}% WR · {cs.playtimeHours.toFixed(1)}h</span>}
                        </span>
                      )
                    })}
                  </div>
                ) : (
                  <p style={s.noMains}>No match history found — play some games then try again.</p>
                )}
              </div>
            )}

            {/* Results header */}
            <div style={s.resultsHead}>
              <button style={s.backBtn} onClick={() => setStep('form')}>← New search</button>
              <div style={s.resultsRight}>
                {revealsLeft > 0 && (
                  <span style={s.revealsLeft}>{revealsLeft} free reveal{revealsLeft !== 1 ? 's' : ''} left</span>
                )}
                <span style={s.resultsCount}>
                  {results.length === 0
                    ? 'No players found yet'
                    : `${results.length} player${results.length !== 1 ? 's' : ''} found`}
                </span>
              </div>
            </div>

            {/* Player cards */}
            <div style={s.cards}>
              {results.map(result => (
                <PlayerCard
                  key={result.profile.id}
                  result={result}
                  searchedChars={selected}
                  revealedNames={revealedNames}
                  revealsLeft={revealsLeft}
                  onReveal={handleReveal}
                />
              ))}
              {results.length === 0 && (
                <div style={s.emptyState}>
                  <p style={s.emptyTitle}>No players found yet</p>
                  <p style={s.emptyHint}>You've been added to the registry. Share this page and you'll start seeing matches when others register.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = {
  page:        { minHeight: '100dvh', background: '#06060f', color: '#d8d8e8', fontFamily: "'Syne', system-ui, sans-serif", display: 'flex', flexDirection: 'column' },
  header:      { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 28px', borderBottom: '1px solid #12122a' },
  back:        { color: '#444', textDecoration: 'none', fontSize: 13, width: 60 },
  logo:        { display: 'flex', alignItems: 'baseline', gap: 4 },
  logoDunk:    { fontSize: 11, color: '#333', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase' },
  logoSep:     { fontSize: 11, color: '#222' },
  logoRivals:  { fontSize: 17, fontWeight: 800, letterSpacing: '0.15em', color: '#e8192c' },
  main:        { flex: 1, padding: '28px 28px 48px', maxWidth: 820, margin: '0 auto', width: '100%', boxSizing: 'border-box' },
  form:        { display: 'flex', flexDirection: 'column', gap: 32 },
  section:     { display: 'flex', flexDirection: 'column', gap: 14 },
  sectionTitle:{ fontSize: 13, fontWeight: 800, letterSpacing: '0.06em', color: '#888', textTransform: 'uppercase', margin: 0 },
  fieldRow:    { display: 'flex', gap: 12, flexWrap: 'wrap' },
  field:       { display: 'flex', flexDirection: 'column', gap: 5, flex: 1, minWidth: 160 },
  label:       { fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: '#666', textTransform: 'uppercase' },
  opt:         { fontWeight: 400, color: '#444', textTransform: 'none', letterSpacing: 0 },
  input:       { background: '#0d0d1c', border: '1px solid #1e1e38', borderRadius: 6, color: '#d8d8e8', fontSize: 15, padding: '10px 13px', outline: 'none', fontFamily: 'inherit' },
  select:      { background: '#0d0d1c', border: '1px solid #1e1e38', borderRadius: 6, color: '#d8d8e8', fontSize: 14, padding: '10px 13px', outline: 'none', fontFamily: 'inherit', width: '100%' },
  hint:        { fontSize: 11, color: '#444', margin: 0 },
  pickerTop:   { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 },
  sublabel:    { fontSize: 11, color: '#555', margin: '3px 0 0' },
  roleFilters: { display: 'flex', gap: 5 },
  roleBtn:     { background: 'none', border: '1px solid #1e1e38', borderRadius: 4, color: '#555', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', padding: '5px 10px', cursor: 'pointer', textTransform: 'uppercase', fontFamily: 'inherit' },
  roleBtnOn:   { borderColor: '#e8192c', color: '#e8192c' },
  badges:      { display: 'flex', flexWrap: 'wrap', gap: 6 },
  badge:       { display: 'inline-flex', alignItems: 'center', gap: 5, background: '#12122a', border: '1px solid #2a2a50', borderRadius: 4, padding: '4px 9px', fontSize: 12, fontWeight: 700, color: '#a0a0cc' },
  badgeNum:    { color: '#555', fontSize: 10 },
  badgeX:      { background: 'none', border: 'none', cursor: 'pointer', color: '#555', fontSize: 14, lineHeight: 1, padding: 0, marginLeft: 2 },
  grid:        { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 7 },
  charCard:    { background: '#0d0d1c', border: '1px solid #1a1a30', borderRadius: 6, padding: '9px 11px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 5, position: 'relative', fontFamily: 'inherit', transition: 'border-color 0.12s, background 0.12s' },
  charIdx:     { position: 'absolute', top: 7, right: 9, fontSize: 10, fontWeight: 800 },
  charName:    { fontSize: 12, fontWeight: 700, color: '#b0b0cc', lineHeight: 1.25 },
  roleTag:     { fontSize: 9, fontWeight: 800, letterSpacing: '0.08em', padding: '2px 5px', borderRadius: 3 },
  error:       { color: '#e8192c', fontSize: 13, margin: 0 },
  submitBtn:   { background: '#e8192c', color: '#fff', border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 800, padding: '13px 26px', cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '0.05em', alignSelf: 'flex-start' },

  // Results
  results:     { display: 'flex', flexDirection: 'column', gap: 16 },
  myCard:      { background: '#0a0a1a', border: '1px solid #1e1e3a', borderRadius: 8, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 },
  myCardHead:  { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  myCardTitle: { fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', color: '#50c070', textTransform: 'uppercase' },
  myId:        { fontSize: 11, color: '#444', fontFamily: 'monospace' },
  myMains:     { display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  myMainsLabel:{ fontSize: 11, color: '#555', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' },
  myMain:      { fontSize: 13, fontWeight: 700, color: '#a0c0ff' },
  myMainStats: { fontSize: 11, color: '#555', fontWeight: 400 },
  noMains:     { fontSize: 12, color: '#555', margin: 0 },

  resultsHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  backBtn:     { background: 'none', border: '1px solid #1e1e38', borderRadius: 4, color: '#666', fontSize: 12, padding: '7px 13px', cursor: 'pointer', fontFamily: 'inherit' },
  resultsRight:{ display: 'flex', alignItems: 'center', gap: 14 },
  revealsLeft: { fontSize: 11, color: '#e8a020', fontWeight: 700 },
  resultsCount:{ fontSize: 12, color: '#555' },
  cards:       { display: 'flex', flexDirection: 'column', gap: 10 },

  card:        { background: '#0a0a18', border: '1px solid #181830', borderRadius: 8, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 },
  cardHead:    { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardLeft:    { display: 'flex', flexDirection: 'column', gap: 4 },
  cardIdentity:{ display: 'flex', alignItems: 'center', gap: 10 },
  cardName:    { fontSize: 17, fontWeight: 800, color: '#e8e8f8' },
  anonName:    { display: 'flex', alignItems: 'center', gap: 6 },
  lockIcon:    { fontSize: 13 },
  anonBlur:    { fontSize: 15, fontWeight: 800, color: '#2a2a4a', letterSpacing: '0.05em', userSelect: 'none' },
  cardId:      { fontSize: 10, color: '#333', fontFamily: 'monospace' },
  cardMeta:    { display: 'flex', gap: 6, flexWrap: 'wrap' },
  metaTag:     { fontSize: 10, fontWeight: 700, color: '#555', background: '#0f0f20', padding: '2px 7px', borderRadius: 3 },
  matchScore:  { display: 'flex', flexDirection: 'column', alignItems: 'center', background: '#1a1a08', border: '1px solid #2a2a10', borderRadius: 6, padding: '6px 12px', minWidth: 48 },
  matchNum:    { fontSize: 20, fontWeight: 800, color: '#c8c030', lineHeight: 1 },
  matchWord:   { fontSize: 9, color: '#666', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' },

  heroRows:    { display: 'flex', flexDirection: 'column', gap: 6 },
  heroRow:     { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  heroRowMatch:{ opacity: 1 },
  heroRowDim:  { opacity: 0.35 },
  heroName:    { fontSize: 12, fontWeight: 800, color: '#9090b8', minWidth: 130 },
  heroStats:   { display: 'flex', gap: 5, flexWrap: 'wrap' },
  noStats:     { fontSize: 11, color: '#333' },

  chip:        { display: 'inline-flex', gap: 4, alignItems: 'center', background: '#0f0f20', border: '1px solid #1e1e38', borderRadius: 4, padding: '3px 7px', fontSize: 11 },
  chipHL:      { background: '#15152a', borderColor: '#2a2a50' },
  chipLabel:   { color: '#555', fontWeight: 700, fontSize: 9, letterSpacing: '0.06em', textTransform: 'uppercase' },
  chipValue:   { color: '#a0a0cc', fontWeight: 700 },

  cardActions:    { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  revealBtn:      { background: 'none', border: '1px solid #e8192c', borderRadius: 5, color: '#e8192c', fontSize: 12, fontWeight: 700, padding: '8px 16px', cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '0.04em' },
  revealBtnDisabled: { borderColor: '#2a2a40', color: '#444', cursor: 'not-allowed' },
  proBtn:         { background: 'none', border: '1px solid #c8a020', borderRadius: 5, color: '#c8a020', fontSize: 11, fontWeight: 700, padding: '8px 14px', cursor: 'pointer', fontFamily: 'inherit' },

  revealedActions:{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  revealedName:   { fontSize: 15, fontWeight: 800, color: '#e8e8f8' },
  copyBtn:        { background: 'none', border: '1px solid #2a2a50', borderRadius: 4, color: '#8080a8', fontSize: 11, fontWeight: 700, padding: '6px 12px', cursor: 'pointer', fontFamily: 'inherit' },
  copyBtnDone:    { borderColor: '#50c070', color: '#50c070' },
  copyHint:       { fontSize: 10, color: '#444' },

  emptyState:  { background: '#0a0a18', border: '1px solid #181830', borderRadius: 8, padding: '32px', textAlign: 'center' },
  emptyTitle:  { fontSize: 15, fontWeight: 800, color: '#555', margin: '0 0 8px' },
  emptyHint:   { fontSize: 12, color: '#444', margin: 0, lineHeight: 1.6 },
}
