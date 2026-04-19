#!/usr/bin/env node
// Simulate a full 7-round mock draft using the existing AI engine, inject a
// handful of plausible KC trades, and POST the result to /api/actuals.
//
// Usage: node scripts/seed-actuals.mjs [--api=http://localhost:9999/api/actuals] [--secret=testpass123]

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { selectAIPick } from '../src/engine/draftEngine.js'
import { WEIGHTS } from '../src/constants/weights.js'

// Disable the gaussian noise in the scoring algorithm so the sim produces
// the canonical "highest-scored player for each team" mock based on beat
// writer + analyst signals. Real sims use noise for variance per re-sim,
// but for a seeded actual-draft mock we want the most likely outcome.
WEIGHTS.NOISE_STD_DEV = 0
WEIGHTS.NOISE_ABSOLUTE_STD = 0

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, '..', 'src', 'data')

function loadJson(name) {
  return JSON.parse(readFileSync(join(DATA_DIR, name), 'utf8'))
}

const playersData = loadJson('players.json')
const teamsData = loadJson('teams.json')
const regimesData = loadJson('regimes.json')
const picksData = loadJson('picks.json')
const beatwritersData = loadJson('beatwriters.json')
const nationalAnalystsData = loadJson('nationalAnalysts.json')

// Parse CLI args
const args = Object.fromEntries(
  process.argv.slice(2).map(a => {
    const [k, v] = a.replace(/^--/, '').split('=')
    return [k, v ?? true]
  })
)
const API = args.api ?? 'http://localhost:5180/api/actuals'
const SECRET = args.secret ?? process.env.ADMIN_SECRET
if (!SECRET) {
  console.error('Missing admin secret. Set ADMIN_SECRET env var or pass --secret=...')
  process.exit(1)
}

