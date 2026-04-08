import { useState } from 'react'
import styles from './SourceScraper.module.css'

// Insider language patterns
const INSIDER_PATTERNS = [
  /i'?m hearing/gi, /i'?ve been hearing/gi, /my understanding is/gi,
  /sources tell me/gi, /from what i'?m told/gi, /i'?ve been told/gi,
  /i was told/gi, /league sources/gi, /a source with knowledge/gi,
  /don'?t be surprised if/gi, /word is that/gi, /i'?m getting/gi,
  /expect to see/gi, /i'?ve been told/gi,
]

// Team name → abbreviation mapping
const TEAM_NAMES = {
  'raiders': 'LV', 'jets': 'NYJ', 'cardinals': 'ARI', 'titans': 'TEN',
  'giants': 'NYG', 'browns': 'CLE', 'commanders': 'WAS', 'saints': 'NO',
  'chiefs': 'KC', 'bengals': 'CIN', 'dolphins': 'MIA', 'cowboys': 'DAL',
  'rams': 'LAR', 'ravens': 'BAL', 'buccaneers': 'TB', 'lions': 'DET',
  'vikings': 'MIN', 'panthers': 'CAR', 'steelers': 'PIT', 'chargers': 'LAC',
  'eagles': 'PHI', 'bears': 'CHI', 'bills': 'BUF', '49ers': 'SF',
  'texans': 'HOU', 'patriots': 'NE', 'seahawks': 'SEA', 'broncos': 'DEN',
  'colts': 'IND', 'jaguars': 'JAX', 'falcons': 'ATL', 'packers': 'GB',
}

// Credible source domains — organized by tier
const CREDIBLE_DOMAINS = {
  tier1: [
    'theathletic.com', 'espn.com', 'nfl.com', 'nflnetwork.com',
    'profootballfocus.com', 'profootballreference.com',
    'nbcsports.com', 'cbssports.com', 'si.com', 'foxsports.com',
    'sportingnews.com', 'bleacherreport.com',
  ],
  tier2: [
    // Major market newspapers and local outlets
    'baltimoresun.com', 'bostonglobe.com', 'chicagotribune.com',
    'dallasnews.com', 'denverpost.com', 'detroitnews.com', 'freep.com',
    'houstonchronicle.com', 'jsonline.com', 'kansascity.com',
    'latimes.com', 'miamiherald.com', 'nj.com', 'nola.com',
    'nytimes.com', 'nypost.com', 'orlandosentinel.com',
    'philly.com', 'inquirer.com', 'pittsburghpost-gazette.com',
    'seattletimes.com', 'sfchronicle.com', 'startribune.com',
    'tampabay.com', 'tennessean.com', 'usatoday.com',
    'washingtonpost.com', 'reviewjournal.com', 'reviewjournal.com',
    'masslive.com', 'providencejournal.com', 'buffalonews.com',
    // NFL team sites / beat destinations
    'fourvertsfootball.com', 'bigblueview.com', 'arrowheadpride.com',
    'turfshowtimes.com', 'fieldgulls.com', 'milehighreport.com',
    'pats.com', 'patriots.com',
    // Trusted draft-specific outlets
    'draftnetwork.com', 'drafttek.com', 'tankathon.com', 'mockdraftdb.com',
    'nfldraftbuzz.com', 'walterfootball.com', 'nflmockdraftdatabase.com',
    'lanceyards.com', 'pff.com',
    // Substack / podcast with established track records
    'golongtd.com', 'substack.com',
    // Social / aggregation
    'twitter.com', 'x.com',
  ],
}

function vetDomain(url) {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '')
    if (CREDIBLE_DOMAINS.tier1.some(d => hostname === d || hostname.endsWith('.' + d))) {
      return { trusted: true, tier: 1, domain: hostname }
    }
    if (CREDIBLE_DOMAINS.tier2.some(d => hostname === d || hostname.endsWith('.' + d))) {
      return { trusted: true, tier: 2, domain: hostname }
    }
    return { trusted: false, tier: 0, domain: hostname }
  } catch {
    return { trusted: false, tier: 0, domain: url }
  }
}

// Extract publish date from HTML (tries meta tags and JSON-LD)
function extractPublishDate(html) {
  const tmp = document.createElement('div')
  tmp.innerHTML = html

  // Try JSON-LD first
  const scripts = tmp.querySelectorAll('script[type="application/ld+json"]')
  for (const s of scripts) {
    try {
      const data = JSON.parse(s.textContent)
      const date = data.datePublished || data.dateModified || data.uploadDate
      if (date) return new Date(date)
    } catch {}
  }

  // Try common meta tags
  const metaSelectors = [
    'meta[property="article:published_time"]',
    'meta[name="pubdate"]',
    'meta[name="publishdate"]',
    'meta[name="date"]',
    'meta[itemprop="datePublished"]',
    'meta[property="og:updated_time"]',
    'time[datetime]',
  ]
  for (const sel of metaSelectors) {
    const el = tmp.querySelector(sel)
    const val = el?.getAttribute('content') || el?.getAttribute('datetime')
    if (val) {
      const d = new Date(val)
      if (!isNaN(d)) return d
    }
  }

  return null
}

