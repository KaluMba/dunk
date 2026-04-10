import { useState, useEffect } from 'react'

const API = import.meta.env.VITE_RIVALS_API ?? 'http://localhost:8080'

const ROLE_COLOR = {
  vanguard:   { bg: '#1a3a6a', text: '#60a0ff' },
  duelist:    { bg: '#4a1a1a', text: '#ff6060' },
  strategist: { bg: '#1a4a2a', text: '#60cc80' },
}

const RANKS = ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Celestial', 'One Above All']
const REGIONS = ['NA-East', 'NA-West', 'EU', 'Asia', 'SA', 'OCE']

export default function RivalsApp() {
  const [characters, setCharacters] = useState([])
  const [step, setStep] = useState('form') // form | results
  const [username, setUsername] = useState('')
  const [rank, setRank] = useState('')
  const [region, setRegion] = useState('')
  const [selected, setSelected] = useState([]) // ordered list of character names
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')

  useEffect(() => {
    fetch(`${API}/api/characters`)
      .then(r => r.json())
      .then(setCharacters)
      .catch(() => setError('Could not reach backend — is the Go server running?'))
  }, [])

  function toggleChar(name) {
    setSelected(prev =>
      prev.includes(name) ? prev.filter(c => c !== name) : [...prev, name]
    )
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!username.trim()) return setError('Enter your username')
    if (selected.length === 0) return setError('Select at least one character')
    setError('')
    setLoading(true)

    try {
      // Register the user
      await fetch(`${API}/api/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), characters: selected, rank, region }),
      })

      // Search for matching players
      const params = new URLSearchParams({
        characters: selected.join(','),
        exclude: username.trim(),
      })
      const res = await fetch(`${API}/api/search?${params}`)
      const data = await res.json()
      setResults(data)
      setStep('results')
    } catch {
      setError('Request failed — is the Go server running?')
    } finally {
      setLoading(false)
    }
  }

  async function copyUsername(name) {
    await navigator.clipboard.writeText(name)
    setCopied(name)
    setTimeout(() => setCopied(''), 2000)
  }

  const visible = roleFilter === 'all'
    ? characters
    : characters.filter(c => c.role === roleFilter)

  return (
    <div style={styles.page}>
      {/* Header */}
      <header style={styles.header}>
        <a href="#" style={styles.back}>← back</a>
        <div style={styles.logo}>
          <span style={styles.logoSmall}>dunk</span>
          <span style={styles.logoSlash}> // </span>
          <span style={styles.logoMain}>RIVALS</span>
        </div>
        <div style={{ width: 60 }} />
      </header>

      <main style={styles.main}>
        {step === 'form' && (
          <form onSubmit={handleSubmit} style={styles.form}>
            <div style={styles.formTop}>
              <div style={styles.fieldGroup}>
                <label style={styles.label}>Your Marvel Rivals username</label>
                <input
                  style={styles.input}
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="e.g. IronCore99"
                  autoComplete="off"
                />
              </div>
              <div style={styles.fieldRow}>
                <div style={styles.fieldGroup}>
                  <label style={styles.label}>Rank <span style={styles.optional}>(optional)</span></label>
                  <select style={styles.select} value={rank} onChange={e => setRank(e.target.value)}>
                    <option value="">Any</option>
                    {RANKS.map(r => <option key={r}>{r}</option>)}
                  </select>
                </div>
                <div style={styles.fieldGroup}>
                  <label style={styles.label}>Region <span style={styles.optional}>(optional)</span></label>
                  <select style={styles.select} value={region} onChange={e => setRegion(e.target.value)}>
                    <option value="">Any</option>
                    {REGIONS.map(r => <option key={r}>{r}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div style={styles.pickerSection}>
              <div style={styles.pickerHeader}>
                <div>
                  <p style={styles.label}>Characters you want to team up with</p>
                  <p style={styles.sublabel}>Select in priority order — first pick = most wanted</p>
                </div>
                <div style={styles.roleFilters}>
                  {['all', 'vanguard', 'duelist', 'strategist'].map(r => (
                    <button
                      key={r} type="button"
                      style={{ ...styles.roleBtn, ...(roleFilter === r ? styles.roleBtnActive : {}) }}
                      onClick={() => setRoleFilter(r)}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              {/* Selected badges */}
              {selected.length > 0 && (
                <div style={styles.selectedRow}>
                  {selected.map((name, i) => {
                    const char = characters.find(c => c.name === name)
                    const role = char?.role ?? 'duelist'
                    return (
                      <span key={name} style={{ ...styles.badge, background: ROLE_COLOR[role].bg, color: ROLE_COLOR[role].text }}>
                        <span style={styles.badgePriority}>{i + 1}</span>
                        {name}
                        <button type="button" style={styles.badgeX} onClick={() => toggleChar(name)}>×</button>
                      </span>
                    )
                  })}
                </div>
              )}

              {/* Character grid */}
              <div style={styles.grid}>
                {visible.map(c => {
                  const idx = selected.indexOf(c.name)
                  const isSelected = idx !== -1
                  const rc = ROLE_COLOR[c.role]
                  return (
                    <button
                      key={c.id} type="button"
                      style={{
                        ...styles.charCard,
                        ...(isSelected ? { ...styles.charCardSelected, borderColor: rc.text } : {}),
                      }}
                      onClick={() => toggleChar(c.name)}
                    >
                      {isSelected && <span style={{ ...styles.charPriority, color: rc.text }}>{idx + 1}</span>}
                      <span style={styles.charName}>{c.name}</span>
                      <span style={{ ...styles.roleTag, background: rc.bg, color: rc.text }}>{c.role}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {error && <p style={styles.error}>{error}</p>}

            <button type="submit" style={styles.submitBtn} disabled={loading}>
              {loading ? 'Searching...' : 'Find teammates →'}
            </button>
          </form>
        )}

        {step === 'results' && (
          <div style={styles.results}>
            <div style={styles.resultsHeader}>
              <button style={styles.backBtn} onClick={() => setStep('form')}>← New search</button>
              <p style={styles.resultsCount}>
                {results.length === 0
                  ? 'No players found yet — be the first to register!'
                  : `${results.length} player${results.length !== 1 ? 's' : ''} found`}
              </p>
            </div>

            <div style={styles.cards}>
              {results.map(({ player, matchScore }) => (
                <div key={player.username} style={styles.card}>
                  <div style={styles.cardTop}>
                    <div>
                      <p style={styles.cardName}>{player.username}</p>
                      <p style={styles.cardMeta}>{[player.rank, player.region].filter(Boolean).join(' · ')}</p>
                    </div>
                    <span style={styles.matchBadge}>{matchScore} match{matchScore !== 1 ? 'es' : ''}</span>
                  </div>

                  <div style={styles.cardChars}>
                    {player.characters.map(name => {
                      const char = characters.find(c => c.name === name)
                      const rc = ROLE_COLOR[char?.role ?? 'duelist']
                      const isMatch = selected.includes(name)
                      return (
                        <span
                          key={name}
                          style={{
                            ...styles.charChip,
                            background: rc.bg,
                            color: rc.text,
                            ...(isMatch ? { outline: `1px solid ${rc.text}` } : { opacity: 0.5 }),
                          }}
                        >
                          {name}
                        </span>
                      )
                    })}
                  </div>

                  <button
                    style={{ ...styles.inviteBtn, ...(copied === player.username ? styles.inviteBtnCopied : {}) }}
                    onClick={() => copyUsername(player.username)}
                  >
                    {copied === player.username ? '✓ Copied!' : 'Copy username'}
                  </button>
                </div>
              ))}
            </div>

            {results.length > 0 && (
              <p style={styles.inviteHint}>
                Copy a username, then in Marvel Rivals: <strong>Social → Search player → Send friend request</strong>
              </p>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

const styles = {
  page: {
    minHeight: '100dvh',
    background: '#080810',
    color: '#e8e8f0',
    fontFamily: "'Syne', system-ui, sans-serif",
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '20px 32px',
    borderBottom: '1px solid #1a1a2e',
  },
  back: { color: '#666', textDecoration: 'none', fontSize: 14, width: 60 },
  logo: { display: 'flex', alignItems: 'baseline', gap: 4 },
  logoSmall: { fontSize: 12, color: '#444', fontWeight: 800, letterSpacing: '0.1em' },
  logoSlash: { fontSize: 12, color: '#333' },
  logoMain: { fontSize: 18, fontWeight: 800, letterSpacing: '0.12em', color: '#e8192c' },
  main: { flex: 1, padding: '32px', maxWidth: 860, margin: '0 auto', width: '100%' },
  form: { display: 'flex', flexDirection: 'column', gap: 28 },
  formTop: { display: 'flex', flexDirection: 'column', gap: 16 },
  fieldGroup: { display: 'flex', flexDirection: 'column', gap: 6, flex: 1 },
  fieldRow: { display: 'flex', gap: 16 },
  label: { fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', color: '#888', textTransform: 'uppercase', margin: 0 },
  sublabel: { fontSize: 11, color: '#555', marginTop: 2, marginBottom: 0 },
  optional: { fontWeight: 400, color: '#555', textTransform: 'none', letterSpacing: 0 },
  input: {
    background: '#0f0f1e', border: '1px solid #2a2a40', borderRadius: 6,
    color: '#e8e8f0', fontSize: 16, padding: '10px 14px', outline: 'none',
    fontFamily: 'inherit',
  },
  select: {
    background: '#0f0f1e', border: '1px solid #2a2a40', borderRadius: 6,
    color: '#e8e8f0', fontSize: 14, padding: '10px 14px', outline: 'none',
    fontFamily: 'inherit', width: '100%',
  },
  pickerSection: { display: 'flex', flexDirection: 'column', gap: 14 },
  pickerHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 },
  roleFilters: { display: 'flex', gap: 6 },
  roleBtn: {
    background: 'transparent', border: '1px solid #2a2a40', borderRadius: 4,
    color: '#555', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
    padding: '5px 10px', cursor: 'pointer', textTransform: 'uppercase', fontFamily: 'inherit',
  },
  roleBtnActive: { borderColor: '#e8192c', color: '#e8192c' },
  selectedRow: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  badge: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    borderRadius: 4, padding: '4px 10px', fontSize: 12, fontWeight: 700,
  },
  badgePriority: { opacity: 0.6, fontSize: 10 },
  badgeX: {
    background: 'none', border: 'none', cursor: 'pointer', color: 'inherit',
    fontSize: 14, lineHeight: 1, padding: '0 0 0 2px', opacity: 0.7,
  },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(148px, 1fr))', gap: 8 },
  charCard: {
    background: '#0f0f1e', border: '1px solid #1e1e30', borderRadius: 6,
    padding: '10px 12px', cursor: 'pointer', display: 'flex', flexDirection: 'column',
    alignItems: 'flex-start', gap: 6, position: 'relative', fontFamily: 'inherit',
    transition: 'border-color 0.15s',
  },
  charCardSelected: { background: '#12121f' },
  charPriority: { position: 'absolute', top: 8, right: 10, fontSize: 11, fontWeight: 800, opacity: 0.9 },
  charName: { fontSize: 13, fontWeight: 700, color: '#d0d0e0', lineHeight: 1.2 },
  roleTag: { fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '2px 6px', borderRadius: 3 },
  error: { color: '#e8192c', fontSize: 13, margin: 0 },
  submitBtn: {
    background: '#e8192c', color: '#fff', border: 'none', borderRadius: 6,
    fontSize: 15, fontWeight: 800, padding: '14px 28px', cursor: 'pointer',
    fontFamily: 'inherit', letterSpacing: '0.04em', alignSelf: 'flex-start',
  },
  results: { display: 'flex', flexDirection: 'column', gap: 20 },
  resultsHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  backBtn: {
    background: 'none', border: '1px solid #2a2a40', borderRadius: 4,
    color: '#888', fontSize: 13, padding: '7px 14px', cursor: 'pointer', fontFamily: 'inherit',
  },
  resultsCount: { color: '#666', fontSize: 13, margin: 0 },
  cards: { display: 'flex', flexDirection: 'column', gap: 12 },
  card: { background: '#0f0f1e', border: '1px solid #1e1e30', borderRadius: 8, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12 },
  cardTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardName: { fontSize: 18, fontWeight: 800, color: '#e8e8f0', margin: 0 },
  cardMeta: { fontSize: 12, color: '#555', margin: '3px 0 0' },
  matchBadge: { background: '#1a1a00', color: '#c8c840', fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 4, letterSpacing: '0.04em', whiteSpace: 'nowrap' },
  cardChars: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  charChip: { fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 3 },
  inviteBtn: {
    background: 'transparent', border: '1px solid #2a2a40', borderRadius: 5,
    color: '#888', fontSize: 12, fontWeight: 700, padding: '8px 16px',
    cursor: 'pointer', fontFamily: 'inherit', alignSelf: 'flex-start',
    letterSpacing: '0.04em', transition: 'all 0.15s',
  },
  inviteBtnCopied: { borderColor: '#40c860', color: '#40c860' },
  inviteHint: { fontSize: 12, color: '#444', textAlign: 'center', margin: '8px 0 0' },
}