// ── Pre-scripted trades ───────────────────────────────────────────────
// Roughly models real NFL draft volume: ~30 trades across 7 rounds with a
// mix of trade-ups (give one earlier pick, send back two later picks),
// trade-backs (the reverse), and swaps. We include a couple of KC trades
// so our test group has something to score against.
//
// These happen BEFORE the sim runs, mutating pick ownership so the AI
// engine naturally routes each pick to its new owner.
const TRADES = [
  // ── Round 1 (big-ticket QB / trade-up chaos) ──
  // NOTE: LV keeps #1 and takes Mendoza — most realistic outcome.
  // KC ↔ BAL: KC trades up in R2 (gave 40 + 74, got 35) — KC-specific for our test group
  { teamAId: 'KC',  teamBId: 'BAL',
    aSent: { pickOveralls: [40, 74], futurePickIds: [] },
    bSent: { pickOveralls: [35], futurePickIds: [] } },
  // KC ↔ ATL: KC trades back from #29 (gave 29, got 44 + 78) — KC-specific
  { teamAId: 'KC',  teamBId: 'ATL',
    aSent: { pickOveralls: [29], futurePickIds: [] },
    bSent: { pickOveralls: [44, 78], futurePickIds: [] } },
  // DET ↔ NYG: DET trades up (gave 17 + 85, got 5)
  { teamAId: 'DET', teamBId: 'NYG',
    aSent: { pickOveralls: [17, 85], futurePickIds: [] },
    bSent: { pickOveralls: [5], futurePickIds: [] } },
  // PHI ↔ TB: PHI gets into R1 (gave 23 + 63, got 15)
  { teamAId: 'PHI', teamBId: 'TB',
    aSent: { pickOveralls: [23, 63], futurePickIds: [] },
    bSent: { pickOveralls: [15], futurePickIds: [] } },
  // PIT ↔ CHI: trade-back (PIT gave 19, got 25 + 91)
  { teamAId: 'PIT', teamBId: 'CHI',
    aSent: { pickOveralls: [19], futurePickIds: [] },
    bSent: { pickOveralls: [25, 91], futurePickIds: [] } },
  // HOU ↔ MIN: HOU trades up (gave 27 + 62, got 18)
  { teamAId: 'HOU', teamBId: 'MIN',
    aSent: { pickOveralls: [27, 62], futurePickIds: [] },
    bSent: { pickOveralls: [18], futurePickIds: [] } },
  // SF ↔ LAR: SF moves back (gave 27... wait HOU already has that — use 22)
  // Actually SF pick is 27; reassign. Try SF ↔ LAR: SF gave 22, got 13 + 64? No LAR is at 13.
  // Different angle: LAR ↔ LAC (LAR gave 13, got 22+?)
  { teamAId: 'LAR', teamBId: 'LAC',
    aSent: { pickOveralls: [13], futurePickIds: [] },
    bSent: { pickOveralls: [22, 86], futurePickIds: [] } },
  // NO ↔ CAR: NO trades up from 8 to ??? Actually NO has pick 8, let's have CAR (at 19 — now owned by CHI post R1 trade above) — skip that.
  // BUF ↔ NO: BUF gives pick 26, gets... hmm BUF is at 26. Let's do:
  // MIA ↔ SF: MIA swaps 11 for 30 + 94 (trade-back)
  { teamAId: 'MIA', teamBId: 'SF',
    aSent: { pickOveralls: [11], futurePickIds: [] },
    bSent: { pickOveralls: [30, 94], futurePickIds: [] } },

  // ── Round 2 ──
  // NYJ ↔ IND (via trade): NYJ sends 36 + 105 for 33 — wait NYJ had pick 36 (from IND). Actually don't overthink.
  // NE ↔ GB: NE trades up in R2 (gave 40... no that's KC from R1 trade).
  // Let's do some Day 2 trades with cleaner picks:
  // SEA ↔ WAS: SEA gives 55, gets 39 + 112 (trade-up)
  { teamAId: 'SEA', teamBId: 'WAS',
    aSent: { pickOveralls: [55], futurePickIds: [] },
    bSent: { pickOveralls: [39], futurePickIds: [] } },
  // NO ↔ CIN: NO gives 40 wait that's taken. Try 45: NO trades 45 to CIN for 53+121
  { teamAId: 'NO',  teamBId: 'CIN',
    aSent: { pickOveralls: [45], futurePickIds: [] },
    bSent: { pickOveralls: [53, 121], futurePickIds: [] } },
  // BUF ↔ DAL: BUF trades 57 for 46+140 — BUF trades back (gave later for earlier? flipped)
  // Clean: DAL gives 46, gets 57+140 (DAL trades back)
  { teamAId: 'DAL', teamBId: 'BUF',
    aSent: { pickOveralls: [46], futurePickIds: [] },
    bSent: { pickOveralls: [57, 140], futurePickIds: [] } },

  // ── Round 3 ──
  // JAX ↔ DEN: JAX gives 70, gets 81 + 155 (trade-back)
  { teamAId: 'JAX', teamBId: 'DEN',
    aSent: { pickOveralls: [70], futurePickIds: [] },
    bSent: { pickOveralls: [81, 155], futurePickIds: [] } },
  // TEN ↔ GB: TEN sends 72 for 89 + 160 (trade-back — TEN can afford it, picked up extras from LV deal)
  { teamAId: 'TEN', teamBId: 'GB',
    aSent: { pickOveralls: [72], futurePickIds: [] },
    bSent: { pickOveralls: [89, 160], futurePickIds: [] } },
  // NE ↔ SEA: NE sends 75 for 88 + 168 (trade-back)
  { teamAId: 'NE',  teamBId: 'SEA',
    aSent: { pickOveralls: [75], futurePickIds: [] },
    bSent: { pickOveralls: [88, 168], futurePickIds: [] } },
  // HOU ↔ CAR: HOU gives 93 for 100 + 175
  { teamAId: 'HOU', teamBId: 'CAR',
    aSent: { pickOveralls: [93], futurePickIds: [] },
    bSent: { pickOveralls: [100, 175], futurePickIds: [] } },
  // IND ↔ PHI: IND gives 83 for 92 + 165 (small trade-back)
  { teamAId: 'IND', teamBId: 'PHI',
    aSent: { pickOveralls: [83], futurePickIds: [] },
    bSent: { pickOveralls: [92, 165], futurePickIds: [] } },

  // ── Round 4 ──
  // ARI ↔ LAR: ARI gives 108 for 120 + 190
  { teamAId: 'ARI', teamBId: 'LAR',
    aSent: { pickOveralls: [108], futurePickIds: [] },
    bSent: { pickOveralls: [120, 190], futurePickIds: [] } },
  // SF ↔ NYJ: SF trades 126 for 115 + 230 (trade-up)
  { teamAId: 'SF',  teamBId: 'NYJ',
    aSent: { pickOveralls: [126, 230], futurePickIds: [] },
    bSent: { pickOveralls: [115], futurePickIds: [] } },
  // DET ↔ MIA: DET gives 130 for 137 + 220
  { teamAId: 'DET', teamBId: 'MIA',
    aSent: { pickOveralls: [130], futurePickIds: [] },
    bSent: { pickOveralls: [137, 220], futurePickIds: [] } },
  // CLE ↔ TB: CLE gives 134 for 141 + 214
  { teamAId: 'CLE', teamBId: 'TB',
    aSent: { pickOveralls: [134], futurePickIds: [] },
    bSent: { pickOveralls: [141, 214], futurePickIds: [] } },

  // ── Round 5 ──
  // CHI ↔ BAL: CHI gives 144 for 153 + 215
  { teamAId: 'CHI', teamBId: 'BAL',
    aSent: { pickOveralls: [144], futurePickIds: [] },
    bSent: { pickOveralls: [153, 215], futurePickIds: [] } },
  // PIT ↔ LAC: PIT gives 148 for 157 + 228 (NOTE: KC had 148 in our R1 KC-ATL trade? no, 148 untouched)
  { teamAId: 'PIT', teamBId: 'LAC',
    aSent: { pickOveralls: [148], futurePickIds: [] },
    bSent: { pickOveralls: [157, 228], futurePickIds: [] } },
  // WAS ↔ NYG: WAS gives 159 for 170 + 240
  { teamAId: 'WAS', teamBId: 'NYG',
    aSent: { pickOveralls: [159], futurePickIds: [] },
    bSent: { pickOveralls: [170, 240], futurePickIds: [] } },
  // BUF ↔ MIN: BUF gives 167 for 181 + 245
  { teamAId: 'BUF', teamBId: 'MIN',
    aSent: { pickOveralls: [167], futurePickIds: [] },
    bSent: { pickOveralls: [181, 245], futurePickIds: [] } },

  // ── Round 6 ──
  // GB ↔ NE: GB gives 185 for 195 + 248
  { teamAId: 'GB',  teamBId: 'NE',
    aSent: { pickOveralls: [185], futurePickIds: [] },
    bSent: { pickOveralls: [195, 248], futurePickIds: [] } },
  // ATL ↔ DEN: ATL gives 198 for 208 + 255
  { teamAId: 'ATL', teamBId: 'DEN',
    aSent: { pickOveralls: [198], futurePickIds: [] },
    bSent: { pickOveralls: [208, 255], futurePickIds: [] } },
  // TEN ↔ CAR: TEN gives 202 for 212 + 251
  { teamAId: 'TEN', teamBId: 'CAR',
    aSent: { pickOveralls: [202], futurePickIds: [] },
    bSent: { pickOveralls: [212, 251], futurePickIds: [] } },

  // ── Round 7 ──
  // CIN ↔ JAX: simple swap — CIN gives 225 for 238 (late-round pure swap)
  { teamAId: 'CIN', teamBId: 'JAX',
    aSent: { pickOveralls: [225], futurePickIds: [] },
    bSent: { pickOveralls: [238], futurePickIds: [] } },
  // DAL ↔ SF: DAL gives 232 for 249 (small trade-back)
  { teamAId: 'DAL', teamBId: 'SF',
    aSent: { pickOveralls: [232], futurePickIds: [] },
    bSent: { pickOveralls: [249], futurePickIds: [] } },
]

