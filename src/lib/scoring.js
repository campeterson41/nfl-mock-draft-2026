// Scoring algorithm for Predictive Mock Group competitions.
//
// Pure functions — no React, no I/O. Given a `submission` (one member's
// predictions) and `actuals` (entered post-draft), returns a breakdown of
// points with the running total.
//
// Point values are tuned for fun rather than mathematical elegance.
// Late-round hits are worth MORE than early-round hits because they're
// far harder to predict accurately. Trade predictions are rewarded
// generously because they're the hardest thing to call.

// Gentle upward curve — later rounds are harder to predict, so they're
// worth a bit more. But not dramatically: a R7 hit is ~2x a R1 hit, not 6x.
const ROUND_BASE_POINTS = {
  1: 13,
  2: 15,
  3: 17,
  4: 19,
  5: 21,
  6: 23,
  7: 25,
}

function roundFromOverall(overall) {
  if (overall <= 32) return 1
  if (overall <= 64) return 2
  if (overall <= 102) return 3
  if (overall <= 138) return 4
  if (overall <= 176) return 5
  if (overall <= 221) return 6
  return 7
}


/**
 * Score a single member's submission against the actuals document.
 *
 * @param {Object} submission  - { name, picks, trades }
 * @param {Object} actuals     - { picks, trades }
 * @param {Object} players     - players data (array) for position-match bonus
 * @param {string} [teamId]    - the group's locked team (used for same-team near-hits)
 * @returns {{ total: number, breakdown: Array }}
 */
export function scoreSubmission(submission, actuals, players = [], teamId = null) {
  const playerMap = {}
  for (const p of players) playerMap[p.id] = p

  const breakdown = []
  let total = 0

  // ── Score PICKS ────────────────────────────────────────────────────
  for (const [overallStr, predictedPlayerId] of Object.entries(submission.picks ?? {})) {
    const overall = Number(overallStr)
    const actualPick = actuals.picks?.[overallStr]
    if (!actualPick) continue  // Actual not yet entered for this slot — skip

    const round = roundFromOverall(overall)
    const basePoints = ROUND_BASE_POINTS[round] ?? 10

    // Exact hit: right player, right pick slot
    if (actualPick.playerId === predictedPlayerId) {
      total += basePoints
      breakdown.push({
        type: 'exact',
        overall,
        predictedPlayerId,
        actualPlayerId: actualPick.playerId,
        points: basePoints,
      })
      continue
    }

    // Same-team near-hit: the predicted player WAS picked by the user's team,
    // just at a different slot (e.g. they traded back a few spots).
    // Only scores if we know the team and the team actually picked that player.
    if (teamId) {
      const teamEntry = Object.entries(actuals.picks ?? {}).find(
        ([, pick]) => pick?.teamId === teamId && pick?.playerId === predictedPlayerId
      )
      if (teamEntry) {
        const actualOverall = Number(teamEntry[0])
        const actualRound = roundFromOverall(actualOverall)
        let nearPoints = 0
        let reason = null
        if (actualRound === round) {
          nearPoints = Math.round(basePoints * 0.5)  // same round — 50% credit
          reason = 'same-round'
        } else if (Math.abs(actualRound - round) === 1) {
          nearPoints = Math.round(basePoints * 0.25) // adjacent round — 25% credit
          reason = 'adjacent-round'
        }
        if (nearPoints > 0) {
          total += nearPoints
          breakdown.push({
            type: 'near',
            overall,
            predictedPlayerId,
            actualPlayerId: actualPick.playerId,
            actualOverall,
            actualRound,
            points: nearPoints,
            reason,
          })
          continue
        }
      }
    }

    // Position consolation: right position at this slot, wrong player
    const predictedPlayer = playerMap[predictedPlayerId]
    const actualPlayer   = playerMap[actualPick.playerId]
    if (predictedPlayer && actualPlayer && predictedPlayer.position === actualPlayer.position) {
      total += 3
      breakdown.push({
        type: 'position',
        overall,
        predictedPlayerId,
        actualPlayerId: actualPick.playerId,
        position: predictedPlayer.position,
        points: 3,
      })
    }
  }

  // ── Score TRADES ───────────────────────────────────────────────────
  //
  // Match each predicted trade against the most-valuable actual trade it
  // partially matches, then award that once (best match wins — avoids
  // double-counting when multiple predicted trades overlap).
  const actualTrades = Array.isArray(actuals.trades) ? actuals.trades : []
  const predictedTrades = Array.isArray(submission.trades) ? submission.trades : []
  const claimedActualIdxs = new Set()

  for (const predicted of predictedTrades) {
    let bestScore = 0
    let bestMatch = null
    let bestIdx = -1

    actualTrades.forEach((actual, idx) => {
      if (claimedActualIdxs.has(idx)) return
      // Predictive mode: only score trades the user's team was actually party to.
      if (teamId && actual.teamAId !== teamId && actual.teamBId !== teamId) return
      const tradeResult = scoreTradeMatch(predicted, actual)
      if (tradeResult.points > bestScore) {
        bestScore = tradeResult.points
        bestMatch = tradeResult
        bestIdx = idx
      }
    })

    if (bestScore > 0 && bestIdx >= 0) {
      claimedActualIdxs.add(bestIdx)
      total += bestScore
      breakdown.push({
        type: 'trade',
        actualTradeIdx: bestIdx,
        detail: bestMatch.detail,
        points: bestScore,
      })
    }
  }

  return { total, breakdown }
}

