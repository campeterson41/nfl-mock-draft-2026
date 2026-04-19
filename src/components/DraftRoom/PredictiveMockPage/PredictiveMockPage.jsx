import { useState, useMemo, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { POSITION_COLORS } from '../../../constants/positions.js'
import { getPickHint } from '../../../engine/pickHints.js'
import PlayerProfile from '../PlayerProfile/PlayerProfile.jsx'
import beastProfilesData from '../../../data/beastProfiles.json'
import { useGroup } from '../../../context/GroupContext.jsx'
import CreateGroupModal from '../../GroupPage/CreateGroupModal.jsx'
import SubmitPromptModal from '../../GroupPage/SubmitPromptModal.jsx'
import { submitPrediction } from '../../../lib/groupApi.js'
import styles from './PredictiveMockPage.module.css'

const POSITIONS = ['QB', 'EDGE', 'OT', 'WR', 'CB', 'S', 'LB', 'DT', 'RB', 'TE', 'IOL']
const ROW_HEIGHT = 44 // approx height of each dropdown item row, for scroll math

function roundLabel(overall) {
  if (overall <= 32) return 'ROUND 1'
  if (overall <= 64) return 'ROUND 2'
  if (overall <= 102) return 'ROUND 3'
  if (overall <= 138) return 'ROUND 4'
  if (overall <= 176) return 'ROUND 5'
  if (overall <= 221) return 'ROUND 6'
  return 'ROUND 7'
}

// Convert "6'5\"" → 77 (inches). Returns null if unparseable.
function parseHeightToInches(str) {
  if (!str) return null
  const m = /(\d+)\s*['′]\s*(\d+)?/.exec(str)
  if (!m) return null
  const ft = parseInt(m[1], 10)
  const inch = m[2] ? parseInt(m[2], 10) : 0
  return ft * 12 + inch
}

function inchesToLabel(inches) {
  if (!inches) return ''
  return `${Math.floor(inches / 12)}'${inches % 12}"`
}

// Build playerId → { heightIn, weight, forty } map once at module scope
const PLAYER_DETAILS = (() => {
  const map = {}
  for (const profile of beastProfilesData) {
    if (!profile.playerId) continue
    map[profile.playerId] = {
      heightIn: parseHeightToInches(profile.height),
      heightLabel: profile.height || '',
      weight: profile.weight ? parseInt(profile.weight, 10) : null,
      forty: profile.forty ? parseFloat(profile.forty) : null,
    }
  }
  return map
})()

/**
 * Filter panel that sits above the dropdown list.
 */
function FilterPanel({ positions, setPositions, heightMin, setHeightMin, weightMin, setWeightMin, weightMax, setWeightMax, fortyMax, setFortyMax, onReset }) {
  const hasCustomFilters = positions.length > 0 || heightMin || weightMin || weightMax || fortyMax
  return (
    <div className={styles.filterPanel}>
      <div className={styles.filterRow}>
        <span className={styles.filterLabel}>POSITION</span>
        <div className={styles.chipRow}>
          {POSITIONS.map(pos => {
            const active = positions.includes(pos)
            return (
              <button
                key={pos}
                className={`${styles.posChip} ${active ? styles.posChipActive : ''}`}
                onClick={() => {
                  setPositions(active
                    ? positions.filter(p => p !== pos)
                    : [...positions, pos])
                }}
              >
                {pos}
              </button>
            )
          })}
        </div>
      </div>

      <div className={styles.filterRow}>
        <span className={styles.filterLabel}>HEIGHT</span>
        <div className={styles.inputGroup}>
          <span className={styles.inputTiny}>min</span>
          <input
            type="text"
            className={styles.filterInput}
            placeholder={`e.g. 6'0"`}
            value={heightMin}
            onChange={e => setHeightMin(e.target.value)}
          />
        </div>
      </div>

      <div className={styles.filterRow}>
        <span className={styles.filterLabel}>WEIGHT (LBS)</span>
        <div className={styles.inputGroup}>
          <span className={styles.inputTiny}>min</span>
          <input
            type="number"
            className={styles.filterInput}
            placeholder="e.g. 200"
            value={weightMin}
            onChange={e => setWeightMin(e.target.value)}
          />
          <span className={styles.inputTiny}>max</span>
          <input
            type="number"
            className={styles.filterInput}
            placeholder="e.g. 320"
            value={weightMax}
            onChange={e => setWeightMax(e.target.value)}
          />
        </div>
      </div>

      <div className={styles.filterRow}>
        <span className={styles.filterLabel}>40-TIME (SEC)</span>
        <div className={styles.inputGroup}>
          <span className={styles.inputTiny}>max</span>
          <input
            type="number"
            step="0.01"
            className={styles.filterInput}
            placeholder="e.g. 4.6"
            value={fortyMax}
            onChange={e => setFortyMax(e.target.value)}
          />
        </div>
      </div>

      {hasCustomFilters && (
        <button className={styles.resetBtn} onClick={onReset}>CLEAR FILTERS</button>
      )}
    </div>
  )
}

/**
 * A single dropdown row — one per pick.
 */
function PickRow({
  pick, selectedPlayer, availablePlayers, isNext, onPick, onUndo, onViewProfile,
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [positions, setPositions] = useState([])
  const [heightMin, setHeightMin] = useState('')
  const [weightMin, setWeightMin] = useState('')
  const [weightMax, setWeightMax] = useState('')
  const [fortyMax, setFortyMax] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  const inputRef = useRef(null)
  const containerRef = useRef(null)
  const dropdownRef = useRef(null)

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus()
  }, [open])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function onClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  const sortedPlayers = useMemo(
    () => [...(availablePlayers ?? [])].sort((a, b) => a.rank - b.rank),
    [availablePlayers]
  )

  const filtered = useMemo(() => {
    let list = sortedPlayers

    // Name search
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.school || '').toLowerCase().includes(q)
      )
    }

    // Position filter (multi)
    if (positions.length > 0) {
      list = list.filter(p => positions.includes(p.position))
    }

    // Height min (parse "6'0" style)
    const heightMinIn = parseHeightToInches(heightMin)
    if (heightMinIn) {
      list = list.filter(p => {
        const d = PLAYER_DETAILS[p.id]
        return d?.heightIn && d.heightIn >= heightMinIn
      })
    }

    // Weight min/max
    const wMin = weightMin ? parseInt(weightMin, 10) : null
    const wMax = weightMax ? parseInt(weightMax, 10) : null
    if (wMin || wMax) {
      list = list.filter(p => {
        const d = PLAYER_DETAILS[p.id]
        if (!d?.weight) return false
        if (wMin && d.weight < wMin) return false
        if (wMax && d.weight > wMax) return false
        return true
      })
    }

    // 40 max
    const fMax = fortyMax ? parseFloat(fortyMax) : null
    if (fMax) {
      list = list.filter(p => {
        const d = PLAYER_DETAILS[p.id]
        return d?.forty && d.forty <= fMax
      })
    }

    return list
  }, [sortedPlayers, search, positions, heightMin, weightMin, weightMax, fortyMax])

  // When dropdown opens and no search/filters are active, center the list on
  // the rank closest to this pick's overall number.
  const filtersActive = search.trim() || positions.length > 0 || heightMin || weightMin || weightMax || fortyMax

  useEffect(() => {
    if (!open || filtersActive) return
    if (!dropdownRef.current) return
    const targetRank = pick.overall
    // Find index of first player whose rank >= targetRank
    const idx = filtered.findIndex(p => p.rank >= targetRank)
    if (idx < 0) return
    const container = dropdownRef.current
    const containerHeight = container.clientHeight
    // Center: put target idx at middle of visible area
    const scrollTop = Math.max(0, idx * ROW_HEIGHT - containerHeight / 2 + ROW_HEIGHT / 2)
    container.scrollTop = scrollTop
  }, [open, filtersActive, filtered, pick.overall])

  function resetFilters() {
    setPositions([])
    setHeightMin('')
    setWeightMin('')
    setWeightMax('')
    setFortyMax('')
  }

  const hint = selectedPlayer
    ? getPickHint({ player: selectedPlayer, pickOverall: pick.overall })
    : null

  return (
    <div className={`${styles.row} ${isNext && !selectedPlayer ? styles.rowNext : ''}`}>
      <div className={styles.pickMeta}>
        <div className={styles.pickBadge}>
          <span className={styles.pickRound}>{roundLabel(pick.overall)}</span>
          <span className={styles.pickNumber}>#{pick.overall}</span>
        </div>
      </div>

      <div className={styles.pickBody} ref={containerRef}>
        {selectedPlayer ? (
          <div className={styles.filled}>
            <div className={styles.filledMain}>
              <span
                className={styles.posBadge}
                style={{ background: POSITION_COLORS[selectedPlayer.position] ?? '#555' }}
              >
                {selectedPlayer.position}
              </span>
              <button
                className={styles.filledNameBtn}
                onClick={() => onViewProfile(selectedPlayer)}
                title="View draft profile"
              >
                <span className={styles.filledName}>{selectedPlayer.name}</span>
                <span className={styles.filledSchool}>{selectedPlayer.school}</span>
              </button>
              <span className={styles.filledRank}>#{selectedPlayer.rank}</span>
              <button
                className={styles.undoBtn}
                onClick={() => onUndo(pick.overall)}
                title="Undo this pick"
              >
                UNDO
              </button>
            </div>
            {hint && (
              <div className={`${styles.hint} ${styles[`hint_${hint.level}`]}`}>
                {hint.message}
              </div>
            )}
          </div>
        ) : !open ? (
          <button
            className={styles.openBtn}
            onClick={() => setOpen(true)}
          >
            <span className={styles.openBtnText}>Search for a player…</span>
            <span className={styles.openBtnArrow}>▾</span>
          </button>
        ) : (
          <div className={styles.combobox}>
            <div className={styles.searchRow}>
              <input
                ref={inputRef}
                type="text"
                className={styles.searchInput}
                placeholder="Search by name or school…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              <button
                className={`${styles.filtersToggle} ${showFilters ? styles.filtersToggleActive : ''}`}
                onClick={() => setShowFilters(!showFilters)}
                title="Show filter options"
              >
                FILTERS {showFilters ? '▴' : '▾'}
              </button>
            </div>

            {showFilters && (
              <FilterPanel
                positions={positions} setPositions={setPositions}
                heightMin={heightMin} setHeightMin={setHeightMin}
                weightMin={weightMin} setWeightMin={setWeightMin}
                weightMax={weightMax} setWeightMax={setWeightMax}
                fortyMax={fortyMax} setFortyMax={setFortyMax}
                onReset={resetFilters}
              />
            )}

            <div className={styles.dropdown} ref={dropdownRef}>
              {filtered.length === 0 ? (
                <div className={styles.empty}>No players match those filters.</div>
              ) : (
                filtered.map(player => {
                  const details = PLAYER_DETAILS[player.id]
                  return (
                    <div key={player.id ?? player.name} className={styles.dropdownItem}>
                      <button
                        className={styles.itemSelectBtn}
                        onClick={() => {
                          onPick(pick, player)
                          setOpen(false)
                          setSearch('')
                          resetFilters()
                          setShowFilters(false)
                        }}
                        title={`Select ${player.name} at pick ${pick.overall}`}
                      >
                        <span className={styles.itemRank}>#{player.rank}</span>
                        <span
                          className={styles.itemPos}
                          style={{ background: POSITION_COLORS[player.position] ?? '#555' }}
                        >
                          {player.position}
                        </span>
                        <span className={styles.itemMain}>
                          <span className={styles.itemName}>{player.name}</span>
                          <span className={styles.itemSub}>
                            {player.school}
                            {details?.heightLabel && <span className={styles.itemSubDot}> · {details.heightLabel}</span>}
                            {details?.weight && <span className={styles.itemSubDot}> · {details.weight} lb</span>}
                            {details?.forty && <span className={styles.itemSubDot}> · {details.forty}s 40</span>}
                          </span>
                        </span>
                      </button>
                      <button
                        className={styles.itemProfileBtn}
                        onClick={(e) => { e.stopPropagation(); onViewProfile(player) }}
                        title="View draft profile"
                      >
                        INFO
                      </button>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function PredictiveMockPage({
  team,
  userAllPicks,
  selectedPlayers,
  tradeHistory,
  availablePlayers,
  onPick,
  onUndoPick,
  onOpenTrade,
}) {
  const navigate = useNavigate()
  const { group: groupCtx } = useGroup()

  const [profilePlayer, setProfilePlayer] = useState(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [submitOpen, setSubmitOpen] = useState(false)

  const sortedPicks = useMemo(
    () => [...(userAllPicks ?? [])].sort((a, b) => a.overall - b.overall),
    [userAllPicks]
  )

  // Earliest unfilled pick — highlighted with "on the clock" border.
  const nextPickOverall = useMemo(() => {
    for (const pick of sortedPicks) {
      if (!selectedPlayers?.[pick.overall]) return pick.overall
    }
    return null
  }, [sortedPicks, selectedPlayers])

  const totalPicks = sortedPicks.length
  const filledCount = sortedPicks.filter(p => selectedPlayers?.[p.overall]).length
  const isComplete = filledCount === totalPicks && totalPicks > 0

  const profileStillAvailable = profilePlayer
    ? availablePlayers?.some(p => p.id === profilePlayer.id)
    : false

  return (
    <div className={styles.page}>
      <div className={styles.pageInner}>
        <div className={styles.header}>
          <div className={styles.headerInner}>
            <div className={styles.headerLeft}>
              <p className={styles.headerEyebrow}>PREDICTIVE MOCK</p>
              <h1 className={styles.headerTitle}>
                {team?.city ?? ''} {team?.nickname ?? 'Your Team'}
              </h1>
              <p className={styles.headerSub}>
                {totalPicks} pick{totalPicks === 1 ? '' : 's'} · {filledCount} filled
                {isComplete ? ' · PREDICTION COMPLETE' : ''}
              </p>
            </div>
            <div className={styles.headerRight}>
              <button className={styles.tradeBtn} onClick={onOpenTrade}>
                PROPOSE TRADE
              </button>
              {groupCtx ? (
                <button
                  className={styles.groupBtnPrimary}
                  onClick={() => setSubmitOpen(true)}
                  title={`Submit your picks to "${groupCtx.groupId}"`}
                >
                  SUBMIT TO GROUP
                </button>
              ) : (
                <button
                  className={styles.groupBtn}
                  onClick={() => setCreateOpen(true)}
                >
                  CREATE A GROUP
                </button>
              )}
            </div>
          </div>
        </div>

        <div className={styles.list}>
          {sortedPicks.length === 0 && (
            <div className={styles.empty}>This team has no picks.</div>
          )}
          {sortedPicks.map(pick => {
            const filled = selectedPlayers?.[pick.overall]?.player ?? null
            const isNext = pick.overall === nextPickOverall
            return (
              <PickRow
                key={pick.overall}
                pick={pick}
                selectedPlayer={filled}
                availablePlayers={availablePlayers}
                isNext={isNext}
                onPick={onPick}
                onUndo={onUndoPick}
                onViewProfile={setProfilePlayer}
              />
            )
          })}
        </div>
      </div>

      <PlayerProfile
        player={profilePlayer}
        isOpen={!!profilePlayer}
        onClose={() => setProfilePlayer(null)}
        onDraft={(p) => {
          if (nextPickOverall != null && profileStillAvailable) {
            const nextPick = sortedPicks.find(pk => pk.overall === nextPickOverall)
            if (nextPick) onPick(nextPick, p)
          }
          setProfilePlayer(null)
        }}
        canDraft={profileStillAvailable && nextPickOverall != null}
        playerDrafted={!profileStillAvailable && !!profilePlayer}
      />

      <CreateGroupModal
        isOpen={createOpen}
        team={team}
        onClose={() => setCreateOpen(false)}
        onSubmitSelf={async (newGroup, memberName) => {
          // Build the submission from the user's current picks + trades
          const picks = {}
          for (const [overall, sp] of Object.entries(selectedPlayers ?? {})) {
            if (sp?.player?.id) picks[overall] = sp.player.id
          }
          const trades = (tradeHistory ?? [])
            .filter(t => t.userTeamId === newGroup.teamId)
            .map(t => ({
              partnerId: t.targetTeamId,
              gave: {
                pickOveralls: t.gave?.pickOveralls ?? [],
                futurePickIds: t.gave?.futurePickIds ?? [],
              },
              received: {
                pickOveralls: t.received?.pickOveralls ?? [],
                futurePickIds: t.received?.futurePickIds ?? [],
              },
            }))
          try {
            await submitPrediction(newGroup.id, {
              name: memberName,
              picks,
              trades,
            })
          } catch (err) {
            // Silent: the group was still created, so user can submit later
            console.warn('Initial submission failed (group still created):', err)
          }
          setCreateOpen(false)
          navigate(`/group/${newGroup.id}`)
        }}
      />

      <SubmitPromptModal
        isOpen={submitOpen}
        group={groupCtx ? {
          id: groupCtx.groupId,
          name: groupCtx.groupId,  // we don't carry the pretty name in ctx — GroupPage will show full
          teamId: groupCtx.teamId,
        } : null}
        memberName={groupCtx?.memberName}
        selectedPlayers={selectedPlayers}
        tradeHistory={tradeHistory}
        onClose={() => setSubmitOpen(false)}
        onSubmitted={() => {
          setSubmitOpen(false)
          if (groupCtx) navigate(`/group/${groupCtx.groupId}`)
        }}
      />
    </div>
  )
}
