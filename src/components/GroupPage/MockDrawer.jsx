import { useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import playersData from '../../data/players.json'
import teamsData from '../../data/teams.json'
import styles from './MockDrawer.module.css'

const PLAYER_MAP = Object.fromEntries(playersData.map(p => [p.id, p]))

function roundOf(overall) {
  if (overall <= 32)  return 1
  if (overall <= 64)  return 2
  if (overall <= 102) return 3
  if (overall <= 138) return 4
  if (overall <= 176) return 5
  if (overall <= 221) return 6
  return 7
}

function roundLabel(overall) {
  return 'R' + roundOf(overall)
}

function playerLine(id) {
  const p = PLAYER_MAP[id]
  if (!p) return id
  return `${p.name} · ${p.position}`
}

function ScorePill({ type, children }) {
  return <span className={`${styles.pill} ${styles['pill_' + type]}`}>{children}</span>
}

function BreakdownLine({ line }) {
  if (line.type === 'exact') {
    const player = PLAYER_MAP[line.actualPlayerId]
    return (
      <div className={`${styles.bline} ${styles.bline_exact}`}>
        <span className={styles.btag}>EXACT</span>
        <span className={styles.bmeta}>#{line.overall}</span>
        <span className={styles.btext}>{player?.name ?? line.actualPlayerId}</span>
        <span className={styles.bpts}>+{line.points}</span>
      </div>
    )
  }
  if (line.type === 'near') {
    const player = PLAYER_MAP[line.predictedPlayerId]
    const label = line.reason === 'same-round'
      ? `team took him same round (#${line.actualOverall})`
      : `team took him R${line.actualRound} (#${line.actualOverall})`
    return (
      <div className={`${styles.bline} ${styles.bline_near}`}>
        <span className={styles.btag}>CLOSE</span>
        <span className={styles.bmeta}>#{line.overall}</span>
        <span className={styles.btext}>{player?.name ?? line.predictedPlayerId} — {label}</span>
        <span className={styles.bpts}>+{line.points}</span>
      </div>
    )
  }
  if (line.type === 'position') {
    return (
      <div className={`${styles.bline} ${styles.bline_pos}`}>
        <span className={styles.btag}>POS</span>
        <span className={styles.bmeta}>#{line.overall}</span>
        <span className={styles.btext}>Right position ({line.position}), wrong player</span>
        <span className={styles.bpts}>+{line.points}</span>
      </div>
    )
  }
  if (line.type === 'trade') {
    const d = line.detail ?? {}
    const parts = []
    if (d.pickMoved)  parts.push('called the trade')
    if (d.partner)    parts.push('right partner')
    if (d.direction)  parts.push('right direction')
    if (d.recvExact)  parts.push(`exact received pick${d.recvExact > 8 ? 's' : ''}`)
    if (d.recvNear)   parts.push('close on received pick')
    return (
      <div className={`${styles.bline} ${styles.bline_trade}`}>
        <span className={styles.btag}>TRADE</span>
        <span className={styles.bmeta}>trade #{line.actualTradeIdx + 1}</span>
        <span className={styles.btext}>{parts.join(' · ')}</span>
        <span className={styles.bpts}>+{line.points}</span>
      </div>
    )
  }
  return null
}

export default function MockDrawer({ submission, score, rank, open, onClose, actuals, teamId, draftStarted }) {
  // Index user-team's actual picks by round so we can show "what your team
  // really did this round" when the predicted slot ended up belonging to
  // someone else (e.g. user predicted a trade-back that didn't happen).
  const userTeamPicksByRound = useMemo(() => {
    if (!actuals?.picks || !teamId) return {}
    const byRound = {}
    for (const [overallStr, pick] of Object.entries(actuals.picks)) {
      if (!pick?.playerId || pick?.teamId !== teamId) continue
      const r = roundOf(Number(overallStr))
      if (!byRound[r]) byRound[r] = []
      byRound[r].push({ overall: Number(overallStr), playerId: pick.playerId })
    }
    return byRound
  }, [actuals, teamId])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Lock body scroll while open
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!submission) return null

  const picks = submission.picks ?? {}
  const trades = submission.trades ?? []
  const pickEntries = Object.entries(picks)
    .map(([o, pid]) => ({ overall: Number(o), playerId: pid }))
    .sort((a, b) => a.overall - b.overall)

  const breakdown = score?.breakdown ?? []
  const hasScore = draftStarted && breakdown.length > 0

  // Summary pills
  let exact = 0, near = 0, position = 0, tradeCount = 0
  for (const l of breakdown) {
    if (l.type === 'exact')    exact++
    else if (l.type === 'near')     near++
    else if (l.type === 'position') position++
    else if (l.type === 'trade')    tradeCount++
  }

  const content = (
    <>
      {/* Backdrop */}
      <div
        className={`${styles.backdrop} ${open ? styles.backdropOpen : ''}`}
        onClick={onClose}
        aria-hidden
      />

      {/* Drawer */}
      <aside className={`${styles.drawer} ${open ? styles.drawerOpen : ''}`} aria-label="Member mock">
        {/* Header */}
        <div className={styles.drawerHead}>
          <div className={styles.drawerHeadLeft}>
            {rank != null && <span className={styles.drawerRank}>#{rank}</span>}
            <div>
              <div className={styles.drawerName}>{submission.name}</div>
              {draftStarted && score != null && (
                <div className={styles.drawerScore}>{score.total} pts</div>
              )}
              {!draftStarted && (
                <div className={styles.drawerScorePending}>Draft not started yet</div>
              )}
            </div>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">✕</button>
        </div>

        {/* Score pills */}
        {draftStarted && (exact + near + position + tradeCount) > 0 && (
          <div className={styles.pills}>
            {exact > 0     && <ScorePill type="exact">{exact} exact</ScorePill>}
            {near > 0      && <ScorePill type="near">{near} close</ScorePill>}
            {position > 0  && <ScorePill type="pos">{position} pos match</ScorePill>}
            {tradeCount > 0 && <ScorePill type="trade">{tradeCount} trade</ScorePill>}
          </div>
        )}

        <div className={styles.drawerBody}>

          {/* Points breakdown */}
          {hasScore && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>POINTS EARNED</div>
              <div className={styles.breakdownList}>
                {breakdown.map((line, i) => <BreakdownLine key={i} line={line} />)}
              </div>
            </div>
          )}

          {/* Picks */}
          {pickEntries.length > 0 && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>
                PREDICTED PICKS ({pickEntries.length})
              </div>
              <div className={styles.pickList}>
                {pickEntries.map(({ overall, playerId }) => {
                  const slotPick = actuals?.picks?.[String(overall)]
                  const slotIsUserTeam = !teamId || slotPick?.teamId === teamId
                  const isExact = slotPick?.playerId === playerId && slotIsUserTeam
                  const isNear = breakdown.some(
                    l => l.type === 'near' && l.overall === overall
                  )

                  // What to show as "ACTUAL":
                  // 1) Predicted slot was actually made by user's team → show it.
                  // 2) Otherwise pick the user's team's actual pick in the same
                  //    round as the prediction, closest by overall slot.
                  // 3) If the team has no pick that round, show "no pick this round".
                  let actualDisplay = null
                  if (slotPick?.playerId && slotIsUserTeam) {
                    actualDisplay = { playerId: slotPick.playerId, overall, sameSlot: true }
                  } else if (teamId) {
                    const r = roundOf(overall)
                    const teamPicks = userTeamPicksByRound[r] ?? []
                    if (teamPicks.length > 0) {
                      const closest = [...teamPicks].sort(
                        (a, b) => Math.abs(a.overall - overall) - Math.abs(b.overall - overall)
                      )[0]
                      actualDisplay = { playerId: closest.playerId, overall: closest.overall, sameSlot: false }
                    }
                  }

                  return (
                    <div
                      key={overall}
                      className={`${styles.pickRow} ${isExact ? styles.pickRowExact : isNear ? styles.pickRowNear : ''}`}
                    >
                      <div className={styles.pickSlot}>
                        <span className={styles.pickRound}>{roundLabel(overall)}</span>
                        <span className={styles.pickNum}>#{overall}</span>
                      </div>
                      <div className={styles.pickPred}>
                        <span className={styles.pickPredLabel}>PREDICTED</span>
                        {playerLine(playerId)}
                      </div>
                      {draftStarted && (
                        <div className={`${styles.pickActual} ${isExact ? styles.pickActualHit : ''}`}>
                          {actualDisplay
                            ? <>
                                <span className={styles.pickActualLabel}>
                                  {actualDisplay.sameSlot ? 'ACTUAL' : `ACTUAL · #${actualDisplay.overall}`}
                                </span>
                                {playerLine(actualDisplay.playerId)}
                              </>
                            : <span className={styles.pickPending}>
                                {teamId ? 'no pick this round' : '—'}
                              </span>
                          }
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Trades */}
          {trades.length > 0 && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>PREDICTED TRADES ({trades.length})</div>
              <div className={styles.tradeList}>
                {trades.map((t, i) => {
                  const partner = teamsData[t.partnerId]
                  const partnerLabel = partner ? partner.abbreviation : (t.partnerId || '?')
                  const gaveList = (t.gave?.pickOveralls ?? []).map(n => `#${n}`).join(', ') || '—'
                  const recvList = (t.received?.pickOveralls ?? []).map(n => `#${n}`).join(', ') || '—'
                  return (
                    <div key={i} className={styles.tradeCard}>
                      <span className={styles.tradeLabel}>TRADE {i + 1}</span>
                      <span className={styles.tradeWith}>with {partnerLabel}</span>
                      <span className={styles.tradeDetail}>gave {gaveList} · got {recvList}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {pickEntries.length === 0 && trades.length === 0 && (
            <p className={styles.empty}>No predictions submitted.</p>
          )}

        </div>
      </aside>
    </>
  )

  return createPortal(content, document.body)
}
