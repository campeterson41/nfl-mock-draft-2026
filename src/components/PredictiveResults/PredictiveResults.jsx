import { useState, useMemo, useRef } from 'react'
import { POSITION_COLORS } from '../../constants/positions.js'
import styles from './PredictiveResults.module.css'

function PosPill({ position }) {
  const color = POSITION_COLORS[position] ?? '#4a4d66'
  return (
    <span className={styles.posPill} style={{ background: color }}>
      {position}
    </span>
  )
}

function UserPickCard({ pick, index }) {
  const player = pick.player
  const team = pick.team
  if (!player) return null

  const teamColor = team?.colors?.primary ?? '#c9a227'

  return (
    <div
      className={styles.pickCard}
      style={{ '--team-color': teamColor, animationDelay: `${index * 40}ms` }}
    >
      <div className={styles.pickCardStripe} />
      <div className={styles.pickCardTop}>
        <div className={styles.pickMeta}>
          <span className={styles.pickRound}>RD {pick.round}</span>
          <span className={styles.pickDot} />
          <span className={styles.pickOverall}>#{pick.overall}</span>
        </div>
        <span className={styles.pickTeam} style={{ color: teamColor }}>
          {team?.abbreviation ?? pick.teamId}
        </span>
      </div>
      <div className={styles.pickCardBody}>
        <h3 className={styles.pickName}>{player.name}</h3>
        <p className={styles.pickSchool}>{player.school}</p>
      </div>
      <div className={styles.pickCardFooter}>
        <PosPill position={player.position} />
        {player.rank && (
          <span className={styles.pickRank}>#{player.rank} overall</span>
        )}
      </div>
    </div>
  )
}

function TradeCard({ trade, teams, index }) {
  const partner = teams[trade.targetTeamId]
  const partnerColor = partner?.colors?.primary ?? '#52525b'

  return (
    <div className={styles.tradeCard} style={{ animationDelay: `${index * 40}ms` }}>
      <div className={styles.tradeCardHeader}>
        <span className={styles.tradeLabel}>TRADE</span>
        <span className={styles.tradePartner} style={{ color: partnerColor }}>
          with {partner?.abbreviation ?? trade.targetTeamId}
        </span>
      </div>
      <div className={styles.tradeCardBody}>
        <div className={styles.tradeSide}>
          <span className={styles.tradeSideLabel}>GAVE</span>
          {trade.gave.pickOveralls.map(o => (
            <span key={o} className={styles.tradePick}>#{o}</span>
          ))}
          {trade.gave.futurePickIds.map(id => (
            <span key={id} className={styles.tradePick}>Future</span>
          ))}
        </div>
        <div className={styles.tradeArrow}>-&gt;</div>
        <div className={styles.tradeSide}>
          <span className={styles.tradeSideLabel}>GOT</span>
          {trade.received.pickOveralls.map(o => (
            <span key={o} className={styles.tradePick}>#{o}</span>
          ))}
          {trade.received.futurePickIds.map(id => (
            <span key={id} className={styles.tradePick}>Future</span>
          ))}
        </div>
      </div>
    </div>
  )
}

