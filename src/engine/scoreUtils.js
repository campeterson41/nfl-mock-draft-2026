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
  const rawBaseScore = 100 * Math.exp(-0.016 * (player.rank - 1))

  // Step 1a: Positional value discount — league-wide draft gravity.
  // S, TE, RB get slight penalties; QB, EDGE, OT get slight boosts.
  // Randomized per player per sim so it's not deterministic.
  const posCenter = WEIGHTS.POSITIONAL_VALUE[player.position] ?? 1.0
  const posNoise = gaussianNoise(1.0, WEIGHTS.POSITIONAL_VALUE_NOISE)
  const positionalMult = Math.max(0.85, Math.min(1.15, posCenter + posNoise))
  const baseScore = rawBaseScore * positionalMult

  // Step 1b: Injury risk discount — players with known medical concerns
  // get a randomized penalty. injuryRisk 0.3 → between ~0.85x and 1.0x.
  // The randomness means some sims a team "is comfortable with the medical"
  // and some sims they pass — matching real draft behavior.
  let injuryMult = 1.0
  if (player.injuryRisk > 0) {
    const riskRoll = 0.5 + Math.random() * 0.5  // 0.5 to 1.0
    injuryMult = 1.0 - (player.injuryRisk * riskRoll)
  }

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
    // Calibrated against 2020-2024 data: 83.6% R1 consensus accuracy means
    // ~5 of 32 first-rounders deviate meaningfully. Softened R1 decay from
    // 0.95 to 0.96 to allow realistic reaches (Herbert -6, Penix -17, etc.)
    // while still penalizing extreme reaches.
    //
    // Round 1 (0.96^x):  5 early → 0.82x, 10 early → 0.66x
    // Round 2+ (0.975^x): 5 early → 0.88x, 10 early → 0.78x (soft)
    const consensus = player.mockRange?.consensus ?? player.rank
    if (currentPickOverall < consensus) {
      const picksBeforeConsensus = consensus - currentPickOverall
      const isRound1 = currentPickOverall <= 32
      const decay = isRound1 ? 0.96 : 0.975
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

  // Step 5b: Athletic freak bonus — players with elite combine measurables
  // get a small multiplier. Teams take fliers on freaky athletes, especially
  // in later rounds. This is a gentle nudge, not a game-changer:
  //   freakScore 0.5 (2 elite traits) → 1.03x
  //   freakScore 0.75 (3 elite traits) → 1.045x
  //   freakScore 1.0 (4+ elite traits) → 1.06x
  const freakMultiplier = 1.0 + (player.freakScore ?? 0) * 0.06

  // Step 6: Pre-noise score — penalty, urgency, regime, and injury all applied
  const preNoiseScore =
    (baseScore * needMultiplier + beatWriterBonus + insiderBonus) * regimeMultiplier * mockRangePenalty * urgencyMultiplier * freakMultiplier * injuryMult

  // Step 7: Gaussian noise — two components, amplified by polarization.
  //
  // a) Proportional noise: scales mildly as the draft progresses.
  //    Round 1 (pick ~1):   ±15% std dev
  //    Round 4 (pick ~120): ±18% std dev
  //    Round 7 (pick ~250): ±22% std dev
  //
  // b) Absolute noise floor: a small fixed ±3 pts Gaussian regardless of score.
  //
  // c) Polarization amplifier: players with high disagreement among drafters
  //    get wider noise bands. A polarization of 1.0 (Oscar Delp) doubles the
  //    noise, so he swings wildly between sims. A polarization of 0 = normal.
  //    This means the same player might go in round 2 one sim and round 5 the next.
  const polarizationAmp = 1.0 + (player.polarization ?? 0) * 1.0
  const pickFraction = currentPickOverall > 0 ? currentPickOverall / 257 : 0
  const scaledStdDev = WEIGHTS.NOISE_STD_DEV + pickFraction * 0.07
  const proportionalNoise = gaussianNoise(preNoiseScore, scaledStdDev) * polarizationAmp
  const absoluteNoise     = gaussianNoise(WEIGHTS.NOISE_ABSOLUTE_STD, 1.0) * polarizationAmp
  const finalScore = Math.max(0, preNoiseScore + proportionalNoise + absoluteNoise)

  return {
    baseScore,
    positionalMult,
    injuryMult,
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