// How stale is this content? Returns { label, multiplier, warning }
// Draft date: April 23, 2026. Today: April 7, 2026.
function getRecencyInfo(publishDate) {
  if (!publishDate) return { label: 'Date unknown', multiplier: 0.7, warning: 'Could not verify publish date — treat signals with caution.' }

  const now = new Date('2026-04-07')
  const ageDays = Math.floor((now - publishDate) / (1000 * 60 * 60 * 24))

  if (ageDays < 0) return { label: 'Future date?', multiplier: 0.5, warning: 'Publish date appears to be in the future.' }
  if (ageDays <= 7)  return { label: `${ageDays}d ago`, multiplier: 1.0, warning: null }
  if (ageDays <= 21) return { label: `${ageDays}d ago`, multiplier: 0.85, warning: null }
  if (ageDays <= 45) return { label: `${Math.round(ageDays / 7)}w ago`, multiplier: 0.65, warning: 'This article is over 3 weeks old. Situations may have changed.' }
  if (ageDays <= 90) return { label: `${Math.round(ageDays / 30)}mo ago`, multiplier: 0.40, warning: 'This article is over a month old. Draft intel from this far out is often superseded by newer reporting.' }
  return { label: `${Math.round(ageDays / 30)}mo ago`, multiplier: 0.20, warning: 'This article is very old. Intel from this period is largely stale — the draft landscape has changed significantly since then.' }
}

function detectInsiderLanguage(text) {
  for (const pattern of INSIDER_PATTERNS) {
    if (pattern.test(text)) {
      const match = text.match(pattern)
      return match ? match[0] : true
    }
  }
  return null
}

function extractIntel(text, recencyMultiplier = 1.0) {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 20)
  const intel = []

  sentences.forEach(sentence => {
    const s = sentence.trim()
    const insiderPhrase = detectInsiderLanguage(s)

    let teamFound = null
    Object.entries(TEAM_NAMES).forEach(([name, abbr]) => {
      if (s.toLowerCase().includes(name)) teamFound = abbr
    })

    let strength = 0
    if (insiderPhrase) strength += 35
    if (teamFound) strength += 10
    if (s.length > 50 && s.length < 300) strength += 5

    const draftKeywords = ['pick', 'draft', 'select', 'round', 'prospect', 'player', 'visit', 'meeting', 'target']
    draftKeywords.forEach(kw => { if (s.toLowerCase().includes(kw)) strength += 5 })

    if (strength >= 20) {
      const rawStrength = Math.min(60, strength)
      intel.push({
        text: s,
        team: teamFound,
        isInsider: !!insiderPhrase,
        insiderPhrase: insiderPhrase || null,
        strength: Math.round(rawStrength * recencyMultiplier),
        rawStrength,
      })
    }
  })

  return intel.sort((a, b) => b.strength - a.strength).slice(0, 15)
}

