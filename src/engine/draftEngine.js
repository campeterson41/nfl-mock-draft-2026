import { calculateDesireScore, buildBeatWriterIndex } from './scoreUtils.js'

/**
 * Core AI pick selection.
 * Given the current draft state, returns the best player for the picking team
 * along with a full reasoning breakdown for display.
 */
export function selectAIPick({
  teamId,
  team,
  regime,
  availablePlayers,
  beatWriterData,
  nationalAnalystData,
  currentPickOverall = 0,
}) {
  // Build beat writer index for this team (playerId -> signals)
  const beatWriterLinks = buildBeatWriterIndex(beatWriterData, teamId)

  // Merge in national analyst signals
  mergeNationalAnalystSignals(beatWriterLinks, nationalAnalystData, teamId)

  // Score every available player for this team
  const scoredPlayers = availablePlayers.map((player) => {
    const scoreBreakdown = calculateDesireScore({
      player,
      team,
      regime,
      beatWriterLinks,
      currentPickOverall,  // passed through for mock range reality check
    })
    return { player, ...scoreBreakdown }
  })

  // Sort descending by finalScore
  scoredPlayers.sort((a, b) => b.finalScore - a.finalScore)

  const selection = scoredPlayers[0]
  if (!selection) return null

  const reasoning = buildReasoningCard(selection, team, regime, beatWriterLinks)

  return {
    teamId,
    playerId: selection.player.id,
    player: selection.player,
    reasoning,
    scoredBoard: scoredPlayers.slice(0, 15), // top 15 for big board display
  }
}

/**
 * Merge national analyst signals into the beat writer index.
 * National analysts get higher base strength.
 */
function mergeNationalAnalystSignals(index, nationalAnalystData, teamId) {
  if (!nationalAnalystData) return

  const teamLinks = nationalAnalystData[teamId]
  if (!teamLinks) return

  for (const link of teamLinks) {
    if (!index[link.playerId]) {
      index[link.playerId] = {
        totalStrength: 0,
        isInsiderLanguage: false,
        writerCount: 0,
        quotes: [],
      }
    }
    index[link.playerId].totalStrength += link.strength
    index[link.playerId].writerCount += 1
    if (link.isInsiderLanguage) {
      index[link.playerId].isInsiderLanguage = true
    }
    if (link.quote) {
      index[link.playerId].quotes.push({
        writer: link.analyst,
        outlet: link.outlet,
        quote: link.quote,
        isInsider: link.isInsiderLanguage,
        isNational: true,
      })
    }
  }
}

/**
 * Build the human-readable reasoning card shown after each pick.
 */
function buildReasoningCard(selection, team, regime, beatWriterLinks) {
  const { player, baseScore, needMultiplier, beatWriterBonus, insiderBonus, regimeMultiplier, finalScore } = selection

  const needRank = team.needs.indexOf(player.position) + 1
  const positionMatchesTopNeed = needRank === 1
  const positionIsTopThreeNeed = needRank <= 3 && needRank > 0

  const bwData = beatWriterLinks[player.id]
  const writerCount = bwData?.writerCount ?? 0
  const hasInsider = bwData?.isInsiderLanguage ?? false
  const quotes = bwData?.quotes ?? []

  let headline
  if (positionMatchesTopNeed) {
    headline = `${team.nickname} address their top need at ${player.position}`
  } else if (positionIsTopThreeNeed) {
    headline = `${team.nickname} fill a top-3 need, taking ${player.position}`
  } else if (beatWriterBonus > 30) {
    headline = `${team.nickname} follow the intel — writers linked them to this ${player.position}`
  } else {
    headline = `${team.nickname} take the best player available at ${player.position}`
  }

  // Build analyst names list for beat writer analysis
  const analystNames = quotes.map(q => `${q.writer} (${q.outlet})`).slice(0, 5)
  const analystList = analystNames.length > 0 ? analystNames.join(', ') : null

  return {
    headline,
    needAnalysis: needRank > 0
      ? `${player.position} is the #${needRank} ranked need for ${team.nickname}`
      : `${player.position} is not a primary need for ${team.nickname}`,
    consensusAnalysis: `Consensus big board rank: #${player.rank}`,
    beatWriterAnalysis: writerCount > 0
      ? `${writerCount} reporter${writerCount > 1 ? 's' : ''} linked ${team.abbreviation} to ${player.name}${analystList ? ` — ${analystList}` : ''}`
      : `No significant reporter connections found for this pairing`,
    insiderAnalysis: hasInsider
      ? `INSIDER SIGNAL: A reporter with direct knowledge linked this team to this player`
      : null,
    regimeAnalysis: `${regime.gm} (${regime.hc}) — ${regime.historicalNotes ?? `${player.position} fits this regime's draft philosophy`}`,
    topQuote: quotes.find(q => q.isInsider) ?? quotes[0] ?? null,
    allQuotes: quotes,
    scoreBreakdown: {
      base: parseFloat(baseScore.toFixed(1)),
      afterNeed: parseFloat((baseScore * needMultiplier).toFixed(1)),
      afterBeatWriter: parseFloat((baseScore * needMultiplier + beatWriterBonus + insiderBonus).toFixed(1)),
      afterRegime: parseFloat(((baseScore * needMultiplier + beatWriterBonus + insiderBonus) * regimeMultiplier).toFixed(1)),
      final: parseFloat(finalScore.toFixed(1)),
    },
  }
}

/**
 * Get the AI pick for a team that is on the clock but user is not controlling.
 * Returns the full pick result immediately (caller handles timing/animation).
 */
export function getAIPick(state, teamId, allData) {
  const { teams, regimes, availablePlayers, beatWriters, nationalAnalysts } = allData
  const team = teams[teamId]
  const regime = regimes[team.regimeId]

  if (!team || !regime) {
    console.error(`Missing team or regime data for ${teamId}`)
    return null
  }

  // Get the current pick's overall number for mock range reality check
  const currentPickOverall = state.picks?.[state.currentPickIndex]?.overall ?? 0

  return selectAIPick({
    teamId,
    team,
    regime,
    availablePlayers,
    beatWriterData: beatWriters,
    nationalAnalystData: nationalAnalysts,
    currentPickOverall,
  })
}
