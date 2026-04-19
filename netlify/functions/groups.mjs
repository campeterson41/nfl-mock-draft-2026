// Netlify Function handling all /api/groups* routes.
// Stores each group as a JSON blob in the Netlify Blobs "groups" store.
//
// Routes:
//   POST /api/groups                    → create group
//   GET  /api/groups/:id                → fetch group + submissions
//   POST /api/groups/:id/submissions    → add/replace a submission (keyed by member name)

import { getStore } from '@netlify/blobs'

const STORE_NAME = 'groups'
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
}

function json(status, body) {
  return new Response(JSON.stringify(body), { status, headers: CORS_HEADERS })
}

// 6-char URL-friendly ID. Enough entropy for MVP (36^6 ≈ 2B combinations).
function generateGroupId() {
  const alphabet = '23456789abcdefghjkmnpqrstuvwxyz'  // no 0/o/1/l — easier to read aloud
  let out = ''
  for (let i = 0; i < 6; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)]
  }
  return out
}

function sanitizeString(s, maxLen = 60) {
  if (typeof s !== 'string') return ''
  return s.trim().slice(0, maxLen)
}

// Bind this function directly to the /api/groups* paths. More reliable than
// relying on netlify.toml redirects (which can 405 POSTs in some configs).
export const config = {
  path: ['/api/groups', '/api/groups/*'],
}

export default async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }

  const url = new URL(request.url)
  // Strip prefix: /api/groups or /.netlify/functions/groups — keep trailing segments
  let path = url.pathname
    .replace(/^\/\.netlify\/functions\/groups/, '')
    .replace(/^\/api\/groups/, '')
    .replace(/^\/+|\/+$/g, '')
  // path is now empty, '<id>', or '<id>/submissions'

  const store = getStore(STORE_NAME)

  try {
    // ── POST /api/groups ───────────────────────────────────────────────
    if (path === '' && request.method === 'POST') {
      const body = await request.json().catch(() => ({}))
      const name = sanitizeString(body.name, 80)
      const teamId = sanitizeString(body.teamId, 4).toUpperCase()
      const commissionerName = sanitizeString(body.commissionerName, 40)

      if (!name || !teamId || !commissionerName) {
        return json(400, { error: 'name, teamId, and commissionerName are required' })
      }

      // Guarantee unique ID (retry a couple times on collision, very unlikely)
      let id
      for (let i = 0; i < 5; i++) {
        id = generateGroupId()
        const existing = await store.get(`group:${id}`)
        if (!existing) break
      }

      const group = {
        id,
        name,
        teamId,
        commissionerName,
        createdAt: new Date().toISOString(),
        submissions: [],
      }

      await store.setJSON(`group:${id}`, group)
      return json(201, group)
    }

    // ── GET /api/groups/:id ────────────────────────────────────────────
    if (path.match(/^[a-z0-9]{6}$/i) && request.method === 'GET') {
      const id = path.toLowerCase()
      const group = await store.get(`group:${id}`, { type: 'json' })
      if (!group) return json(404, { error: 'Group not found' })
      return json(200, group)
    }

    // ── POST /api/groups/:id/submissions ───────────────────────────────
    const submitMatch = path.match(/^([a-z0-9]{6})\/submissions$/i)
    if (submitMatch && request.method === 'POST') {
      const id = submitMatch[1].toLowerCase()
      const group = await store.get(`group:${id}`, { type: 'json' })
      if (!group) return json(404, { error: 'Group not found' })

      // Lock: once actuals has any picks/trades entered, submissions close.
      const actuals = await store.get('actuals', { type: 'json' })
      const draftStarted = actuals && (
        Object.keys(actuals.picks ?? {}).length > 0 ||
        (actuals.trades ?? []).length > 0
      )
      if (draftStarted) {
        return json(423, { error: 'The draft has started — submissions are locked.' })
      }

      const body = await request.json().catch(() => ({}))
      const name = sanitizeString(body.name, 40)
      if (!name) return json(400, { error: 'name is required' })

      // Validate picks object — keys are pick overalls (strings), values are player IDs
      const picks = {}
      if (body.picks && typeof body.picks === 'object') {
        for (const [k, v] of Object.entries(body.picks)) {
          const overall = parseInt(k, 10)
          if (overall > 0 && overall <= 257 && typeof v === 'string') {
            picks[String(overall)] = sanitizeString(v, 80)
          }
        }
      }

      // Validate trades array
      const trades = Array.isArray(body.trades)
        ? body.trades.slice(0, 20).map((t) => ({
            partnerId: sanitizeString(t.partnerId, 4).toUpperCase() || null,
            gave: {
              pickOveralls: Array.isArray(t?.gave?.pickOveralls) ? t.gave.pickOveralls.filter(n => Number.isInteger(n) && n > 0 && n <= 257) : [],
              futurePickIds: Array.isArray(t?.gave?.futurePickIds) ? t.gave.futurePickIds.map(String).slice(0, 10) : [],
            },
            received: {
              pickOveralls: Array.isArray(t?.received?.pickOveralls) ? t.received.pickOveralls.filter(n => Number.isInteger(n) && n > 0 && n <= 257) : [],
              futurePickIds: Array.isArray(t?.received?.futurePickIds) ? t.received.futurePickIds.map(String).slice(0, 10) : [],
            },
          }))
        : []

      const submission = {
        name,
        submittedAt: new Date().toISOString(),
        picks,
        trades,
      }

      // Replace by name (case-insensitive) if exists, else append
      const nameKey = name.toLowerCase()
      const existingIdx = group.submissions.findIndex(s => (s.name || '').toLowerCase() === nameKey)
      if (existingIdx >= 0) {
        group.submissions[existingIdx] = submission
      } else {
        group.submissions.push(submission)
      }

      // Cap group size to prevent abuse
      if (group.submissions.length > 100) {
        return json(400, { error: 'Group is full (100 members max)' })
      }

      await store.setJSON(`group:${id}`, group)
      return json(200, { ok: true, group })
    }

    return json(404, { error: 'Unknown route' })
  } catch (err) {
    console.error('[groups function error]', err)
    return json(500, { error: 'Server error', detail: String(err?.message ?? err) })
  }
}
