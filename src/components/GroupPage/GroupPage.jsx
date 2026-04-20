import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getGroup, getActuals } from '../../lib/groupApi.js'
import teamsData from '../../data/teams.json'
import playersData from '../../data/players.json'
import { rankSubmissions } from '../../lib/scoring.js'
import GroupLeaderboard from './GroupLeaderboard.jsx'
import styles from './GroupPage.module.css'

// Mirror the ESPN CDN helper used elsewhere in the app
function getEspnLogoUrl(teamId) {
  if (!teamId) return null
  const espnId = teamId.toLowerCase() === 'was' ? 'wsh' : teamId.toLowerCase()
  return `https://a.espncdn.com/i/teamlogos/nfl/500/${espnId}.png`
}

export default function GroupPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [group, setGroup] = useState(null)
  const [actuals, setActuals] = useState({ lastUpdated: null, picks: {}, trades: [] })
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [joinName, setJoinName] = useState('')
  const [joining, setJoining] = useState(false)
  const [copied, setCopied] = useState(false)
  const [scoringOpen, setScoringOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        // Fetch group + actuals in parallel — actuals are global, not per-group.
        const [groupDoc, actualsDoc] = await Promise.all([
          getGroup(id),
          getActuals().catch(() => ({ lastUpdated: null, picks: {}, trades: [] })),
        ])
        if (!cancelled) {
          setGroup(groupDoc)
          setActuals(actualsDoc)
        }
      } catch (err) {
        if (!cancelled) setError(err?.message ?? 'Could not load group')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [id])

  const team = group ? teamsData[group.teamId] : null
  const logoUrl = group ? getEspnLogoUrl(group.teamId) : null
  const teamColor = team?.colors?.primary ?? '#d4a843'

  // Draft is "live" (post-draft scoring) when actuals has real picks/trades.
  // Empty pick skeletons (teamId only, no playerId) don't count — the admin
  // UI seeds them as placeholders before the draft actually starts.
  const draftStarted = useMemo(() => {
    const hasRealPick = Object.values(actuals?.picks ?? {}).some(p => p?.playerId)
    const tradeCount = (actuals?.trades ?? []).length
    return hasRealPick || tradeCount > 0
  }, [actuals])

  const ranked = useMemo(() => {
    if (!group || !draftStarted) return []
    return rankSubmissions(group.submissions ?? [], actuals, playersData, group.teamId)
  }, [group, draftStarted, actuals])

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  function handleJoin() {
    const name = joinName.trim()
    if (!name || joining) return
    setJoining(true)
    // Redirect into the predictive mock with the group context embedded
    const params = new URLSearchParams({
      group: group.id,
      name,
      team: group.teamId,
    })
    navigate(`/?${params.toString()}`)
  }

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.centerMsg}>Loading group…</div>
      </div>
    )
  }

  if (error || !group) {
    return (
      <div className={styles.page}>
        <div className={styles.centerMsg}>
          <h2 className={styles.errorTitle}>Group not found</h2>
          <p className={styles.errorBody}>{error ?? 'This group doesn\'t exist or was removed.'}</p>
          <button className={styles.primaryBtn} onClick={() => navigate('/')}>
            BACK TO HOME
          </button>
        </div>
      </div>
    )
  }

  const members = group.submissions ?? []
  const alreadyJoined = joinName.trim()
    ? members.some(m => (m.name ?? '').toLowerCase() === joinName.trim().toLowerCase())
    : false

  return (
    <div className={styles.page}>
      <div className={styles.pageInner}>
        <header className={styles.header} style={{ '--team-color': teamColor }}>
          {logoUrl && (
            <img
              className={styles.logo}
              src={logoUrl}
              alt={team?.nickname}
              onError={(e) => { e.currentTarget.style.display = 'none' }}
            />
          )}
          <div className={styles.headerText}>
            <p className={styles.eyebrow}>PREDICTIVE MOCK · GROUP</p>
            <h1 className={styles.title}>{group.name}</h1>
            <p className={styles.subtitle}>
              {team?.city} {team?.nickname} · {members.length} member{members.length === 1 ? '' : 's'}
            </p>
            <p className={styles.commissioner}>Commissioner: {group.commissionerName}</p>
          </div>

          <div className={styles.headerActions}>
            <button className={styles.secondaryBtn} onClick={copyLink}>
              {copied ? 'COPIED ✓' : 'COPY LINK'}
            </button>
          </div>
        </header>

        {draftStarted ? (
          <>
            <div className={styles.lockBanner}>
              <span className={styles.lockBadge}>LOCKED</span>
              <span className={styles.lockText}>
                The draft has started — submissions are closed. All predictions are final.
              </span>
            </div>
            <GroupLeaderboard ranked={ranked} team={team} actuals={actuals} />
          </>
        ) : (
          <>
            {/* Join section */}
            <section className={styles.joinSection}>
              <h2 className={styles.sectionTitle}>JOIN THE GROUP</h2>
              <p className={styles.sectionIntro}>
                Enter your name, then predict every pick the {team?.nickname} make across all 7 rounds. After the real draft, scores go live on this page.
              </p>
              <div className={styles.joinRow}>
                <input
                  type="text"
                  className={styles.joinInput}
                  placeholder="Your name"
                  value={joinName}
                  onChange={e => setJoinName(e.target.value)}
                  maxLength={40}
                  onKeyDown={e => e.key === 'Enter' && handleJoin()}
                />
                <button
                  className={styles.primaryBtn}
                  onClick={handleJoin}
                  disabled={!joinName.trim() || joining}
                >
                  {joining ? 'LOADING…' : alreadyJoined ? 'UPDATE MY PICKS' : 'START PREDICTING'}
                </button>
              </div>
              {alreadyJoined && (
                <p className={styles.joinHint}>
                  You&apos;ve already submitted as &quot;{joinName.trim()}&quot; — starting again will replace your existing predictions.
                </p>
              )}
            </section>

            {/* Member list */}
            <section className={styles.membersSection}>
              <h2 className={styles.sectionTitle}>MEMBERS ({members.length})</h2>
              <p className={styles.sectionIntro}>
                Everyone&apos;s full mock stays hidden until the real draft kicks off — then the leaderboard unlocks and you can see what each member predicted.
              </p>
              {members.length === 0 ? (
                <p className={styles.empty}>No submissions yet. Be the first!</p>
              ) : (
                <ul className={styles.memberList}>
                  {members.map((m) => {
                    const pickCount = Object.keys(m.picks ?? {}).length
                    const submittedDate = m.submittedAt ? new Date(m.submittedAt).toLocaleDateString() : ''
                    return (
                      <li key={m.name} className={styles.memberRow}>
                        <span className={styles.memberName}>{m.name}</span>
                        <span className={styles.memberStatus}>
                          {pickCount} pick{pickCount === 1 ? '' : 's'}
                          {m.trades?.length > 0 && ` · ${m.trades.length} trade${m.trades.length === 1 ? '' : 's'}`}
                        </span>
                        <span className={styles.memberDate}>{submittedDate}</span>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          </>
        )}

        {/* Scoring disclosure — collapsible, visible in both pre/post-draft states */}
        <section className={styles.scoringSection}>
          <button
            className={styles.scoringToggle}
            onClick={() => setScoringOpen(o => !o)}
            aria-expanded={scoringOpen}
          >
            <span>HOW SCORING WORKS</span>
            <span className={styles.scoringChevron}>{scoringOpen ? '▴' : '▾'}</span>
          </button>
          {scoringOpen && (
            <div className={styles.scoringBody}>
              <p className={styles.scoringIntro}>
                After the real draft, every submission is scored automatically. Getting anything right is a feat — the points are fairly even across the board, with later rounds worth a little more since they're harder to predict.
              </p>

              <div className={styles.scoringBlock}>
                <h4 className={styles.scoringTitle}>Exact player at exact pick</h4>
                <div className={styles.scoringGrid}>
                  <span>Round 1</span><span>10 pts</span>
                  <span>Round 2</span><span>12 pts</span>
                  <span>Round 3</span><span>14 pts</span>
                  <span>Round 4</span><span>16 pts</span>
                  <span>Round 5</span><span>18 pts</span>
                  <span>Round 6</span><span>20 pts</span>
                  <span>Round 7</span><span>22 pts</span>
                </div>
              </div>

              <div className={styles.scoringBlock}>
                <h4 className={styles.scoringTitle}>Right player, different slot (same team)</h4>
                <p className={styles.scoringPlain}>
                  If the team actually did pick the player you predicted, just at a different pick (e.g. they traded back a couple spots), you still earn partial credit:
                </p>
                <ul className={styles.scoringList}>
                  <li>Same round as you predicted: <strong>50%</strong> of that round&apos;s base points</li>
                  <li>One round off (e.g. predicted R2, they took him in R3): <strong>25%</strong> of the base points</li>
                </ul>
              </div>

              <div className={styles.scoringBlock}>
                <h4 className={styles.scoringTitle}>Right position, wrong player</h4>
                <p className={styles.scoringPlain}>
                  Flat <strong>3 pts</strong> — small credit for reading the team&apos;s target area correctly.
                </p>
              </div>

              <div className={styles.scoringBlock}>
                <h4 className={styles.scoringTitle}>Trade predictions</h4>
                <p className={styles.scoringPlain}>
                  A predicted trade scores against the real trade it best matches — but only if at least one pick you said you&apos;d <em>give up</em> actually got traded (within 5 picks). No overlap on the given side? The prediction earns 0 pts.
                </p>
                <ul className={styles.scoringList}>
                  <li>Called that a specific pick got traded: <strong>8 pts</strong></li>
                  <li>Correct partner team: <strong>+4 pts</strong></li>
                  <li>Correct direction (trade up vs back): <strong>+3 pts</strong></li>
                  <li>Exact match on a pick you said you&apos;d <em>receive</em>: <strong>+8 pts per pick</strong></li>
                  <li>Close match on a received pick (within 5 picks): <strong>+3 pts per pick</strong></li>
                </ul>
                <p className={styles.scoringFootnote}>
                  Each predicted trade is matched to its best-matching actual trade so you can&apos;t double-dip on the same deal.
                </p>
              </div>
            </div>
          )}
        </section>

        <footer className={styles.footer}>nfldraftmock.com</footer>
      </div>
    </div>
  )
}
