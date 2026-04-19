import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useDraft } from '../../context/DraftContext.jsx'
import DraftHeader from './DraftHeader/DraftHeader.jsx'
import PickReasoning from './PickReasoning/PickReasoning.jsx'
import BigBoard from './BigBoard/BigBoard.jsx'
import DraftBoard from './DraftBoard/DraftBoard.jsx'
import TeamPanel from './TeamPanel/TeamPanel.jsx'
import TradeModal from './TradeModal/TradeModal.jsx'
import SourceScraper from './SourceScraper/SourceScraper.jsx'
import PredictiveMockPage from './PredictiveMockPage/PredictiveMockPage.jsx'
import { POSITION_COLORS } from '../../constants/positions.js'
import styles from './DraftRoom.module.css'

// Compact last-pick banner shown in the right sidebar — no popup
function LastPickBanner({ pick, teams }) {
  if (!pick?.player) return null
  const team = teams?.[pick.teamId]
  const posColor = POSITION_COLORS[pick.player.position] ?? '#4a4d66'
  const teamColor = team?.colors?.primary ?? '#1a1d27'

  return (
    <div className={styles.lastPickBanner} style={{ '--team-color': teamColor }}>
      <div className={styles.lastPickBar} />
      <div className={styles.lastPickContent}>
        <div className={styles.lastPickMeta}>
          <span className={styles.lastPickTeam}>{team?.abbreviation ?? pick.teamId}</span>
          <span className={styles.lastPickLabel}>SELECTED</span>
        </div>
        <div className={styles.lastPickPlayer}>
          <span className={styles.lastPickName}>{pick.player.name}</span>
          <span className={styles.lastPickPos} style={{ background: posColor }}>
            {pick.player.position}
          </span>
        </div>
        <div className={styles.lastPickSchool}>{pick.player.school}</div>
        {pick.reasoning?.headline && (
          <div className={styles.lastPickHeadline}>{pick.reasoning.headline}</div>
        )}
      </div>
    </div>
  )
}

