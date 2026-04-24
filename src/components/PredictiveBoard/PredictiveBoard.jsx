import { useState, useMemo, useRef, useEffect } from 'react'
import { usePredictiveState } from '../../hooks/usePredictiveState.js'
import { POSITION_COLORS } from '../../constants/positions.js'
import TradeModal from '../DraftRoom/TradeModal/TradeModal.jsx'
import styles from './PredictiveBoard.module.css'

const FILTER_POSITIONS = ['ALL', 'QB', 'EDGE', 'OT', 'WR', 'CB', 'S', 'LB', 'DT', 'RB', 'TE', 'IOL']

function PosPill({ position }) {
  const color = POSITION_COLORS[position] ?? '#4a4d66'
  return (
    <span className={styles.posPill} style={{ background: color }}>
      {position}
    </span>
  )
}

function PredictionSlot({ pick, assignment, suggestions, onAssign, onUnassign, availablePlayers }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [posFilter, setPosFilter] = useState('ALL')
  const dropdownRef = useRef(null)
  const inputRef = useRef(null)

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  // Focus input when opening
  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus()
  }, [open])

  const filtered = useMemo(() => {
    let list = search ? availablePlayers : suggestions
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.school.toLowerCase().includes(q) ||
        p.position.toLowerCase().includes(q)
      )
    }
    if (posFilter !== 'ALL') {
      list = list.filter(p => p.position === posFilter)
    }
    return list.slice(0, 50)
  }, [search, posFilter, suggestions, availablePlayers])

  const suggestionIds = useMemo(
    () => new Set(suggestions.slice(0, 15).map(p => p.id)),
    [suggestions]
  )

  if (assignment) {
    return (
      <div className={styles.slot}>
        <div className={styles.slotMeta}>
          <span className={styles.slotRound}>RD {pick.round}</span>
          <span className={styles.slotDot} />
          <span className={styles.slotOverall}>#{pick.overall}</span>
          <span className={styles.slotRoundPick}>Pick {pick.roundPick}</span>
        </div>
        <div className={styles.slotAssigned}>
          <PosPill position={assignment.position} />
          <span className={styles.slotPlayerName}>{assignment.name}</span>
          <span className={styles.slotPlayerSchool}>{assignment.school}</span>
          <span className={styles.slotPlayerRank}>#{assignment.rank}</span>
          <button className={styles.slotClearBtn} onClick={() => onUnassign(pick.overall)}>
            CLEAR
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={`${styles.slot} ${styles.slotEmpty}`} ref={dropdownRef}>
      <div className={styles.slotMeta}>
        <span className={styles.slotRound}>RD {pick.round}</span>
        <span className={styles.slotDot} />
        <span className={styles.slotOverall}>#{pick.overall}</span>
        <span className={styles.slotRoundPick}>Pick {pick.roundPick}</span>
      </div>

      {!open ? (
        <button className={styles.slotSelectBtn} onClick={() => setOpen(true)}>
          SELECT PLAYER
        </button>
      ) : (
        <div className={styles.dropdown}>
          <input
            ref={inputRef}
            className={styles.dropdownSearch}
            type="text"
            placeholder="Search by name, school, position..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <div className={styles.dropdownFilters}>
            {FILTER_POSITIONS.map(pos => (
              <button
                key={pos}
                className={`${styles.dropdownPosBtn} ${posFilter === pos ? styles.dropdownPosBtnActive : ''}`}
                onClick={() => setPosFilter(pos)}
              >
                {pos}
              </button>
            ))}
          </div>
          <div className={styles.dropdownList}>
            {filtered.length === 0 && (
              <div className={styles.dropdownEmpty}>No players match</div>
            )}
            {filtered.map(player => {
              const isSuggested = suggestionIds.has(player.id)
              return (
                <button
                  key={player.id}
                  className={`${styles.dropdownRow} ${isSuggested ? styles.dropdownRowSuggested : ''}`}
                  onClick={() => {
                    onAssign(pick.overall, player)
                    setOpen(false)
                    setSearch('')
                    setPosFilter('ALL')
                  }}
                >
                  <span className={styles.dropdownRank}>#{player.rank}</span>
                  <PosPill position={player.position} />
                  <span className={styles.dropdownName}>{player.name}</span>
                  <span className={styles.dropdownSchool}>{player.school}</span>
                  {isSuggested && <span className={styles.suggestedBadge}>LIKELY</span>}
                  {player.mockRange && (
                    <span className={styles.dropdownRange}>
                      Mock {player.mockRange.floor}–{player.mockRange.ceiling}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export default function PredictiveBoard({ sessionConfig, onComplete, onNewSession }) {
  const teamId = sessionConfig?.userTeamIds?.[0]
  const {
    state,
    teamPicks,
    availablePlayers,
    isComplete,
    getSuggestions,
    assignPlayer,
    unassignPlayer,
    openTradeModal,
    closeTradeModal,
    executeTrade,
  } = usePredictiveState(teamId)

  const team = state.teams[teamId]
  const teamColor = team?.colors?.primary ?? '#d4a843'
  const filledCount = teamPicks.filter(p => state.assignments[p.overall]).length
  const totalCount = teamPicks.length

  // Group picks by round for display
  const picksByRound = useMemo(() => {
    const groups = {}
    for (const pick of teamPicks) {
      if (!groups[pick.round]) groups[pick.round] = []
      groups[pick.round].push(pick)
    }
    return groups
  }, [teamPicks])

  // Trade modal props
  const userCurrentPicks = useMemo(
    () => state.teamPickInventory[teamId]?.currentPicks ?? [],
    [state.teamPickInventory, teamId]
  )
  const userFuturePicks = useMemo(
    () => state.teamPickInventory[teamId]?.futurePicks ?? [],
    [state.teamPickInventory, teamId]
  )

  function handleComplete() {
    const result = {
      teamId,
      assignments: state.assignments,
      tradeHistory: state.tradeHistory,
      teams: state.teams,
      teamPicks,
    }
    onComplete(result)
  }

  return (
    <div className={styles.screen}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.headerLeft}>
            <span className={styles.eyebrow}>PREDICTIVE DRAFT</span>
            <h1 className={styles.headline}>
              <span className={styles.teamDot} style={{ background: teamColor }} />
              {team?.city} {team?.nickname}
            </h1>
            <p className={styles.subline}>
              {filledCount} of {totalCount} picks filled
            </p>
          </div>
          <div className={styles.headerActions}>
            <button className={styles.btnOutline} onClick={onNewSession}>BACK</button>
            <button
              className={styles.btnTrade}
              onClick={() => openTradeModal(null, 'UP')}
            >
              TRADE
            </button>
            <button
              className={styles.btnGold}
              onClick={handleComplete}
              disabled={!isComplete}
              style={{ opacity: isComplete ? 1 : 0.4 }}
            >
              SUBMIT PREDICTIONS
            </button>
          </div>
        </div>
        {/* Progress bar */}
        <div className={styles.progressBar}>
          <div
            className={styles.progressFill}
            style={{ width: `${totalCount > 0 ? (filledCount / totalCount) * 100 : 0}%`, background: teamColor }}
          />
        </div>
      </header>

      {/* Pick slots */}
      <div className={styles.content}>
        {Object.entries(picksByRound).map(([round, picks]) => (
          <div key={round} className={styles.roundGroup}>
            <h3 className={styles.roundLabel}>ROUND {round}</h3>
            {picks.map(pick => (
              <PredictionSlot
                key={pick.overall}
                pick={pick}
                assignment={state.assignments[pick.overall]}
                suggestions={getSuggestions(pick.overall)}
                availablePlayers={availablePlayers}
                onAssign={assignPlayer}
                onUnassign={unassignPlayer}
              />
            ))}
          </div>
        ))}
      </div>

      {/* Trade Modal */}
      <TradeModal
        isOpen={state.tradeModal.isOpen}
        direction={state.tradeModal.direction}
        targetPick={state.tradeModal.targetPickOverall ? state.allPicks.find(p => p.overall === state.tradeModal.targetPickOverall) : null}
        targetTeam={null}
        userTeamId={teamId}
        userTeam={team}
        userCurrentPicks={userCurrentPicks}
        userFuturePicks={userFuturePicks}
        allFuturePicks={state.futurePicks}
        allPicks={state.allPicks}
        allTeams={state.teams}
        currentPickOverall={1}
        onConfirmTrade={executeTrade}
        onClose={closeTradeModal}
        forceTrade
      />
    </div>
  )
}