function applyTradesToPicks(originalPicks, trades) {
  const picks = originalPicks.map(p => ({ ...p }))
  const idxByOverall = {}
  picks.forEach((p, i) => { idxByOverall[p.overall] = i })

  for (const t of trades) {
    for (const overall of (t.aSent.pickOveralls ?? [])) {
      const idx = idxByOverall[overall]
      if (idx != null) picks[idx].teamId = t.teamBId
    }
    for (const overall of (t.bSent.pickOveralls ?? [])) {
      const idx = idxByOverall[overall]
      if (idx != null) picks[idx].teamId = t.teamAId
    }
  }
  return picks
}

// ── Run the sim ───────────────────────────────────────────────────────
function runSim() {
  const picks = applyTradesToPicks(picksData.picks, TRADES)
  const teams = JSON.parse(JSON.stringify(teamsData))
  let available = [...playersData].sort((a, b) => a.rank - b.rank)

  const actualsPicks = {}

  for (const pick of picks) {
    const team = teams[pick.teamId]
    if (!team) continue
    const regime = regimesData[team.regimeId]

    const result = selectAIPick({
      teamId: pick.teamId,
      team,
      regime,
      availablePlayers: available,
      beatWriterData: beatwritersData,
      nationalAnalystData: nationalAnalystsData,
      currentPickOverall: pick.overall,
    })

    if (!result?.player) {
      // Fallback: highest-ranked available
      const p = available[0]
      if (!p) break
      actualsPicks[String(pick.overall)] = { playerId: p.id, teamId: pick.teamId }
      available = available.filter(x => x.id !== p.id)
      continue
    }

    actualsPicks[String(pick.overall)] = {
      playerId: result.player.id,
      teamId: pick.teamId,
    }
    available = available.filter(x => x.id !== result.player.id)

    // Reduce team's need weight for the position picked (lightweight — mirrors
    // the live reducer). Helps subsequent picks for that team go elsewhere.
    if (teams[pick.teamId]?.needWeights?.[result.player.position] != null) {
      const round = pick.round
      const reduction = round <= 2 ? 1.5 : round <= 4 ? 1.0 : 0.5
      teams[pick.teamId].needWeights[result.player.position] = Math.max(
        0.5,
        teams[pick.teamId].needWeights[result.player.position] - reduction
      )
    }
  }

  return { picks: actualsPicks, trades: TRADES }
}

// ── POST to the API ───────────────────────────────────────────────────
async function postActuals(payload) {
  const res = await fetch(API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Secret': SECRET,
    },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`HTTP ${res.status}: ${text}`)
  }
  return res.json()
}

// ── Main ──────────────────────────────────────────────────────────────
const sim = runSim()
console.log(`Simulated ${Object.keys(sim.picks).length} picks + ${sim.trades.length} trades`)
// Show a few sample picks
for (const overall of [1, 5, 9, 10, 20, 29, 32, 35, 44, 50, 78, 100, 150, 200, 257]) {
  const p = sim.picks[String(overall)]
  if (p) console.log(`  #${String(overall).padStart(3)}  ${p.teamId}  →  ${p.playerId}`)
}
console.log(`\nPOSTing to ${API} …`)
try {
  const response = await postActuals(sim)
  console.log(`✓ Saved. Last updated: ${response.lastUpdated}`)
  console.log(`  ${Object.keys(response.picks).length} picks, ${response.trades.length} trades in store.`)
} catch (err) {
  console.error('✗ Failed to post actuals:', err.message)
  process.exit(1)
}
