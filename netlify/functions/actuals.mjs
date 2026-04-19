// Netlify Function: /api/actuals
//
// Stores the "actual" draft results that every group's leaderboard is
// scored against. One global document keyed "actuals" in the shared
// Netlify Blobs store.
//
// Routes:
//   GET  /api/actuals   → public; returns current actuals doc
//   POST /api/actuals   → admin-only; requires header X-Admin-Secret
//                         matching the ADMIN_SECRET env var on Netlify.
//                         Body is a full replacement: { picks, trades }.

import { getStore } from '@netlify/blobs'

const STORE_NAME = 'groups'
const BLOB_KEY = 'actuals'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Secret',
  'Content-Type': 'application/json',
}

function json(status, body) {
  return new Response(JSON.stringify(body), { status, headers: CORS_HEADERS })
}

function emptyActuals() {
  return { lastUpdated: null, picks: {}, trades: [] }
}

// Validate + normalize actuals payload (picks: { overall: { playerId, teamId } })
function sanitizeActuals(body) {
  const picks = {}
  if (body?.picks && typeof body.picks === 'object') {
    for (const [k, v] of Object.entries(body.picks)) {
      const overall = parseInt(k, 10)
      if (overall > 0 && overall <= 257 && v && typeof v === 'object') {
        const playerId = typeof v.playerId === 'string' ? v.playerId.trim().slice(0, 80) : ''
        const teamId   = typeof v.teamId   === 'string' ? v.teamId.trim().slice(0, 4).toUpperCase() : ''
        if (playerId && teamId) {
          picks[String(overall)] = { playerId, teamId }
        }
      }
    }
  }

  const trades = Array.isArray(body?.trades)
    ? body.trades.slice(0, 40).map((t) => ({
        teamAId: typeof t.teamAId === 'string' ? t.teamAId.trim().slice(0, 4).toUpperCase() : '',
        teamBId: typeof t.teamBId === 'string' ? t.teamBId.trim().slice(0, 4).toUpperCase() : '',
        aSent: {
          pickOveralls: Array.isArray(t?.aSent?.pickOveralls)
            ? t.aSent.pickOveralls.filter(n => Number.isInteger(n) && n > 0 && n <= 257) : [],
          futurePickIds: Array.isArray(t?.aSent?.futurePickIds)
            ? t.aSent.futurePickIds.map(String).slice(0, 10) : [],
        },
        bSent: {
          pickOveralls: Array.isArray(t?.bSent?.pickOveralls)
            ? t.bSent.pickOveralls.filter(n => Number.isInteger(n) && n > 0 && n <= 257) : [],
          futurePickIds: Array.isArray(t?.bSent?.futurePickIds)
            ? t.bSent.futurePickIds.map(String).slice(0, 10) : [],
        },
      })).filter(t => t.teamAId && t.teamBId)
    : []

  return {
    lastUpdated: new Date().toISOString(),
    picks,
    trades,
  }
}

export default async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }

  const store = getStore(STORE_NAME)

  try {
    if (request.method === 'GET') {
      const doc = await store.get(BLOB_KEY, { type: 'json' })
      return json(200, doc || emptyActuals())
    }

    if (request.method === 'POST') {
      // Admin auth: shared secret in env var, sent via X-Admin-Secret header.
      // If ADMIN_SECRET is unset, reject all writes (safer default).
      const expected = process.env.ADMIN_SECRET
      const provided = request.headers.get('x-admin-secret') || ''
      if (!expected || provided !== expected) {
        return json(401, { error: 'Unauthorized' })
      }

      const body = await request.json().catch(() => ({}))
      const clean = sanitizeActuals(body)
      await store.setJSON(BLOB_KEY, clean)
      return json(200, clean)
    }

    return json(405, { error: 'Method not allowed' })
  } catch (err) {
    console.error('[actuals function error]', err)
    return json(500, { error: 'Server error', detail: String(err?.message ?? err) })
  }
}
