import { WEIGHTS } from '../constants/weights.js'

/**
 * Calculate the full desire score for a player-team pairing.
 *
 * Key fix: the rank curve is now exponential, not linear, so the gap
 * between a rank-1 prospect and a rank-38 prospect is large enough that
 * need/regime multipliers can't lift a mid-round player into a top-3 slot.
 *
 * Mock range reality check: if a player's consensus floor (earliest any
 * analyst has projected them) is significantly later than the current pick,
 * their score is heavily penalized. This prevents Ty Simpson (floor: ~36)
 * from going #3 to a QB-needy team.
 *
 * Formula:
 * desireScore = (baseScore × needMultiplier + beatWriterBonus + insiderBonus)
 *               × regimeMult × mockRangePenalty + noise
 */
export function calculateDesireScore({ player, team, regime, beatWriterLinks, currentPickOverall = 0 }) {
  // Step 1: Base score from consensus rank — EXPONENTIAL decay
  // Rank 1 = 100 pts, Rank 10 ≈ 86, Rank 38 ≈ 57, Rank 100 ≈ 22
  // This creates a meaningful gap between true top-10 prospects and late R1 / R2 guys
  const baseScore = 100 * Math.exp(-0.016 * (player.rank - 1))

  // Step 1b: "Fallen too far" urgency boost.
  //
  // When a top prospect is still available well past their consensus pick,
  // every team's score for them gets a compounding urgency multiplier.
  // This prevents Love (consensus #3) from falling to round 2 — by pick 10
  // if he's still there, every team is feeling the pressure to take him.
  //
  // Urgency kicks in when currentPick > (consensus + 3):
  //   3 picks past consensus → 1.15x
  //   6 picks past consensus → 1.30x
  //   10 picks past consensus → 1.50x
  //   15 picks past consensus → 1.75x
  //   20 picks past consensus → 2.0x (cap)
  let urgencyMultiplier = 1.0
  if (currentPickOverall > 0 && player.mockRange?.consensus) {
    const picksPastConsensus = currentPickOverall - player.mockRange.consensus - 3
    if (picksPastConsensus > 0) {
      urgencyMultiplier = Math.min(2.0, 1.0 + picksPastConsensus * 0.05)
    }
  }

  // Step 2: Mock range floor constraint.
  //
  // Each player has a mockRange.floor = the earliest pick any major mock has
  // projected them. If the current pick is before that floor, penalize heavily.
  // This is the user-specified constraint: "if the highest place he's been
  // drafted in any mock is 22, don't have him drafted at 6."
  //
  // Penalty compounds at 0.75× per pick before the floor:
  //   1 pick early → 0.75x   (mild — just outside the edge case)
  //   3 picks early → 0.42x
  //   6 picks early → 0.18x
  //   10 picks early → 0.06x (effectively disqualified)
  //
  // Fallback: if no mockRange.floor data, use rank-based estimate
  let mockRangePenalty = 1.0
  if (currentPickOverall > 0) {
    const floor = player.mockRange?.floor ?? Math.max(1, Math.round(player.rank * 0.6))
    if (currentPickOverall < floor) {
      const picksEarly = floor - currentPickOverall
      mockRangePenalty = Math.max(0.02, Math.pow(0.75, picksEarly))
    }

    // Consensus distance drag: picking before consensus costs draft capital.
    // Stricter in round 1 where picks are more valuable, softer in later rounds
    // where teams regularly reach 5-10 picks for guys they love.
    //
    // Round 1 (0.95^x):  5 early → 0.77x, 10 early → 0.60x (strict)
    // Round 2+ (0.975^x): 5 early → 0.88x, 10 early → 0.78x (soft)
    const consensus = player.mockRange?.consensus ?? player.rank
    if (currentPickOverall < consensus) {
      const picksBeforeConsensus = consensus - currentPickOverall
      const isRound1 = currentPickOverall <= 32
      const decay = isRound1 ? 0.95 : 0.975
      const consensusDrag = Math.max(0.30, Math.pow(decay, picksBeforeConsensus))
      mockRangePenalty *= consensusDrag
    }
  }

  // Step 3: Need multiplier — blended by BPA tendency.
  //
  // Every regime has a `valuesBPA` coefficient (0-1). A regime that values BPA
  // 100% (1.0) ignores positional need entirely and scores every position at
  // 1.0x. A regime that values need 100% (0.0 BPA) uses the raw needWeight.
  //
  // The effective need multiplier is a weighted blend:
  //   effectiveNeed = (rawNeed * valuesNeed) + (1.0 * valuesBPA)
  //
  // This means a 60% BPA team (like Baltimore) treats Love's RB slot as
  // 0.7 * 40% + 1.0 * 60% = 0.88x — much more fairly than pure need weighting.
  //
  // Elite talent override: top prospects go early regardless of positional need.
  // In real drafts, teams don't pass on a top-3 player because of position —
  // they take BPA and figure out the roster later. The needMin floor scales
  // by rank so elite players can't get crushed by need multipliers:
  //   Rank 1-3:   needMin 1.8 (generational — goes top 5 almost always)
  //   Rank 4-7:   needMin 1.4 (elite prospect, won't slip far on need alone)
  //   Rank 8-12:  needMin 1.1 (strong first-rounder, need has some pull)
  //   Rank 13+:   needMin 0.6 (normal — need drives the pick)
  const rawNeedWeight = team.needWeights[player.position] ?? 1.0
  const valuesBPA = regime.tendencies?.valuesBPA ?? 0.5
  const valuesNeed = 1 - valuesBPA
  const blendedNeed = (rawNeedWeight * valuesNeed) + (1.0 * valuesBPA)

  let needMin
  if (player.rank <= 3)       needMin = 1.8
  else if (player.rank <= 7)  needMin = 1.4
  else if (player.rank <= 12) needMin = 1.1
  else                        needMin = WEIGHTS.NEED_MIN

  const needMultiplier = clamp(blendedNeed, needMin, WEIGHTS.NEED_MAX)

  // Step 4: Beat writer bonuses
  const bwLink = beatWriterLinks[player.id]
  const beatWriterBonus = bwLink
    ? clamp(bwLink.totalStrength, 0, WEIGHTS.BEAT_WRITER_MAX)
    : 0
  const insiderBonus = bwLink?.isInsiderLanguage ? WEIGHTS.INSIDER_BONUS : 0

  // Step 5: Regime tendency multiplier (0.7x → 1.35x)
  const rawRegimeBias = regime.positionalBias[player.position] ?? 1.0
  const regimeMin = player.rank <= 5 ? 1.0 : WEIGHTS.REGIME_MIN
  const regimeMultiplier = clamp(rawRegimeBias, regimeMin, WEIGHTS.REGIME_MAX)

  // Step 6: Pre-noise score — penalty, urgency, and regime all applied
  const preNoiseScore =
    (baseScore * needMultiplier + beatWriterBonus + insiderBonus) * regimeMultiplier * mockRangePenalty * urgencyMultiplier

  // Step 7: Gaussian noise — two components:
  //
  // a) Proportional noise: scales mildly as the draft progresses.
  //    Round 1 (pick ~1):   ±15% std dev  (unchanged from before)
  //    Round 4 (pick ~120): ±18% std dev
  //    Round 7 (pick ~250): ±22% std dev
  //
  // b) Absolute noise floor: a small fixed ±3 pts Gaussian regardless of score.
  //    In rounds 1-2 this is negligible. In rounds 5-7 where scores cluster
  //    between 10-30 pts, it gives just enough push to occasionally swap
  //    adjacent players without blowing up the board.
  const pickFraction = currentPickOverall > 0 ? currentPickOverall / 257 : 0
  const scaledStdDev = WEIGHTS.NOISE_STD_DEV + pickFraction * 0.07
  const proportionalNoise = gaussianNoise(preNoiseScore, scaledStdDev)
  const absoluteNoise     = gaussianNoise(WEIGHTS.NOISE_ABSOLUTE_STD, 1.0)
  const finalScore = Math.max(0, preNoiseScore + proportionalNoise + absoluteNoise)

  return {
    baseScore,
    needMultiplier,
    beatWriterBonus,
    insiderBonus,
    regimeMultiplier,
    mockRangePenalty,
    preNoiseScore,
    noise: proportionalNoise + absoluteNoise,
    finalScore,
  }
}

/**
 * Build the beat writer index for a team — flattens all writer links
 * into a map keyed by playerId for O(1) lookup during scoring.
 */
export function buildBeatWriterIndex(beatWriterData, teamId) {
  const index = {}

  if (!beatWriterData) return index

  const teamWriters = Object.values(beatWriterData).filter(
    (bw) => bw.teamId === teamId
  )

  for (const bw of teamWriters) {
    if (!bw.playerLinks) continue
    for (const link of bw.playerLinks) {
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
          writer: bw.writer,
          outlet: bw.outlet,
          quote: link.quote,
          isInsider: link.isInsiderLanguage,
        })
      }
    }
  }

  return index
}

function gaussianNoise(value, stdDevFraction) {
  const u1 = Math.max(Math.random(), 1e-10)
  const u2 = Math.random()
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
  return z * (value * stdDevFraction)
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}
