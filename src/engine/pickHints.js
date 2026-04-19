/**
 * Predictive Mock pick-hint utility.
 *
 * For a given pick (overall number) and a player, compute a reach/steal hint
 * based on how far the player is from their consensus-projected pick.
 *
 * The "neutral band" — how far off from consensus is considered normal —
 * widens by round because later-round picks are genuinely more variable in
 * real drafts. Round 1 has ~83.6% consensus accuracy across 2020–2024; by
 * round 6–7, mocks are basically guesswork.
 *
 * Returns null when the pick is close to consensus (inside the neutral band)
 * or when the player has no consensus projection.
 */

function getNeutralBand(pickOverall) {
  if (pickOverall <= 32)  return 5    // Round 1
  if (pickOverall <= 64)  return 15   // Round 2
  if (pickOverall <= 176) return 25   // Rounds 3–5
  return 50                           // Rounds 6–7
}

export function getPickHint({ player, pickOverall }) {
  if (!player || !pickOverall) return null

  const consensus = player.mockRange?.consensus
  if (consensus == null) return null

  const delta    = pickOverall - consensus        // <0 = reach, >0 = steal
  const absDelta = Math.abs(delta)
  const band     = getNeutralBand(pickOverall)

  if (absDelta <= band) return null  // close to consensus — no hint

  const major = absDelta >= band * 2
  const isReach = delta < 0

  let level, message
  if (isReach) {
    level = major ? 'major-reach' : 'reach'
    message = major
      ? `MAJOR REACH — consensus has this player at pick ${consensus}`
      : `REACH — typically goes around pick ${consensus}`
  } else {
    level = major ? 'major-steal' : 'steal'
    message = major
      ? `MAJOR STEAL — consensus had this player at pick ${consensus}`
      : `STEAL — would likely be gone by pick ${consensus}`
  }

  return {
    level,
    message,
    delta,
    consensus,
  }
}
