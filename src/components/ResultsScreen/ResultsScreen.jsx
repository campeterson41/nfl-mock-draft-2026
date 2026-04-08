import { useState, useMemo, useRef } from 'react'
import { POSITIONS, POSITION_COLORS, POSITION_LABELS } from '../../constants/positions.js'
import { useDraft } from '../../context/DraftContext.jsx'
import styles from './ResultsScreen.module.css'

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
  const team   = pick.team
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
  const user    = teams[trade.userTeamId]
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

function AllPickRow({ pick, isUserPick }) {
  const player   = pick.player
  const team     = pick.team
  const posColor = POSITION_COLORS[player?.position] ?? '#666'
  const teamColor = team?.colors?.primary ?? 'transparent'

  return (
    <tr className={`${styles.tableRow} ${isUserPick ? styles.tableRowUser : ''}`}
        style={isUserPick ? { '--team-color': teamColor } : {}}>
      <td className={styles.tdOverall}>{pick.overall}</td>
      <td className={styles.tdRound}>R{pick.round}</td>
      <td className={styles.tdTeam}>
        <span className={styles.teamDot} style={{ background: teamColor }} />
        {team?.abbreviation ?? pick.teamId}
      </td>
      <td className={styles.tdName}>{player?.name ?? '—'}</td>
      <td className={styles.tdPos}>
        {player?.position && <PosPill position={player.position} />}
      </td>
      <td className={styles.tdSchool}>{player?.school ?? '—'}</td>
      <td className={styles.tdRank}>{player?.rank ? `#${player.rank}` : '—'}</td>
    </tr>
  )
}

// Off-screen panel rendered at fixed width for image capture
function SharePanel({ userPicks, tradeHistory, teams, panelRef }) {
  return (
    <div ref={panelRef} className={styles.sharePanel}>
      <div className={styles.sharePanelHeader}>
        <div className={styles.sharePanelEyebrow}>2026 NFL MOCK DRAFT</div>
        <div className={styles.sharePanelTitle}>MY DRAFT CLASS</div>
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
        {userPicks.map((pick) => {
          const player    = pick.player
          const team      = pick.team
          const teamColor = team?.colors?.primary ?? '#d4a843'
          const posColor  = POSITION_COLORS[player?.position] ?? '#555'
          return (
            <div key={pick.overall} className={styles.shareCard}
                 style={{ '--team-color': teamColor }}>
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
      const file = new File([blob], '2026-nfl-draft.png', { type: 'image/png' })

      // Try Web Share API first (works on mobile + some desktop)
      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: '2026 NFL Mock Draft' })
          resolve('shared')
          return
        } catch {}
      }

      // Fallback: download
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = '2026-nfl-draft.png'
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      resolve('downloaded')
    }, 'image/png')
  })
}

