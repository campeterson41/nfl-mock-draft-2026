import tradeChartData from '../data/tradeChart.json'

/**
 * Get the Jimmy Johnson chart value for a specific overall pick number.
 * Uses linear interpolation between defined chart points.
 */
export function getPickValue(overall) {
  if (!overall || overall < 1 || overall > 256) return 0

  const chart = tradeChartData.picks
  const keys = Object.keys(chart).map(Number).sort((a, b) => a - b)

  // Exact match
  if (chart[overall] !== undefined) return chart[overall]

  // Linear interpolation
  const lower = keys.filter((k) => k < overall).at(-1)
  const upper = keys.find((k) => k > overall)

  if (lower === undefined) return chart[keys[0]]
  if (upper === undefined) return 0

  const lowerVal = chart[lower]
  const upperVal = chart[upper]
  const fraction = (overall - lower) / (upper - lower)

  return Math.round(lowerVal + fraction * (upperVal - lowerVal))
}

/**
 * Get the value of a future pick.
 */
export function getFuturePickValue(futurePick) {
  if (!futurePick) return 0
  const yearData = tradeChartData.futurePickValues?.[futurePick.year]
  if (!yearData) return 0

  const roundKey = futurePick.round === 1 ? '1st' : '2nd'
  const key = `${roundKey}_${futurePick.projectedRange ?? 'mid'}`
  return yearData[key] ?? 0
}

/**
 * Calculate total value of a trade package (mix of 2026 picks + future picks).
 */
export function calculatePackageValue(currentPicks = [], futurePicks = []) {
  const currentValue = currentPicks.reduce(
    (sum, pick) => sum + getPickValue(pick.overall),
    0
  )
  const futureValue = futurePicks.reduce(
    (sum, fp) => sum + getFuturePickValue(fp),
    0
  )

  return {
    currentValue,
    futureValue,
    totalValue: currentValue + futureValue,
    breakdown: {
      picks: currentPicks.map((p) => ({
        label: `2026 Pick #${p.overall} (Rd ${p.round}, Pick ${p.roundPick})`,
        value: getPickValue(p.overall),
      })),
      futurePicks: futurePicks.map((fp) => ({
        label: `${fp.year} ${fp.round === 1 ? '1st' : '2nd'} Rd (${fp.projectedRange ?? 'mid'})`,
        value: getFuturePickValue(fp),
      })),
    },
  }
}

/**
 * Evaluate whether an AI team would accept a trade offer.
 *
 * tradeType: 'UP' = user wants to move up (gives picks to get an earlier pick)
 *            'DOWN' = user wants to move back (gives a pick to receive later picks)
 */
export function evaluateTradeOffer({
  targetPick,          // the pick being acquired by the user
  userGiving,          // { picks: [], futurePicks: [] } — what user gives away
  userReceiving,       // { picks: [], futurePicks: [] } — what user gets back (besides targetPick)
  targetTeam,
}) {
  const targetPickValue = getPickValue(targetPick.overall)
  const givingValue = calculatePackageValue(userGiving.picks, userGiving.futurePicks)
  const receivingValue = calculatePackageValue(userReceiving.picks, userReceiving.futurePicks)

  // For trade UP: AI team gives up targetPick, receives user's offering
  // Net value to AI team = givingValue.totalValue - receivingValue.totalValue
  // (They're getting the offering and giving back the target + extra picks)
  const netValueToAI = givingValue.totalValue - receivingValue.totalValue
  const fairThreshold = targetPickValue * 0.85 // 15% discount accepted

  // Need bonus: AI teams with many needs are more willing to accept pick hauls
  const needBonus = computeNeedBonus(userGiving.picks, targetTeam)

  const adjustedNetValue = netValueToAI + needBonus
  const willAccept = adjustedNetValue >= fairThreshold
  const surplus = adjustedNetValue - fairThreshold
  const surplusPercent = fairThreshold > 0
    ? ((surplus / fairThreshold) * 100).toFixed(1)
    : '0'

  let verdict
  if (willAccept) {
    verdict = surplus > fairThreshold * 0.25
      ? 'STRONGLY ACCEPT — Great value received'
      : 'ACCEPT — Fair value'
  } else {
    verdict = surplus < -(fairThreshold * 0.25)
      ? 'DECLINE — Insufficient value'
      : 'COUNTER — Close, but not quite'
  }

  return {
    willAccept,
    targetPickValue,
    givingValue: givingValue.totalValue,
    receivingValue: receivingValue.totalValue,
    netValueToAI,
    needBonus,
    adjustedNetValue,
    fairThreshold,
    surplusPercent,
    verdict,
    breakdown: {
      giving: givingValue.breakdown,
      receiving: receivingValue.breakdown,
      targetPick: { label: `2026 Pick #${targetPick.overall}`, value: targetPickValue },
    },
  }
}

/**
 * Teams with more unmet needs value an additional pick more highly.
 * Adds a small bonus to make trades more realistic.
 */
function computeNeedBonus(offeredPicks, team) {
  const pickCount = offeredPicks.length
  const needCount = team.needs?.length ?? 5

  // More picks = better for teams with many needs
  const pickBonus = pickCount > 1 ? 40 * (pickCount - 1) : 0
  // More needs = slightly more willing to trade back for picks
  const needDepthBonus = needCount > 6 ? 60 : needCount > 4 ? 30 : 0

  return pickBonus + needDepthBonus
}

/**
 * Find AI teams that might be willing to trade UP with the user.
 * Returns teams ordered by how likely they are to want the target pick.
 */
export function findTradePartners(targetPickOverall, allPicks, teams, availablePlayers) {
  // Teams picking after the target pick that might want to move up
  const laterPicks = allPicks.filter(
    (p) => p.overall > targetPickOverall && !p.isMadeByUser
  )

  // Deduplicate to one entry per team
  const seenTeams = new Set()
  const partners = []

  for (const pick of laterPicks) {
    if (seenTeams.has(pick.teamId)) continue
    seenTeams.add(pick.teamId)

    const team = teams[pick.teamId]
    if (!team) continue

    // Check if there's a player they'd strongly want that's near the top of available
    const topAvailable = availablePlayers.slice(0, 10)
    const hasUrgentNeed = topAvailable.some(
      (p) => (team.needWeights[p.position] ?? 1.0) >= 2.0
    )

    partners.push({
      teamId: pick.teamId,
      team,
      earliestPick: pick,
      hasUrgentNeed,
      interestLevel: hasUrgentNeed ? 'HIGH' : 'MEDIUM',
    })

    if (partners.length >= 8) break
  }

  return partners
}