function SharePanel({ userPicks, tradeHistory, teams, panelRef }) {
  return (
    <div ref={panelRef} className={styles.sharePanel}>
      <div className={styles.sharePanelHeader}>
        <div className={styles.sharePanelEyebrow}>2026 NFL PREDICTIVE DRAFT</div>
        <div className={styles.sharePanelTitle}>MY PREDICTIONS</div>
        <div className={styles.sharePanelCount}>{userPicks.length} picks</div>
      </div>
      {tradeHistory.length > 0 && (
        <div className={styles.shareTradeRow}>
          {tradeHistory.map((t, i) => {
            const partner = teams[t.targetTeamId]
            return (
              <div key={i} className={styles.shareTradeItem}>
                <span className={styles.shareTradeLabel}>TRADE</span>
                <span className={styles.shareTradeSummary}>
                  Gave {t.gave.pickOveralls.map(o => '#' + o).join(', ')}
                  {t.gave.futurePickIds.length > 0 ? ' + future' : ''}
                  {' -> Got '}
                  {t.received.pickOveralls.map(o => '#' + o).join(', ')}
                  {t.received.futurePickIds.length > 0 ? ' + future' : ''}
                  {' (with ' + (partner?.abbreviation ?? t.targetTeamId) + ')'}
                </span>
              </div>
            )
          })}
        </div>
      )}
      <div className={styles.sharePanelGrid}>
        {userPicks.map(pick => {
          const player = pick.player
          const team = pick.team
          const teamColor = team?.colors?.primary ?? '#d4a843'
          const posColor = POSITION_COLORS[player?.position] ?? '#555'
          return (
            <div key={pick.overall} className={styles.shareCard} style={{ '--team-color': teamColor }}>
              <div className={styles.shareCardStripe} />
              <div className={styles.shareCardTop}>
                <span className={styles.shareCardMeta}>R{pick.round} · #{pick.overall}</span>
                <span className={styles.shareCardTeam} style={{ color: teamColor }}>
                  {team?.abbreviation ?? pick.teamId}
                </span>
              </div>
              <div className={styles.shareCardName}>{player?.name}</div>
              <div className={styles.shareCardBottom}>
                <span className={styles.shareCardPos} style={{ background: posColor }}>
                  {player?.position}
                </span>
                <span className={styles.shareCardSchool}>{player?.school}</span>
                {player?.rank && (
                  <span className={styles.shareCardRank}>#{player.rank}</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
      <div className={styles.sharePanelFooter}>nfldraftmock.com</div>
    </div>
  )
}

async function captureAndShare(panelRef) {
  const { default: html2canvas } = await import('html2canvas')
  const canvas = await html2canvas(panelRef.current, {
    backgroundColor: '#09090b',
    scale: 2,
    useCORS: true,
    logging: false,
  })

  return new Promise((resolve) => {
    canvas.toBlob(async (blob) => {
      const file = new File([blob], '2026-nfl-predictive-draft.png', { type: 'image/png' })
      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: '2026 NFL Predictive Draft' })
          resolve('shared')
          return
        } catch {}
      }
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = '2026-nfl-predictive-draft.png'
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      resolve('downloaded')
    }, 'image/png')
  })
}

export default function PredictiveResults({ predictiveResult, onNewSession }) {
  const { teamId, assignments, tradeHistory, teams, teamPicks } = predictiveResult
  const [sharing, setSharing] = useState(false)
  const sharePanelRef = useRef(null)

  const team = teams[teamId]

  const userPicks = useMemo(() =>
    teamPicks.map(pick => ({
      ...pick,
      player: assignments[pick.overall] ?? null,
      team,
      teamId,
    })),
    [teamPicks, assignments, team, teamId]
  )

  async function handleShare() {
    if (!sharePanelRef.current || sharing) return
    setSharing(true)
    try { await captureAndShare(sharePanelRef) } catch {}
    setSharing(false)
  }

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.headerLeft}>
            <span className={styles.eyebrow}>PREDICTIVE DRAFT</span>
            <h1 className={styles.headline}>YOUR PREDICTIONS</h1>
            <p className={styles.subline}>
              {userPicks.length} picks for the {team?.city} {team?.nickname}
            </p>
          </div>
          <div className={styles.headerActions}>
            <button className={styles.btnOutline} onClick={onNewSession}>NEW SESSION</button>
            <button className={styles.btnShare} onClick={handleShare} disabled={sharing}>
              {sharing ? 'GENERATING...' : 'SHARE PICKS'}
            </button>
          </div>
        </div>
      </header>

      <div className={styles.content}>
        {tradeHistory.length > 0 && (
          <div className={styles.tradeSection}>
            <h3 className={styles.tradeSectionTitle}>PREDICTED TRADES</h3>
            <div className={styles.tradeGrid}>
              {tradeHistory.map((t, i) => (
                <TradeCard key={i} trade={t} teams={teams} index={i} />
              ))}
            </div>
          </div>
        )}
        <div className={styles.pickGrid}>
          {userPicks.map((pick, i) => (
            <UserPickCard key={pick.overall} pick={pick} index={i} />
          ))}
        </div>
      </div>

      <SharePanel
        userPicks={userPicks}
        tradeHistory={tradeHistory}
        teams={teams}
        panelRef={sharePanelRef}
      />
    </div>
  )
}
