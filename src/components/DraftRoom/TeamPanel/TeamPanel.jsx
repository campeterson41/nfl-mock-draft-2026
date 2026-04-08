import { useMemo } from 'react'
import { POSITION_COLORS, POSITION_LABELS } from '../../../constants/positions.js'
import styles from './TeamPanel.module.css'

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

function ordinal(n) {
  const v = n % 100
  const s = ['th', 'st', 'nd', 'rd']
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

function hexToRgb(hex) {
  const clean = hex.replace('#', '')
  const num = parseInt(clean, 16)
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  }
}

/* ─── Sub-components ──────────────────────────────────────────────────────── */

function PickedPlayerRow({ pick, player, isLatest }) {
  const posColor = POSITION_COLORS[player.position] ?? '#666'
  return (
    <div className={`${styles.pickedRow} ${isLatest ? styles.pickedRowLatest : ''}`}>
      <div className={styles.pickNumber}>
        <span className={styles.pickRd}>R{pick.round}</span>
        <span className={styles.pickNum}>#{pick.overall}</span>
      </div>
      <div className={styles.playerBlock}>
        <span
          className={styles.posTag}
          style={{ background: posColor }}
        >
          {player.position}
        </span>
        <span className={styles.playerName}>{player.name}</span>
      </div>
      {isLatest && <span className={styles.newBadge}>NEW</span>}
    </div>
  )
}

function NeedBadge({ position }) {
  const color = POSITION_COLORS[position] ?? '#555'
  return (
    <span
      className={styles.needBadge}
      style={{ '--pos-color': color }}
      title={POSITION_LABELS[position] ?? position}
    >
      {position}
    </span>
  )
}

function UpcomingPickRow({ pick, index, isOnClock }) {
  return (
    <div className={`${styles.upcomingRow} ${isOnClock ? styles.upcomingRowNext : ''}`}>
      <div className={styles.upcomingPickDot} />
      <div className={styles.upcomingInfo}>
        <span className={styles.upcomingRound}>
          {ordinal(pick.round)} Round
        </span>
        <span className={styles.upcomingPick}>
          Pick #{pick.overall} &nbsp;·&nbsp; #{pick.roundPick} of round
        </span>
      </div>
      {isOnClock && (
        <span className={styles.onClockLabel}>ON THE CLOCK</span>
      )}
    </div>
  )
}

/* ─── TeamPanel ──────────────────────────────────────────────────────────── */

export default function TeamPanel({
  team,
  userPicks,
  selectedPlayers,
  isUserTurn = false,
  remainingNeeds,
  currentRound,
}) {
  if (!team) return null

  const primaryColor = team.colors?.primary ?? '#c9a227'
  const secondaryColor = team.colors?.secondary ?? '#ffffff'
  const { r, g, b } = hexToRgb(primaryColor)

  // Picks the user has already made
  const completedPicks = useMemo(() => {
    return (userPicks ?? [])
      .filter((pick) => selectedPlayers?.[pick.overall])
      .map((pick) => ({
        pick,
        player: selectedPlayers[pick.overall].player,
      }))
  }, [userPicks, selectedPlayers])

  // Picks the user hasn't made yet
  const upcomingPicks = useMemo(() => {
    return (userPicks ?? [])
      .filter((pick) => !selectedPlayers?.[pick.overall])
      .slice(0, 20)
  }, [userPicks, selectedPlayers])

  const totalPicks = (userPicks ?? []).length
  const madePicks = completedPicks.length

  return (
    <aside
      className={styles.panel}
      style={{
        '--primary': primaryColor,
        '--primary-rgb': `${r}, ${g}, ${b}`,
        '--secondary': secondaryColor,
      }}
    >
      {/* ── Team identity ── */}
      <div className={styles.teamHeader}>
        <div className={styles.colorBar} />
        <div className={styles.teamMeta}>
          <span className={styles.teamAbbr}>{team.abbreviation}</span>
          <h2 className={styles.teamName}>{team.fullName}</h2>
          <span className={styles.roundBadge}>Round {currentRound ?? '—'} of 7</span>
        </div>
        {/* Progress ring */}
        <div className={styles.progressRing}>
          <svg width="44" height="44" viewBox="0 0 44 44">
            <circle
              cx="22" cy="22" r="18"
              fill="none"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth="3"
            />
            <circle
              cx="22" cy="22" r="18"
              fill="none"
              stroke={primaryColor}
              strokeWidth="3"
              strokeDasharray={`${2 * Math.PI * 18}`}
              strokeDashoffset={
                totalPicks > 0
                  ? 2 * Math.PI * 18 * (1 - madePicks / totalPicks)
                  : 2 * Math.PI * 18
              }
              strokeLinecap="round"
              style={{ transform: 'rotate(-90deg)', transformOrigin: '22px 22px' }}
            />
          </svg>
          <div className={styles.progressLabel}>
            <span className={styles.progressNum}>{madePicks}</span>
            <span className={styles.progressDen}>/{totalPicks}</span>
          </div>
        </div>
      </div>

      {/* ── Scrollable body ── */}
      <div className={styles.body}>
        {/* YOUR PICKS section */}
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <span className={styles.sectionTitle}>YOUR PICKS</span>
            <span className={styles.sectionCount}>{madePicks} made</span>
          </div>

          {completedPicks.length === 0 ? (
            <p className={styles.emptyNote}>No picks made yet</p>
          ) : (
            <div className={styles.pickedList}>
              {completedPicks.map(({ pick, player }, i) => (
                <PickedPlayerRow
                  key={pick.overall}
                  pick={pick}
                  player={player}
                  isLatest={i === 0}
                />
              ))}
            </div>
          )}
        </section>

        {/* REMAINING NEEDS section */}
        {(remainingNeeds ?? []).length > 0 && (
          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <span className={styles.sectionTitle}>REMAINING NEEDS</span>
            </div>
            <div className={styles.needsGrid}>
              {remainingNeeds.map((pos) => (
                <NeedBadge key={pos} position={pos} />
              ))}
            </div>
          </section>
        )}

        {/* UPCOMING PICKS section */}
        {upcomingPicks.length > 0 && (
          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <span className={styles.sectionTitle}>UPCOMING PICKS</span>
              <span className={styles.sectionCount}>{upcomingPicks.length} next</span>
            </div>
            <div className={styles.upcomingList}>
              {upcomingPicks.map((pick, i) => (
                <UpcomingPickRow key={pick.overall} pick={pick} index={i} isOnClock={i === 0 && isUserTurn} />
              ))}
            </div>
          </section>
        )}

        {upcomingPicks.length === 0 && completedPicks.length > 0 && (
          <div className={styles.draftComplete}>
            <span className={styles.draftCompleteIcon}></span>
            <span>All picks complete</span>
          </div>
        )}
      </div>
    </aside>
  )
}
