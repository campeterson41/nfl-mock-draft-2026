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
  1: 12,
  2: 14,
  3: 16,
  4: 18,
  5: 20,
  6: 22,
  7: 24,
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

  // Track user-team actual picks that have already been "matched" by a
  // prediction so two predictions don't both claim the same actual pick
  // (e.g. predicting two OTs in R1 when your team took one OT).
  const claimedActualOveralls = new Set()

  // ── Score PICKS ────────────────────────────────────────────────────
  for (const [overallStr, predictedPlayerId] of Object.entries(submission.picks ?? {})) {
    const overall = Number(overallStr)
    const actualPick = actuals.picks?.[overallStr]

    const round = roundFromOverall(overall)
    const basePoints = ROUND_BASE_POINTS[round] ?? 10

    // Predictive mode is about YOUR team. Exact hits and slot position
    // match only fire when the actual pick at this slot was made by the
    // user's team — another team's pick at that slot shouldn't earn credit.
    const slotIsUserTeam = actualPick ? (!teamId || actualPick.teamId === teamId) : false

    // 1. Exact hit: right player, right pick slot — and your team made it
    if (actualPick && slotIsUserTeam && actualPick.playerId === predictedPlayerId) {
      claimedActualOveralls.add(overall)
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

    // 2. Same-team near-hit: predicted player WAS picked by user's team,
    // just at a different slot. Only fires if the team actually drafted
    // that player and we haven't already claimed that actual pick.
    if (teamId) {
      const teamEntry = Object.entries(actuals.picks ?? {}).find(
        ([ovStr, pick]) => pick?.teamId === teamId &&
          pick?.playerId === predictedPlayerId &&
          !claimedActualOveralls.has(Number(ovStr))
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
          claimedActualOveralls.add(actualOverall)
          total += nearPoints
          breakdown.push({
            type: 'near',
            overall,
            predictedPlayerId,
            actualPlayerId: actualPick?.playerId ?? null,
            actualOverall,
            actualRound,
            points: nearPoints,
            reason,
          })
          continue
        }
      }
    }

    // 3. Position match: you called the right position for the round.
    //    Fires either when your team made the pick at the predicted slot
    //    (right position, wrong player), OR when your team made any other
    //    pick in the same round of the matching position. This covers the
    //    common case of predicting "OT in R1" when the trade-up didn't
    //    happen but your team still took OT in R1 at a different slot.
    const predictedPlayer = playerMap[predictedPlayerId]
    if (!predictedPlayer) continue

    let positionMatch = null
    if (actualPick && slotIsUserTeam && !claimedActualOveralls.has(overall)) {
      const actualPlayer = playerMap[actualPick.playerId]
      if (actualPlayer?.position === predictedPlayer.position) {
        positionMatch = { overall, playerId: actualPick.playerId, sameSlot: true }
      }
    }
    if (!positionMatch && teamId) {
      for (const [ovStr, pick] of Object.entries(actuals.picks ?? {})) {
        const actualOverall = Number(ovStr)
        if (claimedActualOveralls.has(actualOverall)) continue
        if (pick?.teamId !== teamId || !pick?.playerId) continue
        if (roundFromOverall(actualOverall) !== round) continue
        const ap = playerMap[pick.playerId]
        if (ap?.position === predictedPlayer.position) {
          positionMatch = { overall: actualOverall, playerId: pick.playerId, sameSlot: false }
          break
        }
      }
    }
    if (positionMatch) {
      claimedActualOveralls.add(positionMatch.overall)
      total += 5
      breakdown.push({
        type: 'position',
        overall,
        predictedPlayerId,
        actualPlayerId: positionMatch.playerId,
        actualOverall: positionMatch.overall,
        position: predictedPlayer.position,
        sameSlot: positionMatch.sameSlot,
        points: 5,
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

  // pickMoved base: nailing the exact pick number is more credit than
  // "you said pick 50, pick 53 actually moved." 6 / 3 split.
  const pickMovedPts = givenExact > 0 ? 6 : 3
  let points = pickMovedPts
  const detail = { pickMoved: pickMovedPts }

  // Correct partner team — this is the "you knew WHO they'd trade with"
  // signal, hardest to fake. Weighted equally with direction.
  if (predicted.partnerId && predicted.partnerId === oriented.partnerId) {
    points += 6
    detail.partner = 6
  }

  // Correct direction (trade up vs back) — the "called the move" signal.
  const predictedDir = directionOf(predicted.gave, predicted.received)
  const actualDir    = directionOf(oriented.userSent, oriented.partnerSent)
  if (predictedDir && actualDir && predictedDir === actualDir) {
    points += 6
    detail.direction = 6
  }

  // Received side: the user correctly called which picks came back.
  // Exact match = full credit; near-miss (within 5) = small consolation.
  // recvNear deliberately small — being "in the neighborhood" of a real
  // received pick shouldn't be worth nearly as much as nailing it.
  const recvExact = countExactMatches(predicted.received?.pickOveralls, oriented.partnerSent?.pickOveralls)
  const recvNearAll = countNearMatches(predicted.received?.pickOveralls, oriented.partnerSent?.pickOveralls, 5)
  const recvNear = Math.max(0, recvNearAll - recvExact)  // avoid double-counting
  points += recvExact * 8 + recvNear * 2
  if (recvExact) detail.recvExact = recvExact * 8
  if (recvNear > 0) detail.recvNear = recvNear * 2

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