async function fetchContentAndDate(url) {
  let html = null

  // Direct fetch
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (res.ok) html = await res.text()
  } catch {}

  // AllOrigins CORS proxy fallback
  if (!html) {
    try {
      const proxy = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`
      const res = await fetch(proxy, { signal: AbortSignal.timeout(12000) })
      if (res.ok) {
        const data = await res.json()
        html = data.contents || null
      }
    } catch {}
  }

  if (!html) return null

  const publishDate = extractPublishDate(html)

  // Strip to readable text
  const tmp = document.createElement('div')
  tmp.innerHTML = html
  tmp.querySelectorAll('script, style, nav, header, footer').forEach(el => el.remove())
  const text = tmp.innerText || tmp.textContent || ''

  return { text, publishDate }
}

export default function SourceScraper({ isOpen, onClose, onIntelFound }) {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [results, setResults] = useState([])
  const [selectedResults, setSelectedResults] = useState([])
  const [sourceInfo, setSourceInfo] = useState(null) // { domainVet, recency }

  if (!isOpen) return null

  async function handleScrape() {
    const trimmed = url.trim()
    if (!trimmed) return

    setLoading(true)
    setError(null)
    setResults([])
    setSourceInfo(null)

    const domainVet = vetDomain(trimmed)

    const fetched = await fetchContentAndDate(trimmed)
    if (!fetched) {
      setLoading(false)
      setError(
        domainVet.trusted
          ? 'Could not fetch this URL — it may require a subscription or block scrapers. Try a different link.'
          : `Could not fetch this URL. Note: "${domainVet.domain}" is not a recognized outlet.`
      )
      return
    }

    const { text, publishDate } = fetched
    if (!text || text.trim().length < 50) {
      setLoading(false)
      setError('Not enough readable text found at this URL.')
      return
    }

    const recency = getRecencyInfo(publishDate)
    setSourceInfo({ domainVet, recency, publishDate })

    const intel = extractIntel(text, recency.multiplier)
    if (intel.length === 0) {
      setError('No significant draft intel found in this article. Try a different link.')
    }
    setResults(intel)
    setSelectedResults(intel.filter(i => i.isInsider || i.strength >= 25).map((_, idx) => idx))
    setLoading(false)
  }

  function toggleResult(idx) {
    setSelectedResults(prev =>
      prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
    )
  }

  function handleInject() {
    const toInject = results.filter((_, i) => selectedResults.includes(i))
    onIntelFound?.(toInject.map(r => ({
      ...r,
      source: url,
      domain: sourceInfo?.domainVet?.domain,
      publishDate: sourceInfo?.publishDate?.toISOString(),
    })))
    onClose()
  }

  const isUnknownSource = sourceInfo && !sourceInfo.domainVet.trusted
  const staleness = sourceInfo?.recency

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <h2 className={styles.title}>SOURCE SCRAPER</h2>
            <p className={styles.subtitle}>Paste a link — we'll fetch, vet, and extract draft intel</p>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div className={styles.inputArea}>
          <input
            className={styles.urlInput}
            type="url"
            placeholder="https://theathletic.com/... or any article URL"
            value={url}
            onChange={e => { setUrl(e.target.value); setError(null); setResults([]); setSourceInfo(null) }}
            onKeyDown={e => e.key === 'Enter' && handleScrape()}
            autoFocus
          />

          {error && <p className={styles.error}>{error}</p>}

          <button
            className={styles.scrapeBtn}
            onClick={handleScrape}
            disabled={loading || !url.trim()}
          >
            {loading ? 'FETCHING...' : 'EXTRACT INTEL'}
          </button>
        </div>

        {/* Source vetting panel — shown after fetch */}
        {sourceInfo && (
          <div className={styles.vetPanel}>
            <div className={styles.vetRow}>
              <span className={styles.vetLabel}>SOURCE</span>
              <span className={`${styles.vetDomain} ${isUnknownSource ? styles.vetDomainUnknown : ''}`}>
                {sourceInfo.domainVet.domain}
              </span>
              {sourceInfo.domainVet.tier === 1 && (
                <span className={styles.vetBadgeTrusted}>VERIFIED OUTLET</span>
              )}
              {sourceInfo.domainVet.tier === 2 && (
                <span className={styles.vetBadgeKnown}>KNOWN OUTLET</span>
              )}
              {!sourceInfo.domainVet.trusted && (
                <span className={styles.vetBadgeUnknown}>UNRECOGNIZED</span>
              )}
            </div>
            <div className={styles.vetRow}>
              <span className={styles.vetLabel}>PUBLISHED</span>
              <span className={styles.vetDate}>
                {sourceInfo.publishDate
                  ? sourceInfo.publishDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                  : 'Unknown'}
              </span>
              <span className={`${styles.vetAge} ${staleness.multiplier < 0.5 ? styles.vetAgeStale : ''}`}>
                {staleness.label}
              </span>
              {staleness.multiplier < 1.0 && (
                <span className={styles.vetMultiplier}>
                  {Math.round(staleness.multiplier * 100)}% weight
                </span>
              )}
            </div>
            {(isUnknownSource || staleness.warning) && (
              <div className={styles.vetWarnings}>
                {isUnknownSource && (
                  <p className={styles.vetWarning}>
                    "{sourceInfo.domainVet.domain}" is not a recognized outlet. Verify this is a credible source before injecting signals.
                  </p>
                )}
                {staleness.warning && (
                  <p className={`${styles.vetWarning} ${staleness.multiplier < 0.4 ? styles.vetWarningStale : ''}`}>
                    {staleness.warning}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Results */}
        {results.length > 0 && (
          <div className={styles.results}>
            <div className={styles.resultsHeader}>
              <span className={styles.resultsTitle}>
                {results.length} signal{results.length !== 1 ? 's' : ''} found
              </span>
              <span className={styles.resultsHint}>
                Select signals to inject into this session
              </span>
            </div>

            <div className={styles.resultList}>
              {results.map((r, i) => (
                <label key={i} className={`${styles.resultRow} ${selectedResults.includes(i) ? styles.resultRowSelected : ''}`}>
                  <input
                    type="checkbox"
                    checked={selectedResults.includes(i)}
                    onChange={() => toggleResult(i)}
                    className={styles.resultCheck}
                  />
                  <div className={styles.resultBody}>
                    <div className={styles.resultMeta}>
                      {r.team && <span className={styles.resultTeam}>{r.team}</span>}
                      {r.isInsider && <span className={styles.insiderBadge}>INSIDER</span>}
                      <span className={styles.resultStrength}>{r.strength} pts</span>
                      {r.rawStrength !== r.strength && (
                        <span className={styles.resultStrengthRaw}>({r.rawStrength} raw)</span>
                      )}
                      {r.insiderPhrase && (
                        <span className={styles.insiderPhrase}>&ldquo;{r.insiderPhrase}&rdquo;</span>
                      )}
                    </div>
                    <p className={styles.resultText}>{r.text}</p>
                  </div>
                </label>
              ))}
            </div>

            <div className={styles.resultsFooter}>
              <span className={styles.selectedCount}>{selectedResults.length} selected</span>
              <button
                className={styles.injectBtn}
                onClick={handleInject}
                disabled={selectedResults.length === 0}
              >
                ADD TO SESSION
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