/**
 * Compare a predicted trade against one actual trade.
 * Returns { points, detail } — points 0 means no match.
 *
 * The predicted trade is framed from the user's team's perspective:
 *   predicted.gave / predicted.received / predicted.partnerId
 *
 * The actual trade from actuals.json lists both teams symmetrically:
 *   { teamAId, teamBId, aSent: {pickOveralls, futurePickIds},
 *     bSent: {pickOveralls, futurePickIds} }
 *
 * We don't know here which team was the user's, so we try both orientations
 * and take the higher score.
 */
function scoreTradeMatch(predicted, actual) {
  const optionA = scoreOriented(predicted, {
    partnerId: actual.teamBId,
    partnerSent: actual.bSent ?? {},
    userSent: actual.aSent ?? {},
  })
  const optionB = scoreOriented(predicted, {
    partnerId: actual.teamAId,
    partnerSent: actual.aSent ?? {},
    userSent: actual.bSent ?? {},
  })
  return optionA.points >= optionB.points ? optionA : optionB
}

function scoreOriented(predicted, oriented) {
  // "Pick moved" base only fires when at least one of the picks the user
  // said they'd GIVE actually shows up in this trade's given picks (exact
  // or within 5 picks). Without that overlap, this prediction simply
  // doesn't apply to this trade — return 0.
  const givenExact = countExactMatches(
    predicted.gave?.pickOveralls ?? [],
    oriented.userSent?.pickOveralls ?? []
  )
  const givenNear  = countNearMatches(
    predicted.gave?.pickOveralls ?? [],
    oriented.userSent?.pickOveralls ?? [],
    5
  )
  if (givenNear === 0) {
    return { points: 0, detail: {} }
  }

  let points = 8  // you correctly called that this pick would be traded
  const detail = { pickMoved: 8 }

  // Correct partner team
  if (predicted.partnerId && predicted.partnerId === oriented.partnerId) {
    points += 4
    detail.partner = 4
  }

  // Correct direction (trade up vs back). Rough proxy based on pick counts.
  const predictedDir = directionOf(predicted.gave, predicted.received)
  const actualDir    = directionOf(oriented.userSent, oriented.partnerSent)
  if (predictedDir && actualDir && predictedDir === actualDir) {
    points += 3
    detail.direction = 3
  }

  // Received side: the user correctly called which picks came back.
  // Exact match = full credit; near-miss (within 5) = partial credit.
  const recvExact = countExactMatches(predicted.received?.pickOveralls, oriented.partnerSent?.pickOveralls)
  const recvNearAll = countNearMatches(predicted.received?.pickOveralls, oriented.partnerSent?.pickOveralls, 5)
  const recvNear = Math.max(0, recvNearAll - recvExact)  // avoid double-counting
  points += recvExact * 8 + recvNear * 3
  if (recvExact) detail.recvExact = recvExact * 8
  if (recvNear > 0) detail.recvNear = recvNear * 3

  return { points, detail }
}

function countExactMatches(a = [], b = []) {
  const bSet = new Set(b)
  let count = 0
  for (const x of a) if (bSet.has(x)) count++
  return count
}

function countNearMatches(a = [], b = [], maxDistance = 5) {
  let count = 0
  for (const x of a) {
    for (const y of b) {
      if (Math.abs(x - y) <= maxDistance) { count++; break }
    }
  }
  return count
}

function directionOf(gave = {}, received = {}) {
  const gaveCount = (gave.pickOveralls?.length ?? 0) + (gave.futurePickIds?.length ?? 0)
  const recvCount = (received.pickOveralls?.length ?? 0) + (received.futurePickIds?.length ?? 0)
  if (gaveCount < recvCount) return 'up'       // gave fewer (but earlier) picks
  if (gaveCount > recvCount) return 'back'     // gave more (later) picks for one earlier
  return null
}

/**
 * Convenience: rank an array of submissions.
 * Returns [{ submission, score: { total, breakdown } }] sorted desc.
 */
export function rankSubmissions(submissions, actuals, players, teamId = null) {
  return submissions
    .map((sub) => ({ submission: sub, score: scoreSubmission(sub, actuals, players, teamId) }))
    .sort((a, b) => b.score.total - a.score.total)
}
