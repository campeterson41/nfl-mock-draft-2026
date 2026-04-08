import { useState } from 'react'
import styles from './SessionSetup.module.css'

const SORT_OPTIONS = [
  { id: 'pick',  label: 'PICK ORDER' },
  { id: 'conf',  label: 'CONFERENCE' },
  { id: 'div',   label: 'DIVISION' },
  { id: 'alpha', label: 'A–Z' },
]

// espnId = ESPN CDN logo identifier (lowercase, some differ from our team ID)
const TEAMS_DISPLAY = [
  { id: 'LV',  espnId: 'lv',  abbreviation: 'LV',  city: 'Las Vegas',      nickname: 'Raiders',    colors: { primary: '#A5ACAF', secondary: '#000000' }, conf: 'AFC', div: 'West',  r1pick: 1  },
  { id: 'NYJ', espnId: 'nyj', abbreviation: 'NYJ', city: 'New York',       nickname: 'Jets',       colors: { primary: '#125740', secondary: '#000000' }, conf: 'AFC', div: 'East',  r1pick: 2  },
  { id: 'ARI', espnId: 'ari', abbreviation: 'ARI', city: 'Arizona',        nickname: 'Cardinals',  colors: { primary: '#97233F', secondary: '#FFB612' }, conf: 'NFC', div: 'West',  r1pick: 3  },
  { id: 'TEN', espnId: 'ten', abbreviation: 'TEN', city: 'Tennessee',      nickname: 'Titans',     colors: { primary: '#4B92DB', secondary: '#002244' }, conf: 'AFC', div: 'South', r1pick: 4  },
  { id: 'NYG', espnId: 'nyg', abbreviation: 'NYG', city: 'New York',       nickname: 'Giants',     colors: { primary: '#A71930', secondary: '#0B2265' }, conf: 'NFC', div: 'East',  r1pick: 5  },
  { id: 'CLE', espnId: 'cle', abbreviation: 'CLE', city: 'Cleveland',      nickname: 'Browns',     colors: { primary: '#FF3C00', secondary: '#311D00' }, conf: 'AFC', div: 'North', r1pick: 6  },
  { id: 'WAS', espnId: 'wsh', abbreviation: 'WAS', city: 'Washington',     nickname: 'Commanders', colors: { primary: '#5A1414', secondary: '#FFB612' }, conf: 'NFC', div: 'East',  r1pick: 7  },
  { id: 'NO',  espnId: 'no',  abbreviation: 'NO',  city: 'New Orleans',    nickname: 'Saints',     colors: { primary: '#D3BC8D', secondary: '#101820' }, conf: 'NFC', div: 'South', r1pick: 8  },
  { id: 'KC',  espnId: 'kc',  abbreviation: 'KC',  city: 'Kansas City',    nickname: 'Chiefs',     colors: { primary: '#E31837', secondary: '#FFB81C' }, conf: 'AFC', div: 'West',  r1pick: 9  },
  { id: 'CIN', espnId: 'cin', abbreviation: 'CIN', city: 'Cincinnati',     nickname: 'Bengals',    colors: { primary: '#FB4F14', secondary: '#000000' }, conf: 'AFC', div: 'North', r1pick: 10 },
  { id: 'MIA', espnId: 'mia', abbreviation: 'MIA', city: 'Miami',          nickname: 'Dolphins',   colors: { primary: '#008E97', secondary: '#FC4C02' }, conf: 'AFC', div: 'East',  r1pick: 11 },
  { id: 'DAL', espnId: 'dal', abbreviation: 'DAL', city: 'Dallas',         nickname: 'Cowboys',    colors: { primary: '#003594', secondary: '#869397' }, conf: 'NFC', div: 'East',  r1pick: 12 },
  { id: 'LAR', espnId: 'lar', abbreviation: 'LAR', city: 'Los Angeles',    nickname: 'Rams',       colors: { primary: '#003594', secondary: '#FFA300' }, conf: 'NFC', div: 'West',  r1pick: 13 },
  { id: 'BAL', espnId: 'bal', abbreviation: 'BAL', city: 'Baltimore',      nickname: 'Ravens',     colors: { primary: '#9E7C0C', secondary: '#241773' }, conf: 'AFC', div: 'North', r1pick: 14 },
  { id: 'TB',  espnId: 'tb',  abbreviation: 'TB',  city: 'Tampa Bay',      nickname: 'Buccaneers', colors: { primary: '#D50A0A', secondary: '#FF7900' }, conf: 'NFC', div: 'South', r1pick: 15 },
  { id: 'IND', espnId: 'ind', abbreviation: 'IND', city: 'Indianapolis',   nickname: 'Colts',      colors: { primary: '#003087', secondary: '#A2AAAD' }, conf: 'AFC', div: 'South', r1pick: 16 },
  { id: 'DET', espnId: 'det', abbreviation: 'DET', city: 'Detroit',        nickname: 'Lions',      colors: { primary: '#0076B6', secondary: '#B0B7BC' }, conf: 'NFC', div: 'North', r1pick: 17 },
  { id: 'MIN', espnId: 'min', abbreviation: 'MIN', city: 'Minnesota',      nickname: 'Vikings',    colors: { primary: '#4F2683', secondary: '#FFC62F' }, conf: 'NFC', div: 'North', r1pick: 18 },
  { id: 'CAR', espnId: 'car', abbreviation: 'CAR', city: 'Carolina',       nickname: 'Panthers',   colors: { primary: '#0085CA', secondary: '#101820' }, conf: 'NFC', div: 'South', r1pick: 19 },
  { id: 'PIT', espnId: 'pit', abbreviation: 'PIT', city: 'Pittsburgh',     nickname: 'Steelers',   colors: { primary: '#FFB612', secondary: '#101820' }, conf: 'AFC', div: 'North', r1pick: 21 },
  { id: 'LAC', espnId: 'lac', abbreviation: 'LAC', city: 'Los Angeles',    nickname: 'Chargers',   colors: { primary: '#0080C6', secondary: '#FFC20E' }, conf: 'AFC', div: 'West',  r1pick: 22 },
  { id: 'PHI', espnId: 'phi', abbreviation: 'PHI', city: 'Philadelphia',   nickname: 'Eagles',     colors: { primary: '#004C54', secondary: '#A5ACAF' }, conf: 'NFC', div: 'East',  r1pick: 23 },
  { id: 'CHI', espnId: 'chi', abbreviation: 'CHI', city: 'Chicago',        nickname: 'Bears',      colors: { primary: '#C83803', secondary: '#0B162A' }, conf: 'NFC', div: 'North', r1pick: 25 },
  { id: 'BUF', espnId: 'buf', abbreviation: 'BUF', city: 'Buffalo',        nickname: 'Bills',      colors: { primary: '#00338D', secondary: '#C60C30' }, conf: 'AFC', div: 'East',  r1pick: 26 },
  { id: 'SF',  espnId: 'sf',  abbreviation: 'SF',  city: 'San Francisco',  nickname: '49ers',      colors: { primary: '#AA0000', secondary: '#B3995D' }, conf: 'NFC', div: 'West',  r1pick: 27 },
  { id: 'HOU', espnId: 'hou', abbreviation: 'HOU', city: 'Houston',        nickname: 'Texans',     colors: { primary: '#A71930', secondary: '#03202F' }, conf: 'AFC', div: 'South', r1pick: 28 },
  { id: 'NE',  espnId: 'ne',  abbreviation: 'NE',  city: 'New England',    nickname: 'Patriots',   colors: { primary: '#C60C30', secondary: '#002244' }, conf: 'AFC', div: 'East',  r1pick: 31 },
  { id: 'SEA', espnId: 'sea', abbreviation: 'SEA', city: 'Seattle',        nickname: 'Seahawks',   colors: { primary: '#69BE28', secondary: '#002244' }, conf: 'NFC', div: 'West',  r1pick: 32 },
  // Teams with no Round 1 pick (sorted by city)
  { id: 'ATL', espnId: 'atl', abbreviation: 'ATL', city: 'Atlanta',        nickname: 'Falcons',    colors: { primary: '#A71930', secondary: '#000000' }, conf: 'NFC', div: 'South', r1pick: 99 },
  { id: 'DEN', espnId: 'den', abbreviation: 'DEN', city: 'Denver',         nickname: 'Broncos',    colors: { primary: '#FB4F14', secondary: '#002244' }, conf: 'AFC', div: 'West',  r1pick: 99 },
  { id: 'GB',  espnId: 'gb',  abbreviation: 'GB',  city: 'Green Bay',      nickname: 'Packers',    colors: { primary: '#203731', secondary: '#FFB612' }, conf: 'NFC', div: 'North', r1pick: 99 },
  { id: 'JAX', espnId: 'jax', abbreviation: 'JAX', city: 'Jacksonville',   nickname: 'Jaguars',    colors: { primary: '#006778', secondary: '#9F792C' }, conf: 'AFC', div: 'South', r1pick: 99 },
]

