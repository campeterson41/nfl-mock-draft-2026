// Default algorithm weight constants
// These calibrate how much each signal type influences pick selection

export const WEIGHTS = {
  // Noise: gaussian std dev as fraction of pre-noise score
  // 0.15 = ±15% base, scales to ~±22% by round 7
  NOISE_STD_DEV: 0.15,
  // Absolute noise floor added to every score regardless of magnitude.
  // ±3 pts — negligible in rounds 1-2, meaningful when scores cluster at 10-30.
  NOISE_ABSOLUTE_STD: 3,

  // Beat writer signal: max bonus from accumulated beat writer + analyst links.
  // Raised to 100 so strong multi-source signals (e.g. 3 writers + Fowler insider)
  // meaningfully outweigh single-writer signals and drive real pick differentiation.
  BEAT_WRITER_MAX: 100,

  // Insider language bonus: extra points when writer used insider phrasing
  // ("I'm hearing...", "sources tell me...", confirmed visit by Rapoport, etc.)
  INSIDER_BONUS: 35,

  // National analyst strength range (30-60 pts)
  NATIONAL_ANALYST_BASE: 40,
  NATIONAL_ANALYST_INSIDER: 35, // extra insider bonus for Jeremiah/Brugler tier

  // Need multiplier range
  NEED_MIN: 0.6,  // position team doesn't need at all
  NEED_MAX: 2.5,  // top priority need (lowered so need doesn't dwarf all other signals)

  // Regime bias multiplier range — tightened so regime is a flavor, not a veto
  REGIME_MIN: 0.7,
  REGIME_MAX: 1.35,

  // AI trade acceptance threshold (fraction of pick value)
  TRADE_ACCEPTANCE_THRESHOLD: 0.85,

  // AI pick delay in ms (dramatic mode vs fast sim)
  AI_PICK_DELAY_DRAMATIC: 4000,
  AI_PICK_DELAY_FAST: 600,
}