export default function DraftRoom({ onComplete, scraperOpen: scraperOpenProp = false, onScraperClose, onIntelAdded }) {
  const {
    state, currentPick, isUserTurn, isDraftComplete,
    makeUserPick, undoUserPick, openTradeModal, closeTradeModal, executeTrade,
    toggleFastSim, togglePause, skipToUserPick, currentTeam,
  } = useDraft()

  // Track which completed pick is being inspected (for reasoning view)
  const [inspectedPick, setInspectedPick] = useState(null)
  const [sessionIntel, setSessionIntel] = useState([])

  // Mobile detection + tab state
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const [mobileTab, setMobileTab] = useState('board') // 'board' | 'picks' | 'team'

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Scraper is controlled by parent (AppNav) but session intel lives here
  const isScraperOpen = scraperOpenProp

  function handleIntelFound(intel) {
    setSessionIntel(prev => [...prev, ...intel])
    onIntelAdded?.(intel.length)
  }

  function handleScraperClose() {
    onScraperClose?.()
  }

  // Resizable right column
  const [rightColWidth, setRightColWidth] = useState(380)
  const isDragging = useRef(false)
  const dragStartX = useRef(0)
  const dragStartWidth = useRef(380)

  const handleDividerMouseDown = useCallback((e) => {
    isDragging.current = true
    dragStartX.current = e.clientX
    dragStartWidth.current = rightColWidth
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [rightColWidth])

  useEffect(() => {
    const onMouseMove = (e) => {
      if (!isDragging.current) return
      // Dragging left = bigger right column (subtract because divider is on left of right col)
      const delta = dragStartX.current - e.clientX
      const newWidth = Math.min(700, Math.max(280, dragStartWidth.current + delta))
      setRightColWidth(newWidth)
    }
    const onMouseUp = () => {
      if (!isDragging.current) return
      isDragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

  useEffect(() => {
    if (isDraftComplete) onComplete?.()
  }, [isDraftComplete])

  // On desktop, auto-show the latest pick (clear any inspected pick).
  // On mobile, leave it alone — user dismisses manually.
  useEffect(() => {
    if (state.lastPick && !isMobile) setInspectedPick(null)
  }, [state.lastPick, isMobile])

  const userTeamId = state.session?.userTeamIds?.[0]
  const userTeam = userTeamId ? state.teams?.[userTeamId] : null
  const userTeamIds = state.session?.userTeamIds ?? []

  // ALL picks owned by the user's team(s) — needed for TeamPanel to show completed picks
  const userAllPicks = state.picks?.filter(
    p => userTeamIds.includes(p.teamId)
  ) ?? []
  // Only REMAINING (not yet made) picks — for trade modal and upcoming picks display
  const userCurrentPicks = userAllPicks.filter(
    p => !state.selectedPlayers[p.overall]
  )

  const userFuturePicks = state.futurePicks?.filter(
    fp => userTeamIds.includes(fp.ownerTeamId)
  ) ?? []

  // What to show in the reasoning panel:
  // If user clicked a past pick — show that. Otherwise show last AI pick.
  const displayPick = inspectedPick ?? state.lastPick
  const displayReasoning = inspectedPick
    ? state.selectedPlayers[inspectedPick.overall]?.reasoning
    : state.lastPick?.reasoning
  const displayPlayer = inspectedPick
    ? state.selectedPlayers[inspectedPick.overall]?.player
    : state.lastPick?.player
  const displayTeam = inspectedPick
    ? state.teams?.[state.selectedPlayers[inspectedPick.overall]?.teamId]
    : state.teams?.[state.lastPick?.teamId]

  function handlePickClick(pick) {
    const filled = state.selectedPlayers[pick.overall]
    if (!filled) return
    // Toggle: clicking same pick clears the inspection
    if (inspectedPick?.overall === pick.overall) {
      setInspectedPick(null)
    } else {
      setInspectedPick(pick)
    }
  }

  if (!currentPick && !isDraftComplete && state.session?.mode !== 'predictive') {
    return (
      <div className={styles.loading}>
        <p className={styles.loadingTitle}>2026 NFL Mock Draft Simulator</p>
        <p className={styles.loadingText}>Initializing draft...</p>
        <p className={styles.loadingDesc}>Loading 491 prospects, 32 team profiles, and 300+ beat writer signals.</p>
      </div>
    )
  }

  // Predictive mock mode: render the simple one-page layout and bail out of
  // the full draft-room UI entirely.
  if (state.session?.mode === 'predictive') {
    return (
      <>
        <PredictiveMockPage
          team={userTeam}
          userAllPicks={userAllPicks}
          selectedPlayers={state.selectedPlayers}
          tradeHistory={state.tradeHistory ?? []}
          availablePlayers={state.availablePlayers}
          onPick={(pick, player) => makeUserPick(player, pick)}
          onUndoPick={(overall) => undoUserPick(overall)}
          onOpenTrade={() => {
            const firstPick = userCurrentPicks[0]
            if (firstPick) openTradeModal('DOWN', firstPick.overall)
          }}
          currentPick={currentPick}
        />
        {state.tradeModal?.isOpen && (
          <TradeModal
            isOpen={state.tradeModal?.isOpen}
            direction={state.tradeModal?.direction}
            targetPick={state.picks?.find(p => p.overall === state.tradeModal?.targetPickOverall)}
            targetTeam={state.teams?.[state.picks?.find(p => p.overall === state.tradeModal?.targetPickOverall)?.teamId]}
            userTeamId={userTeamId}
            userTeam={userTeam}
            userCurrentPicks={userCurrentPicks}
            userFuturePicks={userFuturePicks}
            allFuturePicks={state.futurePicks ?? []}
            allPicks={state.allPicks ?? state.picks ?? []}
            allTeams={state.teams ?? {}}
            currentPickOverall={currentPick?.overall ?? 999}
            sessionMode={state.session?.mode}
            onConfirmTrade={executeTrade}
            onClose={closeTradeModal}
          />
        )}
      </>
    )
  }

  // Shared sub-components
  const draftHeader = (
    <DraftHeader
      currentPick={currentPick}
      team={currentTeam}
      isUserTurn={isUserTurn}
      fastSim={state.fastSim}
      isPaused={state.isPaused}
      isObserver={state.session?.mode === 'observe'}
      totalPicks={state.picks?.length ?? 257}
      onTrade={() => {
        if (isUserTurn && userCurrentPicks.length > 0) {
          openTradeModal('DOWN', userCurrentPicks[0].overall)
        } else if (!isUserTurn && currentPick) {
          openTradeModal('UP', currentPick.overall)
        }
      }}
      onTogglePause={togglePause}
      onToggleFastSim={toggleFastSim}
      onSkipToMyPick={skipToUserPick}
      isSkipping={state.skipToUserPick}
      hasUpcomingUserPick={!isUserTurn && !isDraftComplete}
    />
  )

  const draftBoard = (
    <DraftBoard
      picks={state.picks ?? []}
      selectedPlayers={state.selectedPlayers}
      teams={state.teams ?? {}}
      currentPickOverall={currentPick?.overall}
      userTeamIds={userTeamIds}
      inspectedOverall={inspectedPick?.overall}
      onPickClick={handlePickClick}
    />
  )

  const isPredictiveMode = state.session?.mode === 'predictive'

  const bigBoard = (
    <BigBoard
      availablePlayers={state.availablePlayers}
      scoredForTeam={state.lastPick?.scoredBoard ?? null}
      currentTeamId={currentPick?.teamId}
      onPlayerSelect={makeUserPick}
      isUserTurn={isUserTurn && !state.isPaused}
      filterPosition={null}
    />
  )

  const teamPanel = userTeam ? (
    <TeamPanel
      team={userTeam}
      userPicks={userAllPicks}
      selectedPlayers={state.selectedPlayers}
      remainingNeeds={userTeam.needs ?? []}
      currentRound={currentPick?.round ?? 1}
      isUserTurn={isUserTurn && !state.isPaused}
    />
  ) : null

  return (
    <div className={styles.draftRoom}>
      {draftHeader}

      {isMobile ? (
        /* ── MOBILE LAYOUT: tabbed interface ── */
        <>
          {isUserTurn && !state.isPaused && (
            <div className={styles.userPickBanner}>
              <p className={styles.yourTurn}>{isPredictiveMode ? 'YOUR PREDICTION' : 'YOUR PICK'}</p>
            </div>
          )}

          <div className={styles.mobileContent}>
            {mobileTab === 'board' && (
              <div className={styles.mobilePanel}>
                {draftBoard}
              </div>
            )}
            {mobileTab === 'picks' && (
              <div className={styles.mobilePanel}>
                {bigBoard}
              </div>
            )}
            {mobileTab === 'team' && teamPanel && (
              <div className={styles.mobilePanel}>
                {teamPanel}
              </div>
            )}
          </div>

          {/* Mobile slide-up reasoning sheet */}
          {inspectedPick && displayPlayer && (
            <div className={styles.mobileSheetOverlay} onClick={() => setInspectedPick(null)}>
              <div className={styles.mobileSheet} onClick={e => e.stopPropagation()}>
                <div className={styles.mobileSheetHandle} />
                <div className={styles.mobileSheetHeader}>
                  <div className={styles.mobileSheetPickInfo}>
                    <span className={styles.mobileSheetTeam} style={{ color: displayTeam?.colors?.primary ?? '#d4a843' }}>
                      {displayTeam?.abbreviation ?? ''}
                    </span>
                    <span className={styles.mobileSheetPick}>PICK #{inspectedPick.overall}</span>
                  </div>
                  <button className={styles.mobileSheetClose} onClick={() => setInspectedPick(null)}>X</button>
                </div>
                <div className={styles.mobileSheetPlayer}>
                  <span className={styles.mobileSheetName}>{displayPlayer.name}</span>
                  <span className={styles.mobileSheetPos} style={{ background: POSITION_COLORS[displayPlayer.position] ?? '#555' }}>
                    {displayPlayer.position}
                  </span>
                </div>
                <p className={styles.mobileSheetSchool}>{displayPlayer.school}</p>

                {displayReasoning?.headline && (
                  <p className={styles.mobileSheetHeadline}>{displayReasoning.headline}</p>
                )}

                {displayReasoning?.needAnalysis && (
                  <div className={styles.mobileSheetRow}>
                    <span className={styles.mobileSheetLabel}>NEED</span>
                    <span className={styles.mobileSheetText}>{displayReasoning.needAnalysis}</span>
                  </div>
                )}
                {displayReasoning?.consensusAnalysis && (
                  <div className={styles.mobileSheetRow}>
                    <span className={styles.mobileSheetLabel}>CONSENSUS</span>
                    <span className={styles.mobileSheetText}>{displayReasoning.consensusAnalysis}</span>
                  </div>
                )}
                {displayReasoning?.regimeAnalysis && (
                  <div className={styles.mobileSheetRow}>
                    <span className={styles.mobileSheetLabel}>REGIME</span>
                    <span className={styles.mobileSheetText}>{displayReasoning.regimeAnalysis}</span>
                  </div>
                )}

                {displayReasoning?.allQuotes?.length > 0 && (
                  <div className={styles.mobileSheetSources}>
                    <span className={styles.mobileSheetLabel}>SOURCES</span>
                    {displayReasoning.allQuotes.map((q, i) => (
                      <div key={i} className={styles.mobileSheetQuote}>
                        <span className={styles.mobileSheetWriter}>{q.writer}</span>
                        {q.quote && <p className={styles.mobileSheetQuoteText}>"{q.quote}"</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className={styles.mobileTabBar}>
            <button
              className={`${styles.mobileTab} ${mobileTab === 'board' ? styles.mobileTabActive : ''}`}
              onClick={() => setMobileTab('board')}
            >
              DRAFT
            </button>
            <button
              className={`${styles.mobileTab} ${mobileTab === 'picks' ? styles.mobileTabActive : ''}`}
              onClick={() => setMobileTab('picks')}
            >
              {isUserTurn && !state.isPaused ? (isPredictiveMode ? 'PREDICT' : 'PICK') : 'BOARD'}
            </button>
            {teamPanel && (
              <button
                className={`${styles.mobileTab} ${mobileTab === 'team' ? styles.mobileTabActive : ''}`}
                onClick={() => setMobileTab('team')}
              >
                MY TEAM
              </button>
            )}
          </div>
        </>
      ) : (
        /* ── DESKTOP LAYOUT: 3-column grid ── */
        <div
          className={`${styles.mainLayout} ${!userTeam ? styles.observerMode : ''}`}
          style={{ gridTemplateColumns: userTeam ? `260px 1fr ${rightColWidth}px` : `1fr ${rightColWidth}px` }}
        >
          {teamPanel}

          <div className={styles.centerColumn}>
            {isUserTurn && !state.isPaused && (
              <div className={styles.userPickBanner}>
                <p className={styles.yourTurn}>
                  {isPredictiveMode
                    ? "YOUR PREDICTION — Who will your team take here?"
                    : "YOUR PICK — Select a player from the Big Board"}
                </p>
              </div>
            )}
            {state.isPaused && (
              <div className={styles.pausedBanner}>
                <p className={styles.pausedText}>DRAFT PAUSED</p>
              </div>
            )}
            {draftBoard}
          </div>

          <div className={styles.rightColumn} style={{ position: 'relative' }}>
            <div
              className={styles.resizeDivider}
              onMouseDown={handleDividerMouseDown}
              title="Drag to resize"
            />

            {inspectedPick ? (
              <div className={styles.inspectedBanner}>
                <span className={styles.inspectedLabel}>
                  PICK #{inspectedPick.overall} — {displayTeam?.abbreviation ?? ''}
                </span>
                <button className={styles.inspectedClear} onClick={() => setInspectedPick(null)}>
                  BACK TO LATEST
                </button>
              </div>
            ) : (
              <LastPickBanner pick={state.lastPick} teams={state.teams} />
            )}

            {displayReasoning && (
              <PickReasoning
                reasoning={displayReasoning}
                player={displayPlayer}
                team={displayTeam}
                isVisible={true}
              />
            )}

            {bigBoard}
          </div>
        </div>
      )}

      {/* Trade modal — user-initiated only */}
      {state.tradeModal?.isOpen && (
        <TradeModal
          isOpen={state.tradeModal?.isOpen}
          direction={state.tradeModal?.direction}
          targetPick={state.picks?.find(p => p.overall === state.tradeModal?.targetPickOverall)}
          targetTeam={state.teams?.[state.picks?.find(p => p.overall === state.tradeModal?.targetPickOverall)?.teamId]}
          userTeamId={userTeamId}
          userTeam={userTeam}
          userCurrentPicks={userCurrentPicks}
          userFuturePicks={userFuturePicks}
          allFuturePicks={state.futurePicks ?? []}
          allPicks={state.allPicks ?? state.picks ?? []}
          allTeams={state.teams ?? {}}
          currentPickOverall={currentPick?.overall ?? 999}
          sessionMode={state.session?.mode}
          onConfirmTrade={executeTrade}
          onClose={closeTradeModal}
        />
      )}

      <SourceScraper
        isOpen={isScraperOpen}
        onClose={handleScraperClose}
        onIntelFound={handleIntelFound}
        teams={state.teams}
      />
    </div>
  )
}
