import { useState, useMemo, useRef, useEffect } from 'react'
import styles from './BigBoard.module.css'
import { POSITION_COLORS } from '../../../constants/positions'
import PlayerProfile from '../PlayerProfile/PlayerProfile.jsx'

const FILTER_POSITIONS = ['ALL', 'QB', 'EDGE', 'OT', 'WR', 'CB', 'S', 'LB', 'DT', 'RB', 'TE', 'IOL']

function PlayerRow({ player, desireScore, maxDesire, isUserTurn, isSelected, onViewProfile, onDraft }) {
  const posColor = POSITION_COLORS[player.position] ?? '#666'
  const desirePct = maxDesire > 0 ? (desireScore / maxDesire) * 100 : 0

  return (
    <div
      className={`
        ${styles.playerRow}
        ${styles.clickable}
        ${isSelected ? styles.selected : ''}
      `}
      onClick={() => onViewProfile(player)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onViewProfile(player)}
    >
      {desireScore != null && (
        <div
          className={styles.desireBar}
          style={{ width: `${desirePct}%` }}
          aria-hidden="true"
        />
      )}

      <div className={styles.rankNum}>{player.rank}</div>

      <span
        className={styles.posBadge}
        style={{ background: posColor }}
        title={player.position}
      >
        {player.position}
      </span>

      <div className={styles.playerInfo}>
        <div className={styles.playerName}>{player.name}</div>
        <div className={styles.playerSchool}>{player.school}</div>
      </div>

      {desireScore != null && (
        <div className={styles.desireScore} title="AI desire score">
          {desireScore.toFixed(0)}
        </div>
      )}

      {isUserTurn && (
        <button
          className={styles.draftBtnInline}
          onClick={(e) => { e.stopPropagation(); onDraft(player); }}
          title={`Draft ${player.name}`}
        >
          DRAFT
        </button>
      )}
    </div>
  )
}

export default function BigBoard({
  availablePlayers,
  scoredForTeam,
  currentTeamId,
  onPlayerSelect,
  isUserTurn,
  filterPosition,
}) {
  const [activePos, setActivePos] = useState(filterPosition ?? 'ALL')
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [profilePlayer, setProfilePlayer] = useState(null)
  const filterBarRef = useRef(null)

  useEffect(() => {
    if (filterPosition) setActivePos(filterPosition)
  }, [filterPosition])

  const desireMap = useMemo(() => {
    if (!scoredForTeam) return {}
    return Object.fromEntries(scoredForTeam.map(p => [p.id ?? p.name, p.desireScore ?? p.score ?? 0]))
  }, [scoredForTeam])

  const maxDesire = useMemo(() => {
    const vals = Object.values(desireMap)
    return vals.length ? Math.max(...vals) : 0
  }, [desireMap])

  const filtered = useMemo(() => {
    let list = availablePlayers ?? []
    if (activePos !== 'ALL') {
      list = list.filter(p => p.position === activePos)
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(p => p.name.toLowerCase().includes(q))
    }
    return list
  }, [availablePlayers, activePos, search])

  function handleViewProfile(player) {
    setSelectedId(player.id ?? player.name)
    setProfilePlayer(player)
  }

  function handleDraft(player) {
    setSelectedId(player.id ?? player.name)
    onPlayerSelect(player)
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <h2 className={styles.title}>BIG BOARD</h2>
          <span className={styles.availableCount}>
            {(availablePlayers ?? []).length} available
          </span>
        </div>

        <div className={styles.searchWrapper}>
          <span className={styles.searchIcon}></span>
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Search players..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button className={styles.searchClear} onClick={() => setSearch('')} aria-label="Clear search">
              X
            </button>
          )}
        </div>

        <div className={styles.filterBar} ref={filterBarRef}>
          {FILTER_POSITIONS.map(pos => (
            <button
              key={pos}
              className={`${styles.filterChip} ${activePos === pos ? styles.filterChipActive : ''}`}
              onClick={() => setActivePos(pos)}
            >
              {pos}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.listWrapper}>
        {filtered.length === 0 ? (
          <div className={styles.empty}>No players match your filter.</div>
        ) : (
          filtered.map(player => {
            const key = player.id ?? player.name
            const desire = desireMap[key] ?? null
            return (
              <PlayerRow
                key={key}
                player={player}
                desireScore={desire}
                maxDesire={maxDesire}
                isUserTurn={isUserTurn}
                isSelected={selectedId === key}
                onViewProfile={handleViewProfile}
                onDraft={handleDraft}
              />
            )
          })
        )}
      </div>

      {isUserTurn && (
        <div className={styles.userTurnBanner}>
          YOUR PICK — Click a player to view profile, or DRAFT to select
        </div>
      )}

      {/* Player Profile Modal */}
      <PlayerProfile
        player={profilePlayer}
        isOpen={!!profilePlayer}
        onClose={() => setProfilePlayer(null)}
        onDraft={handleDraft}
        canDraft={isUserTurn}
      />
    </div>
  )
}
