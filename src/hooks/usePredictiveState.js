import { useReducer, useMemo, useCallback } from 'react'
import playersData from '../data/players.json'
import teamsData from '../data/teams.json'
import picksData from '../data/picks.json'

function buildInitialState(teamId) {
  const allPicks = JSON.parse(JSON.stringify(picksData.picks))
  const futurePicks = JSON.parse(JSON.stringify(picksData.futurePicks))

  const teamPickInventory = {}
  for (const team of Object.values(teamsData)) {
    teamPickInventory[team.id] = {
      currentPicks: allPicks.filter(p => p.teamId === team.id),
      futurePicks: futurePicks.filter(fp => fp.ownerTeamId === team.id),
    }
  }

  return {
    teamId,
    allPicks,
    futurePicks,
    teamPickInventory,
    teams: JSON.parse(JSON.stringify(teamsData)),
    assignments: {},    // overall -> player
    tradeHistory: [],
    tradeModal: { isOpen: false, targetPickOverall: null, direction: null },
  }
}

function reducer(state, action) {
  switch (action.type) {

    case 'ASSIGN_PLAYER': {
      const { overall, player } = action.payload
      return {
        ...state,
        assignments: { ...state.assignments, [overall]: player },
      }
    }

    case 'UNASSIGN_PLAYER': {
      const { overall } = action.payload
      const newAssignments = { ...state.assignments }
      delete newAssignments[overall]
      return { ...state, assignments: newAssignments }
    }

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
      const { userTeamId, targetTeamId, userGiving, userReceiving, targetPickOverall } = action.payload

      const applyTrade = (picksArr) => picksArr.map(pick => {
        if (userGiving.pickOveralls?.includes(pick.overall)) {
          return { ...pick, teamId: targetTeamId }
        }
        if (userReceiving.pickOveralls?.includes(pick.overall) || pick.overall === targetPickOverall) {
          return { ...pick, teamId: userTeamId }
        }
        return pick
      })

      const newAllPicks = applyTrade(state.allPicks)

      const newFuturePicks = state.futurePicks.map(fp => {
        if (userGiving.futurePickIds?.includes(fp.id)) {
          return { ...fp, ownerTeamId: targetTeamId }
        }
        if (userReceiving.futurePickIds?.includes(fp.id)) {
          return { ...fp, ownerTeamId: userTeamId }
        }
        return fp
      })

      // Rebuild inventories
      const newInventory = {}
      for (const team of Object.values(state.teams)) {
        newInventory[team.id] = {
          currentPicks: newAllPicks.filter(p => p.teamId === team.id),
          futurePicks: newFuturePicks.filter(fp => fp.ownerTeamId === team.id),
        }
      }

      // Clear assignments for picks the user no longer owns
      const tradedAwayOveralls = userGiving.pickOveralls ?? []
      const newAssignments = { ...state.assignments }
      for (const ov of tradedAwayOveralls) {
        delete newAssignments[ov]
      }

      return {
        ...state,
        allPicks: newAllPicks,
        futurePicks: newFuturePicks,
        teamPickInventory: newInventory,
        assignments: newAssignments,
        tradeModal: { isOpen: false, targetPickOverall: null, direction: null },
        tradeHistory: [...state.tradeHistory, {
          userTeamId,
          targetTeamId,
          gave: {
            pickOveralls: userGiving.pickOveralls ?? [],
            futurePickIds: userGiving.futurePickIds ?? [],
          },
          received: {
            pickOveralls: [
              ...(userReceiving.pickOveralls ?? []),
              ...(targetPickOverall && !(userReceiving.pickOveralls ?? []).includes(targetPickOverall) ? [targetPickOverall] : []),
            ],
            futurePickIds: userReceiving.futurePickIds ?? [],
          },
        }],
      }
    }

    default:
      return state
  }
}

export function usePredictiveState(teamId) {
  const [state, dispatch] = useReducer(reducer, teamId, buildInitialState)

  const teamPicks = useMemo(
    () => state.allPicks
      .filter(p => p.teamId === state.teamId)
      .sort((a, b) => a.overall - b.overall),
    [state.allPicks, state.teamId]
  )

  const allPlayers = useMemo(
    () => [...playersData].sort((a, b) => a.rank - b.rank),
    []
  )

  const assignedPlayerIds = useMemo(
    () => new Set(Object.values(state.assignments).map(p => p.id)),
    [state.assignments]
  )

  const availablePlayers = useMemo(
    () => allPlayers.filter(p => !assignedPlayerIds.has(p.id)),
    [allPlayers, assignedPlayerIds]
  )

  const isComplete = useMemo(
    () => teamPicks.length > 0 && teamPicks.every(p => state.assignments[p.overall]),
    [teamPicks, state.assignments]
  )

  const getSuggestions = useCallback((pickOverall) => {
    return availablePlayers
      .map(p => ({
        ...p,
        distance: Math.abs((p.mockRange?.consensus ?? p.rank) - pickOverall),
      }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 50)
  }, [availablePlayers])

  const assignPlayer = useCallback((overall, player) => {
    dispatch({ type: 'ASSIGN_PLAYER', payload: { overall, player } })
  }, [])

  const unassignPlayer = useCallback((overall) => {
    dispatch({ type: 'UNASSIGN_PLAYER', payload: { overall } })
  }, [])

  const openTradeModal = useCallback((targetPickOverall, direction) => {
    dispatch({ type: 'OPEN_TRADE_MODAL', payload: { targetPickOverall, direction } })
  }, [])

  const closeTradeModal = useCallback(() => {
    dispatch({ type: 'CLOSE_TRADE_MODAL' })
  }, [])

  const executeTrade = useCallback((tradePayload) => {
    dispatch({ type: 'EXECUTE_TRADE', payload: tradePayload })
  }, [])

  return {
    state,
    teamPicks,
    allPlayers,
    availablePlayers,
    assignedPlayerIds,
    isComplete,
    getSuggestions,
    assignPlayer,
    unassignPlayer,
    openTradeModal,
    closeTradeModal,
    executeTrade,
  }
}