const SCREENS = {
  WELCOME: 'welcome',
  MODE: 'mode',
  TEAMS: 'teams',
  CONFIRM: 'confirm',
}

const MODES = [
  {
    id: 'single',
    label: 'Control Your Team',
    description: 'Pick one franchise and make every decision for your team throughout all 7 rounds.',
    badge: 'SINGLE TEAM',
  },
  {
    id: 'multi',
    label: 'Multi-Team Mode',
    description: 'Control any number of teams. Trade between them, manage multiple war rooms.',
    badge: 'ANY TEAMS',
  },
  {
    id: 'observe',
    label: 'Watch Full Auto-Sim',
    description: 'Sit back and watch the AI run the entire draft. Fast-forward anytime.',
    badge: 'OBSERVE',
  },
]

function getSortedTeams(sortBy) {
  const teams = [...TEAMS_DISPLAY]
  if (sortBy === 'pick')  return teams.sort((a, b) => a.r1pick - b.r1pick)
  if (sortBy === 'alpha') return teams.sort((a, b) => a.city.localeCompare(b.city))
  if (sortBy === 'conf') {
    return teams.sort((a, b) => {
      if (a.conf !== b.conf) return a.conf.localeCompare(b.conf)
      if (a.div  !== b.div)  return a.div.localeCompare(b.div)
      return a.r1pick - b.r1pick
    })
  }
  if (sortBy === 'div') {
    return teams.sort((a, b) => {
      if (a.div  !== b.div)  return a.div.localeCompare(b.div)
      if (a.conf !== b.conf) return a.conf.localeCompare(b.conf)
      return a.r1pick - b.r1pick
    })
  }
  return teams
}

