// Thin fetch wrapper for the Netlify Functions group endpoints.
// In dev (via `netlify dev`) and prod alike, API calls hit `/api/groups/...`
// which the netlify.toml rewrites to the serverless function.

const BASE = '/api/groups'

async function handle(res) {
  let body = null
  try { body = await res.json() } catch { body = null }
  if (!res.ok) {
    const err = new Error(body?.error ?? `Request failed (${res.status})`)
    err.status = res.status
    err.body = body
    throw err
  }
  return body
}

export async function createGroup({ name, teamId, commissionerName }) {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, teamId, commissionerName }),
  })
  return handle(res)
}

export async function getGroup(id) {
  const res = await fetch(`${BASE}/${encodeURIComponent(id)}`)
  return handle(res)
}

export async function submitPrediction(id, { name, picks, trades }) {
  const res = await fetch(`${BASE}/${encodeURIComponent(id)}/submissions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, picks, trades }),
  })
  return handle(res)
}

const ACTUALS_URL = '/api/actuals'

export async function getActuals() {
  const res = await fetch(ACTUALS_URL)
  return handle(res)
}

// Admin-only. `secret` is the ADMIN_SECRET shared password.
export async function updateActuals(secret, { picks, trades }) {
  const res = await fetch(ACTUALS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Secret': secret,
    },
    body: JSON.stringify({ picks, trades }),
  })
  return handle(res)
}
