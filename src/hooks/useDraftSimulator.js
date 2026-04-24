import { useReducer, useCallback, useEffect, useRef, useMemo } from 'react'
import playersData from '../data/players.json'
import teamsData from '../data/teams.json'
import regimesData from '../data/regimes.json'
import picksData from '../data/picks.json'
import beatwritersData from '../data/beatwriters.json'
import nationalAnalystsData from '../data/nationalAnalysts.json'
import { getAIPick } from '../engine/draftEngine.js'
import { WEIGHTS } from '../constants/weights.js'

function buildInitialState(sessionConfig) {
  if (!sessionConfig) return { phase: 'idle' }

  // Keep ALL picks in state (needed for trades), but only sim through numRounds
  const numRounds = sessionConfig.numRounds ?? 7
  const allPicks = JSON.parse(JSON.stringify(picksData.picks))
  const futurePicks = JSON.parse(JSON.stringify(picksData.futurePicks))
  const teams = JSON.parse(JSON.stringify(teamsData))

  // If resuming from the live draft, apply seeded picks: override pick
  // ownership (to reflect live trades), fill selectedPlayers, reduce team
  // need weights so AI picks beyond the seed stay in character, and advance
  // the cursor past the already-drafted slots.
  const seedPicks = sessionConfig.seedPicks ?? {}
  const seededOveralls = Object.keys(seedPicks)
    .map(n => Number(n))
    .filter(n => seedPicks[n]?.playerId && seedPicks[n]?.teamId)

  // 1. Override pick ownership for seeded slots so trades are reflected.
  for (const overall of seededOveralls) {
    const seed = seedPicks[overall]
    const pick = allPicks.find(p => p.overall === overall)
    if (pick) pick.teamId = seed.teamId
  }

  const activePicks = allPicks.filter(p => p.round <= numRounds)

  // 2. Build selectedPlayers map + track drafted player ids to remove from pool.
  const selectedPlayers = {}
  const draftedIds = new Set()
  const playerById = Object.fromEntries(playersData.map(p => [p.id, p]))
  for (const overall of seededOveralls) {
    const seed = seedPicks[overall]
    const player = playerById[seed.playerId]
    if (!player) continue
    selectedPlayers[overall] = {
      player,
      teamId: seed.teamId,
      reasoning: { summary: 'Actual 2026 NFL Draft pick.' },
    }
    draftedIds.add(player.id)

    // Apply the same needWeight reduction MAKE_PICK uses, so AI logic
    // downstream doesn't double-up on positions the team already addressed.
    const team = teams[seed.teamId]
    if (team) {
      const pick = allPicks.find(p => p.overall === overall)
      const round = pick?.round ?? Math.min(7, Math.ceil(overall / 37))
      const reduction = round <= 2 ? 1.5 : round <= 4 ? 1.0 : 0.5
      if (team.needWeights?.[player.position] != null) {
        team.needWeights[player.position] = Math.max(
          0.5,
          team.needWeights[player.position] - reduction
        )
      }
    }
  }

  // 3. Build team pick inventory — includes ALL picks for trade purposes.
  const teamPickInventory = {}
  for (const team of Object.values(teams)) {
    teamPickInventory[team.id] = {
      currentPicks: allPicks.filter(p => p.teamId === team.id),
      futurePicks: futurePicks.filter(fp => fp.ownerTeamId === team.id),
    }
  }

  const availablePlayers = [...playersData]
    .filter(p => !draftedIds.has(p.id))
    .sort((a, b) => a.rank - b.rank)

  // 4. Advance the cursor past any seeded slots that fall within activePicks.
  // Seeded picks always fill slots 1..N in order, so currentPickIndex is the
  // count of seeded picks whose overall is <= the last active pick.
  const currentPickIndex = activePicks.filter(
    p => seededOveralls.includes(p.overall)
  ).length

  return {
    phase: 'drafting',
    session: sessionConfig,
    picks: activePicks,       // only the rounds being simulated (for pick progression)
    allPicks,                 // all 257 picks (for trade modal)
    futurePicks,
    teamPickInventory,
    teams,
    regimes: regimesData,
    availablePlayers,
    selectedPlayers,
    currentPickIndex,
    timerActive: false,
    fastSim: false,
    isPaused: false,
    skipToUserPick: false,
    tradeModal: { isOpen: false, targetPickOverall: null, direction: null },
    lastPick: null, // most recent pick result for display
    history: [], // for potential undo
    tradeHistory: [], // completed trades for results screen
  }
}