export default function SessionSetup({ onStart, onPrivacy }) {
  const [screen, setScreen]           = useState(SCREENS.WELCOME)
  const [mode, setMode]               = useState(null)
  const [selectedIds, setSelectedIds] = useState([])
  const [leaving, setLeaving]         = useState(false)
  const [numRounds, setNumRounds]     = useState(7)
  const [teamSort, setTeamSort]       = useState('pick')

  const transition = (nextScreen) => {
    setLeaving(true)
    setTimeout(() => {
      setScreen(nextScreen)
      setLeaving(false)
    }, 280)
  }

  const handleModeSelect = (m) => {
    setMode(m)
    if (m === 'observe') {
      transition(SCREENS.CONFIRM)
    } else {
      setSelectedIds([])
      transition(SCREENS.TEAMS)
    }
  }

  const toggleTeam = (id) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id)
      if (mode === 'single') return [id]
      return [...prev, id]
    })
  }

  const selectAll = () => setSelectedIds(TEAMS_DISPLAY.map(t => t.id))
  const clearAll  = () => setSelectedIds([])

  const canProceedFromTeams = () => {
    if (mode === 'single') return selectedIds.length === 1
    if (mode === 'multi')  return selectedIds.length >= 2
    return true
  }

  const handleStart = () => {
    onStart({ mode, userTeamIds: selectedIds, numRounds })
  }

  const selectedTeams = TEAMS_DISPLAY.filter((t) => selectedIds.includes(t.id))

  return (
    <div className={styles.root}>
      {/* Atmospheric background layers */}
      <div className={styles.bgNoise} />
      <div className={styles.bgGradient} />
      <div className={styles.bgLines} />

      <div className={`${styles.screenWrap} ${leaving ? styles.leaving : styles.entering}`}>

        {/* ── WELCOME ── */}
        {screen === SCREENS.WELCOME && (
          <div className={styles.screen}>
            <div className={styles.welcomeInner}>
              <div className={styles.logoWrap}>
                <div className={styles.logoShield}>
                  <span className={styles.logoYear}>2026</span>
                  <span className={styles.logoNfl}>NFL</span>
                </div>
                <div className={styles.logoGlow} />
              </div>

              <div className={styles.titleBlock}>
                <p className={styles.titleEyebrow}>PRESENTED BY</p>
                <h1 className={styles.titleMain}>MOCK DRAFT</h1>
                <h2 className={styles.titleSub}>SIMULATOR</h2>
                <div className={styles.titleDivider} />
                <p className={styles.titleTagline}>257 PICKS · 32 TEAMS · 7 ROUNDS</p>
              </div>

              <button
                className={styles.beginBtn}
                onClick={() => transition(SCREENS.MODE)}
              >
                <span className={styles.beginBtnText}>BEGIN DRAFT</span>
                <span className={styles.beginBtnArrow}>→</span>
              </button>
            </div>
          </div>
        )}

        {/* ── MODE SELECTION ── */}
        {screen === SCREENS.MODE && (
          <div className={styles.screen}>
            <div className={styles.pageHeader}>
              <p className={styles.sectionEyebrow}>STEP 1 OF 2</p>
              <h2 className={styles.sectionTitle}>SELECT DRAFT MODE</h2>
              <div className={styles.sectionBar} />
            </div>

            <div className={styles.modeGrid}>
              {MODES.map((m) => (
                <button
                  key={m.id}
                  className={`${styles.modeCard} ${mode === m.id ? styles.modeCardActive : ''}`}
                  onClick={() => handleModeSelect(m.id)}
                >
                  <span className={styles.modeBadge}>{m.badge}</span>
                  <span className={styles.modeLabel}>{m.label}</span>
                  <span className={styles.modeDesc}>{m.description}</span>
                  <span className={styles.modeArrow}>→</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── TEAM SELECTION ── */}
        {screen === SCREENS.TEAMS && (
          <div className={styles.screen}>
            <div className={styles.pageHeader}>
              <p className={styles.sectionEyebrow}>
                {mode === 'single' ? 'SELECT YOUR FRANCHISE' : `SELECT TEAMS · ${selectedIds.length} OF 32 CHOSEN`}
              </p>
              <h2 className={styles.sectionTitle}>
                {mode === 'single' ? 'YOUR TEAM' : 'YOUR FRANCHISES'}
              </h2>
              <div className={styles.sectionBar} />
            </div>

            {/* Sort + bulk-action toolbar (multi only) */}
            {mode === 'multi' && (
              <div className={styles.teamToolbar}>
                <div className={styles.sortRow}>
                  <span className={styles.sortLabel}>SORT</span>
                  {SORT_OPTIONS.map(opt => (
                    <button
                      key={opt.id}
                      className={`${styles.sortBtn} ${teamSort === opt.id ? styles.sortBtnActive : ''}`}
                      onClick={() => setTeamSort(opt.id)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className={styles.bulkRow}>
                  <button className={styles.bulkBtn} onClick={selectAll}>SELECT ALL</button>
                  <button className={styles.bulkBtn} onClick={clearAll}>CLEAR</button>
                </div>
              </div>
            )}

            <div className={styles.teamGrid}>
              {getSortedTeams(mode === 'multi' ? teamSort : 'pick').map((team) => {
                const selected = selectedIds.includes(team.id)
                const selOrder = selectedIds.indexOf(team.id)
                return (
                  <button
                    key={team.id}
                    className={`${styles.teamCard} ${selected ? styles.teamCardSelected : ''}`}
                    style={{ '--team-primary': team.colors.primary }}
                    onClick={() => toggleTeam(team.id)}
                    aria-pressed={selected}
                  >
                    <span
                      className={styles.teamColorBar}
                      style={{ background: team.colors.primary }}
                    />
                    <img
                      className={styles.teamLogo}
                      src={`https://a.espncdn.com/i/teamlogos/nfl/500/${team.espnId || team.id.toLowerCase()}.png`}
                      alt={team.nickname}
                      onError={(e) => { e.currentTarget.style.display = 'none' }}
                    />
                    <span className={styles.teamAbbr}>{team.abbreviation}</span>
                    <span className={styles.teamNickname}>{team.nickname}</span>
                    {selected && mode === 'multi' && (
                      <span className={styles.teamSelectBadge}>{selOrder + 1}</span>
                    )}
                    {selected && (
                      <span className={styles.teamCheck} />
                    )}
                  </button>
                )
              })}
            </div>

            <div className={styles.teamFooter}>
              <button
                className={styles.backBtn}
                onClick={() => transition(SCREENS.MODE)}
              >
                ← BACK
              </button>
              <button
                className={styles.nextBtn}
                disabled={!canProceedFromTeams()}
                onClick={() => transition(SCREENS.CONFIRM)}
              >
                CONFIRM SELECTION →
              </button>
            </div>
          </div>
        )}

        {/* ── CONFIRM ── */}
        {screen === SCREENS.CONFIRM && (
          <div className={styles.screen}>
            <div className={styles.pageHeader}>
              <p className={styles.sectionEyebrow}>READY TO DRAFT</p>
              <h2 className={styles.sectionTitle}>DRAFT SETTINGS</h2>
              <div className={styles.sectionBar} />
            </div>

            <div className={styles.confirmCard}>
              {/* Rounds selector */}
              <div className={styles.confirmRow}>
                <span className={styles.confirmLabel}>ROUNDS</span>
                <div className={styles.roundsSelector}>
                  {[1, 2, 3, 4, 5, 6, 7].map(r => (
                    <button
                      key={r}
                      className={`${styles.roundBtn} ${numRounds === r ? styles.roundBtnActive : ''}`}
                      onClick={() => setNumRounds(r)}
                    >
                      {r === 7 ? 'ALL 7' : `R1${r > 1 ? `–${r}` : ''}`}
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.confirmRow}>
                <span className={styles.confirmLabel}>MODE</span>
                <span className={styles.confirmValue}>
                  {mode === 'single' ? 'Single Team Control' : mode === 'multi' ? 'Multi-Team Control' : 'Full Auto-Sim (Observe)'}
                </span>
              </div>

              {selectedTeams.length > 0 && (
                <div className={styles.confirmRow}>
                  <span className={styles.confirmLabel}>
                    {mode === 'single' ? 'YOUR TEAM' : 'YOUR TEAMS'}
                  </span>
                  <div className={styles.confirmTeams}>
                    {selectedTeams.map((team) => (
                      <div
                        key={team.id}
                        className={styles.confirmTeamChip}
                        style={{ '--team-primary': team.colors.primary }}
                      >
                        <span
                          className={styles.confirmTeamDot}
                          style={{ background: team.colors.primary }}
                        />
                        <span className={styles.confirmTeamText}>
                          {team.city} {team.nickname}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className={styles.confirmRow}>
                <span className={styles.confirmLabel}>TOTAL PICKS</span>
                <span className={styles.confirmValue}>
                  {numRounds === 7 ? '257' : numRounds === 1 ? '32' : `${numRounds} rounds`} picks · {numRounds} round{numRounds > 1 ? 's' : ''}
                </span>
              </div>
            </div>

            <div className={styles.confirmActions}>
              <button
                className={styles.backBtn}
                onClick={() => transition(mode === 'observe' ? SCREENS.MODE : SCREENS.TEAMS)}
              >
                ← BACK
              </button>
              <button className={styles.startBtn} onClick={handleStart}>
                <span className={styles.startBtnLabel}>START DRAFT</span>
                <span className={styles.startBtnSub}>GO ON THE CLOCK</span>
              </button>
            </div>
          </div>
        )}

      </div>

      {/* Site footer */}
      <div className={styles.siteFooter}>
        <span className={styles.footerText}>2026 NFL Mock Draft Simulator</span>
        <span className={styles.footerDot} />
        <button className={styles.footerLink} onClick={onPrivacy}>Privacy Policy</button>
      </div>
    </div>
  )
}