export default function ResultsScreen({ onResim, onNewSession }) {
  const { state, resetDraft } = useDraft()
  const picks          = state.picks ?? []
  const selectedPlayers = state.selectedPlayers ?? {}
  const teams          = state.teams ?? {}
  const userTeamIds    = state.session?.userTeamIds ?? []

  const tradeHistory = state.tradeHistory ?? []
  const [activeTab, setActiveTab]   = useState('yours')
  const [filterTeam, setFilterTeam] = useState('ALL')
  const [filterPos,  setFilterPos]  = useState('ALL')
  const [sharing, setSharing]       = useState(false)
  const sharePanelRef = useRef(null)

  function handleResim() {
    resetDraft()
    onResim?.()
  }

  async function handleShare() {
    if (!sharePanelRef.current || sharing) return
    setSharing(true)
    try {
      await captureAndShare(sharePanelRef)
    } catch {}
    setSharing(false)
  }

  const allCompletedPicks = useMemo(() => picks
    .filter(p => selectedPlayers[p.overall])
    .map(p => {
      const sp = selectedPlayers[p.overall]
      // Use teamId from state.picks (trade-updated) not from selectedPlayers
      const teamId = p.teamId
      return {
        ...p,
        player: sp?.player ?? null,
        reasoning: sp?.reasoning ?? null,
        team: teams[teamId] ?? null,
        teamId,
        isUserPick: userTeamIds.includes(teamId),
      }
    }), [picks, selectedPlayers, teams, userTeamIds])

  const userPicks = useMemo(
    () => allCompletedPicks.filter(p => userTeamIds.includes(p.teamId)),
    [allCompletedPicks, userTeamIds]
  )

  const filteredAllPicks = useMemo(() => allCompletedPicks.filter(p => {
    if (filterTeam !== 'ALL' && p.teamId !== filterTeam) return false
    if (filterPos  !== 'ALL' && p.player?.position !== filterPos) return false
    return true
  }), [allCompletedPicks, filterTeam, filterPos])

  const teamIds = Object.keys(teams).sort()

  return (
    <div className={styles.screen}>

      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.headerLeft}>
            <span className={styles.eyebrow}>2026 NFL DRAFT</span>
            <h1 className={styles.headline}>DRAFT COMPLETE</h1>
            <p className={styles.subline}>
              {allCompletedPicks.length} picks · {userPicks.length} for your team{userTeamIds.length > 1 ? 's' : ''}
            </p>
          </div>
          <div className={styles.headerActions}>
            <button className={styles.btnOutline} onClick={onNewSession}>NEW SESSION</button>
            {userPicks.length > 0 && (
              <button className={styles.btnShare} onClick={handleShare} disabled={sharing}>
                {sharing ? 'GENERATING...' : 'SHARE PICKS'}
              </button>
            )}
            <button className={styles.btnGold} onClick={handleResim}>RE-SIM</button>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className={styles.tabBar}>
        <button
          className={`${styles.tab} ${activeTab === 'yours' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('yours')}
        >
          {userTeamIds.length > 1 ? 'YOUR TEAMS' : 'YOUR PICKS'}
          <span className={styles.tabBadge}>{userPicks.length}</span>
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'all' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('all')}
        >
          ALL PICKS
          <span className={styles.tabBadge}>{allCompletedPicks.length}</span>
        </button>
      </div>

      {/* Content */}
      <div className={styles.content}>

        {activeTab === 'yours' && (
          userPicks.length === 0 && tradeHistory.length === 0 ? (
            <div className={styles.empty}>No picks were made for your team.</div>
          ) : (
            <>
              {tradeHistory.length > 0 && (
                <div className={styles.tradeSection}>
                  <h3 className={styles.tradeSectionTitle}>TRADES</h3>
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
            </>
          )
        )}

        {activeTab === 'all' && (
          <div className={styles.allPicks}>
            <div className={styles.filters}>
              <select className={styles.filterSelect} value={filterTeam}
                onChange={e => setFilterTeam(e.target.value)}>
                <option value="ALL">All Teams</option>
                {teamIds.map(id => (
                  <option key={id} value={id}>{teams[id]?.abbreviation ?? id}</option>
                ))}
              </select>
              <select className={styles.filterSelect} value={filterPos}
                onChange={e => setFilterPos(e.target.value)}>
                <option value="ALL">All Positions</option>
                {POSITIONS.map(p => (
                  <option key={p} value={p}>{p} — {POSITION_LABELS[p]}</option>
                ))}
              </select>
              {(filterTeam !== 'ALL' || filterPos !== 'ALL') && (
                <button className={styles.clearBtn}
                  onClick={() => { setFilterTeam('ALL'); setFilterPos('ALL') }}>
                  Clear
                </button>
              )}
              <span className={styles.filterCount}>
                {filteredAllPicks.length} of {allCompletedPicks.length}
              </span>
            </div>

            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>#</th><th>RD</th><th>TEAM</th>
                    <th>PLAYER</th><th>POS</th><th>SCHOOL</th><th>RANK</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAllPicks.map(pick => (
                    <AllPickRow key={pick.overall} pick={pick}
                      isUserPick={userTeamIds.includes(pick.teamId)} />
                  ))}
                  {filteredAllPicks.length === 0 && (
                    <tr><td colSpan={7} className={styles.noResults}>No picks match your filters.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Hidden share panel — positioned off-screen, captured by html2canvas */}
      <SharePanel userPicks={userPicks} tradeHistory={tradeHistory} teams={teams} panelRef={sharePanelRef} />

    </div>
  )
}