function reducer(state, action) {
  switch (action.type) {

    case 'INIT_DRAFT':
      return buildInitialState(action.payload.sessionConfig)

    case 'MAKE_PICK': {
      const { overall, player, teamId, reasoning } = action.payload
      const newSelectedPlayers = {
        ...state.selectedPlayers,
        [overall]: { player, teamId, reasoning },
      }
      const newAvailable = state.availablePlayers.filter(p => p.id !== player.id)

      // Update team needs based on pick.
      // DON'T remove the position from the needs array — teams draft multiple
      // players at the same position all the time (e.g. 2 WRs, 2 OL).
      // Instead, reduce the needWeight proportional to the round:
      //   Round 1-2: -1.5 (invested heavily, unlikely to double-dip early)
      //   Round 3-4: -1.0 (solid investment, moderate reduction)
      //   Round 5-7: -0.5 (depth pick, might still want a starter there)
      const newTeams = { ...state.teams }
      if (newTeams[teamId]) {
        const pick = state.picks?.find(p => p.overall === overall)
        const round = pick?.round ?? Math.min(7, Math.ceil(overall / 37))
        let reduction
        if (round <= 2) reduction = 1.5
        else if (round <= 4) reduction = 1.0
        else reduction = 0.5

        const updatedWeights = { ...newTeams[teamId].needWeights }
        if (updatedWeights[player.position] != null) {
          updatedWeights[player.position] = Math.max(
            0.5,
            updatedWeights[player.position] - reduction
          )
        }
        newTeams[teamId] = {
          ...newTeams[teamId],
          needWeights: updatedWeights,
        }
      }

      return {
        ...state,
        selectedPlayers: newSelectedPlayers,
        availablePlayers: newAvailable,
        teams: newTeams,
        currentPickIndex: state.currentPickIndex + 1,
        timerActive: false,
        lastPick: action.payload,
      }
    }

    case 'UNDO_PICK': {
      const { overall } = action.payload
      const filled = state.selectedPlayers?.[overall]
      if (!filled) return state

      // Remove the pick entry
      const newSelected = { ...state.selectedPlayers }
      delete newSelected[overall]

      // Return the player to the available pool, re-sorted by rank
      const newAvailable = [...state.availablePlayers, filled.player]
        .sort((a, b) => a.rank - b.rank)

      // Reverse the needWeight reduction that MAKE_PICK applied
      const newTeams = { ...state.teams }
      const pick = state.picks?.find(p => p.overall === overall)
      const teamId = filled.teamId
      const round = pick?.round ?? Math.min(7, Math.ceil(overall / 37))
      let reduction
      if (round <= 2) reduction = 1.5
      else if (round <= 4) reduction = 1.0
      else reduction = 0.5

      if (newTeams[teamId]) {
        const updatedWeights = { ...newTeams[teamId].needWeights }
        if (updatedWeights[filled.player.position] != null) {
          updatedWeights[filled.player.position] += reduction
        }
        newTeams[teamId] = { ...newTeams[teamId], needWeights: updatedWeights }
      }

      // Clear lastPick if it was this one
      const newLastPick = state.lastPick?.overall === overall ? null : state.lastPick

      return {
        ...state,
        selectedPlayers: newSelected,
        availablePlayers: newAvailable,
        teams: newTeams,
        currentPickIndex: Math.max(0, state.currentPickIndex - 1),
        lastPick: newLastPick,
        phase: 'drafting', // resume if we were complete
      }
    }

    case 'START_TIMER':
      return { ...state, timerActive: true }

    case 'STOP_TIMER':
      return { ...state, timerActive: false }

    case 'TOGGLE_FAST_SIM':
      return { ...state, fastSim: !state.fastSim }

    case 'START_SKIP':
      return { ...state, skipToUserPick: true, isPaused: false }

    case 'STOP_SKIP':
      return { ...state, skipToUserPick: false }

    case 'OPEN_TRADE_MODAL':
      return {
        ...state,
        tradeModal: {
          isOpen: true,
          targetPickOverall: action.payload.targetPickOverall,
          direction: action.payload.direction,
        },
      }

    case 'CLOSE_TRADE_MODAL':
      return { ...state, tradeModal: { isOpen: false, targetPickOverall: null, direction: null } }

    case 'EXECUTE_TRADE': {
      // Swap pick ownership
      const { userTeamId, targetTeamId, userGiving, userReceiving, targetPickOverall } = action.payload

      // Helper: apply trade ownership changes to any picks array
      const applyTrade = (picksArr) => picksArr.map(pick => {
        if (userGiving.pickOveralls?.includes(pick.overall)) {
          return { ...pick, teamId: targetTeamId }
        }
        if (userReceiving.pickOveralls?.includes(pick.overall) || pick.overall === targetPickOverall) {
          return { ...pick, teamId: userTeamId }
        }
        return pick
      })

      const newPicks = applyTrade(state.picks)
      const newAllPicks = applyTrade(state.allPicks ?? state.picks)

      // Handle future picks similarly
      const newFuturePicks = state.futurePicks.map(fp => {
        if (userGiving.futurePickIds?.includes(fp.id)) {
          return { ...fp, ownerTeamId: targetTeamId }
        }
        if (userReceiving.futurePickIds?.includes(fp.id)) {
          return { ...fp, ownerTeamId: userTeamId }
        }
        return fp
      })

      // Rebuild team pick inventories from allPicks (all 257)
      const newInventory = {}
      for (const team of Object.values(state.teams)) {
        newInventory[team.id] = {
          currentPicks: newAllPicks.filter(p => p.teamId === team.id),
          futurePicks: newFuturePicks.filter(fp => fp.ownerTeamId === team.id),
        }
      }

      return {
        ...state,
        picks: newPicks,
        allPicks: newAllPicks,
        futurePicks: newFuturePicks,
        teamPickInventory: newInventory,
        tradeModal: { isOpen: false, targetPickOverall: null, direction: null },
        tradeHistory: [...(state.tradeHistory ?? []), {
          userTeamId,
          targetTeamId,
          gave: {
            pickOveralls: userGiving.pickOveralls ?? [],
            futurePickIds: userGiving.futurePickIds ?? [],
          },
          received: {
            pickOveralls: [...(userReceiving.pickOveralls ?? []), ...(targetPickOverall && !(userReceiving.pickOveralls ?? []).includes(targetPickOverall) ? [targetPickOverall] : [])],
            futurePickIds: userReceiving.futurePickIds ?? [],
          },
        }],
      }
    }

    case 'TOGGLE_PAUSE':
      return { ...state, isPaused: !state.isPaused }

    case 'COMPLETE_DRAFT':
      return { ...state, phase: 'complete' }

    case 'RESET_DRAFT':
      return buildInitialState(state.session)

    default:
      return state
  }
}

