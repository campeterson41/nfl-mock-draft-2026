import { useRef, useEffect, useCallback } from 'react'
import styles from './DraftBoard.module.css'
import { POSITION_COLORS } from '../../../constants/positions'

const ROUNDS = [1, 2, 3, 4, 5, 6, 7]

function getRoundLabel(round) {
  return `R${round}`
}

// Attaches drag-to-scroll behaviour to a scrollable element ref.
// Returns { onMouseDown } to spread onto the element.
function useDragScroll() {
  const dragging = useRef(false)
  const startX   = useRef(0)
  const scrollX  = useRef(0)
  const moved    = useRef(false)

  const onMouseDown = useCallback((e) => {
    if (e.button !== 0) return
    dragging.current = true
    moved.current    = false
    startX.current   = e.pageX
    scrollX.current  = e.currentTarget.scrollLeft
    e.currentTarget.style.cursor      = 'grabbing'
    e.currentTarget.style.userSelect  = 'none'
    e.currentTarget.style.scrollBehavior = 'auto'
  }, [])

  const onMouseMove = useCallback((e) => {
    if (!dragging.current) return
    const dx = e.pageX - startX.current
    if (Math.abs(dx) > 3) moved.current = true
    e.currentTarget.scrollLeft = scrollX.current - dx
  }, [])

  const onMouseUp = useCallback((e) => {
    if (!dragging.current) return
    dragging.current = false
    e.currentTarget.style.cursor         = ''
    e.currentTarget.style.userSelect     = ''
    e.currentTarget.style.scrollBehavior = ''
  }, [])

  // Suppress click after a drag so pick cells don't fire
  const onClickCapture = useCallback((e) => {
    if (moved.current) {
      e.stopPropagation()
      moved.current = false
    }
  }, [])

  return { onMouseDown, onMouseMove, onMouseUp, onClickCapture }
}

function PickCell({ pick, selectedPlayers, teams, currentPickOverall, userTeamIds, onPickClick }) {
  const filled = selectedPlayers[pick.overall]
  const isCurrent = pick.overall === currentPickOverall
  const isUserTeam = userTeamIds.includes(pick.teamId)
  const team = teams[pick.teamId]

  const posColor = filled?.player?.position
    ? POSITION_COLORS[filled.player.position] ?? '#555'
    : null

  return (
    <div
      className={`
        ${styles.pickCell}
        ${isCurrent ? styles.current : ''}
        ${isUserTeam ? styles.userTeam : ''}
        ${filled ? styles.filled : styles.empty}
        ${filled ? styles.clickable : ''}
      `}
      onClick={filled ? () => onPickClick(pick) : undefined}
      role={filled ? 'button' : undefined}
      tabIndex={filled ? 0 : undefined}
      onKeyDown={filled ? (e) => e.key === 'Enter' && onPickClick(pick) : undefined}
      title={filled ? `${team?.abbreviation ?? pick.teamId} · ${filled.player.name} (${filled.player.position})` : `${team?.abbreviation ?? pick.teamId} · Pick #${pick.overall}`}
    >
      <div className={styles.pickNum}>{pick.overall}</div>

      <div className={styles.teamAbbr}>
        {team?.abbreviation ?? pick.teamId}
      </div>

      {filled ? (
        <>
          <div className={styles.playerName} title={filled.player.name}>
            {filled.player.name}
          </div>
          <span
            className={styles.posBadge}
            style={{ background: posColor ?? '#555' }}
          >
            {filled.player.position}
          </span>
        </>
      ) : (
        <div className={styles.emptyLabel}>—</div>
      )}
    </div>
  )
}

function RoundRow({ round, roundPicks, selectedPlayers, teams, currentPickOverall, userTeamIds, onPickClick, currentRef }) {
  const drag = useDragScroll()

  return (
    <div
      className={styles.roundRow}
      onMouseDown={drag.onMouseDown}
      onMouseMove={drag.onMouseMove}
      onMouseUp={drag.onMouseUp}
      onMouseLeave={drag.onMouseUp}
      onClickCapture={drag.onClickCapture}
    >
      {roundPicks.map(pick => (
        <div
          key={pick.overall}
          ref={pick.overall === currentPickOverall ? currentRef : null}
        >
          <PickCell
            pick={pick}
            selectedPlayers={selectedPlayers}
            teams={teams}
            currentPickOverall={currentPickOverall}
            userTeamIds={userTeamIds}
            onPickClick={onPickClick}
          />
        </div>
      ))}
    </div>
  )
}

export default function DraftBoard({
  picks,
  selectedPlayers,
  teams,
  currentPickOverall,
  userTeamIds,
  onPickClick,
}) {
  const currentRef = useRef(null)
  const boardRef   = useRef(null)

  // Auto-scroll to current pick horizontally
  useEffect(() => {
    if (currentRef.current) {
      const cell = currentRef.current
      const row  = cell.closest(`.${styles.roundRow}`)
      if (row) {
        row.scrollLeft = cell.offsetLeft - row.clientWidth / 2 + cell.offsetWidth / 2
      }
    }
  }, [currentPickOverall])

  const picksByRound = ROUNDS.reduce((acc, round) => {
    acc[round] = (picks ?? []).filter(p => p.round === round)
    return acc
  }, {})

  return (
    <div className={styles.board} ref={boardRef} aria-label="Full Draft Board">
      {ROUNDS.map(round => {
        const roundPicks = picksByRound[round] ?? []
        if (roundPicks.length === 0) return null
        return (
          <div key={round} className={styles.roundStrip}>
            <div className={styles.roundLabel}>{getRoundLabel(round)}</div>
            <RoundRow
              round={round}
              roundPicks={roundPicks}
              selectedPlayers={selectedPlayers}
              teams={teams}
              currentPickOverall={currentPickOverall}
              userTeamIds={userTeamIds}
              onPickClick={onPickClick}
              currentRef={currentRef}
            />
          </div>
        )
      })}
    </div>
  )
}