export function useDraftSimulator(sessionConfig) {
  const [state, dispatch] = useReducer(reducer, null, () => ({ phase: 'idle' }))
  const aiPickTimeoutRef = useRef(null)

  // Initialize draft when sessionConfig is provided
  useEffect(() => {
    if (sessionConfig) {
      dispatch({ type: 'INIT_DRAFT', payload: { sessionConfig } })
    }
  }, [sessionConfig])

  // Predictive mode: no AI picks happen. currentPick always points to the
  // next unfilled pick owned by the user's team.
  const isPredictiveMode = state.session?.mode === 'predictive'

  // Current pick
  const currentPick = useMemo(() => {
    if (!state.picks) return null
    if (isPredictiveMode) {
      const userTeamIds = state.session?.userTeamIds ?? []
      return state.picks.find(
        p => !state.selectedPlayers?.[p.overall] && userTeamIds.includes(p.teamId)
      ) ?? null
    }
    return state.picks[state.currentPickIndex] ?? null
  }, [state.picks, state.currentPickIndex, state.selectedPlayers, state.session, isPredictiveMode])

  // Is the current pick controlled by the user?
  const isUserTurn = useMemo(
    () => currentPick
      ? (state.session?.userTeamIds ?? []).includes(currentPick.teamId)
      : false,
    [currentPick, state.session]
  )

  // Draft complete check
  const isDraftComplete = useMemo(() => {
    if (!state.picks) return false
    if (isPredictiveMode) {
      const userTeamIds = state.session?.userTeamIds ?? []
      const userPicks = state.picks.filter(p => userTeamIds.includes(p.teamId))
      return userPicks.length > 0 && userPicks.every(p => state.selectedPlayers?.[p.overall])
    }
    return state.currentPickIndex >= state.picks.length
  }, [state.picks, state.currentPickIndex, state.selectedPlayers, state.session, isPredictiveMode])

  // Auto-stop skip mode the moment it becomes the user's turn
  useEffect(() => {
    if (state.skipToUserPick && isUserTurn) {
      dispatch({ type: 'STOP_SKIP' })
    }
  }, [state.skipToUserPick, isUserTurn])

  // Fire AI picks automatically
  useEffect(() => {
    if (state.phase !== 'drafting') return
    if (state.isPaused) return
    if (isPredictiveMode) {
      // In predictive mode, no AI picks ever fire — only user picks move the draft.
      if (isDraftComplete) dispatch({ type: 'COMPLETE_DRAFT' })
      return
    }
    if (isUserTurn) return
    if (isDraftComplete) {
      dispatch({ type: 'COMPLETE_DRAFT' })
      return
    }
    if (!currentPick) return
    if (state.tradeModal?.isOpen) return

    const delay = state.skipToUserPick
      ? 0
      : state.fastSim ? WEIGHTS.AI_PICK_DELAY_FAST : WEIGHTS.AI_PICK_DELAY_DRAMATIC

    dispatch({ type: 'START_TIMER' })
    aiPickTimeoutRef.current = setTimeout(() => {
      const pickResult = getAIPick(state, currentPick.teamId, {
        teams: state.teams,
        regimes: state.regimes,
        availablePlayers: state.availablePlayers,
        beatWriters: beatwritersData,
        nationalAnalysts: nationalAnalystsData,
      })

      if (pickResult) {
        dispatch({
          type: 'MAKE_PICK',
          payload: {
            overall: currentPick.overall,
            teamId: currentPick.teamId,
            player: pickResult.player,
            reasoning: pickResult.reasoning,
            scoredBoard: pickResult.scoredBoard,
          },
        })
      }
    }, delay)

    return () => {
      if (aiPickTimeoutRef.current) clearTimeout(aiPickTimeoutRef.current)
    }
  }, [state.currentPickIndex, state.phase, state.isPaused, isUserTurn, isDraftComplete, state.fastSim, state.skipToUserPick, state.tradeModal?.isOpen])

  // User makes a pick.
  // In predictive mode, `targetPick` can be passed to pick at a specific pick
  // slot (any order). In other modes, `targetPick` is ignored and currentPick
  // is used.
  const makeUserPick = useCallback((player, targetPick = null) => {
    const pick = (isPredictiveMode && targetPick) ? targetPick : currentPick
    if (!pick) return
    if (!isPredictiveMode && !isUserTurn) return
    const userTeamIds = state.session?.userTeamIds ?? []
    if (!userTeamIds.includes(pick.teamId)) return
    dispatch({
      type: 'MAKE_PICK',
      payload: {
        overall: pick.overall,
        teamId: pick.teamId,
        player,
        reasoning: null, // user picks don't get AI reasoning
        scoredBoard: null,
      },
    })
  }, [isUserTurn, currentPick, isPredictiveMode, state.session])

  // Undo a previously-made user pick (clears selection, returns player to pool)
  const undoUserPick = useCallback((overall) => {
    dispatch({ type: 'UNDO_PICK', payload: { overall } })
  }, [])

  const openTradeModal = useCallback((direction, targetPickOverall) => {
    if (aiPickTimeoutRef.current) clearTimeout(aiPickTimeoutRef.current)
    dispatch({ type: 'OPEN_TRADE_MODAL', payload: { direction, targetPickOverall } })
  }, [])

  const closeTradeModal = useCallback(() => {
    dispatch({ type: 'CLOSE_TRADE_MODAL' })
  }, [])

  const executeTrade = useCallback((tradeData) => {
    dispatch({ type: 'EXECUTE_TRADE', payload: tradeData })
  }, [])

  const toggleFastSim = useCallback(() => {
    dispatch({ type: 'TOGGLE_FAST_SIM' })
  }, [])

  const skipToUserPick = useCallback(() => {
    if (aiPickTimeoutRef.current) clearTimeout(aiPickTimeoutRef.current)
    dispatch({ type: 'START_SKIP' })
  }, [])

  const togglePause = useCallback(() => {
    if (aiPickTimeoutRef.current) clearTimeout(aiPickTimeoutRef.current)
    dispatch({ type: 'TOGGLE_PAUSE' })
  }, [])

  const resetDraft = useCallback(() => {
    if (aiPickTimeoutRef.current) clearTimeout(aiPickTimeoutRef.current)
    dispatch({ type: 'RESET_DRAFT' })
  }, [])

  return {
    state,
    currentPick,
    isUserTurn,
    isDraftComplete,
    makeUserPick,
    undoUserPick,
    openTradeModal,
    closeTradeModal,
    executeTrade,
    toggleFastSim,
    togglePause,
    skipToUserPick,
    resetDraft,
    // Convenience selectors
    currentTeam: currentPick ? state.teams?.[currentPick.teamId] : null,
    currentRegime: currentPick && state.teams?.[currentPick.teamId]
      ? state.regimes?.[state.teams[currentPick.teamId].regimeId]
      : null,
  }
}
