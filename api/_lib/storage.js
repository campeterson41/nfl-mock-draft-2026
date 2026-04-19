// Tiny storage layer backed by Upstash Redis via its REST API.
//
// Why Upstash: Vercel's serverless functions are stateless, so we need an
// external store for groups and actuals. Upstash has a generous free tier
// (10K commands/day — plenty for this app) and a REST API that works with
// plain fetch(), so we don't need to pull in an SDK.
//
// Env vars (any one of these name patterns — Vercel's Upstash integration
// can inject them under several prefixes depending on the install path):
//   UPSTASH_REDIS_REST_URL   / UPSTASH_REDIS_REST_TOKEN   (direct Upstash)
//   KV_REST_API_URL          / KV_REST_API_TOKEN          (legacy Vercel KV)
//   REDIS_URL                / REDIS_TOKEN                (generic)

const URL =
  process.env.UPSTASH_REDIS_REST_URL ||
  process.env.KV_REST_API_URL ||
  process.env.REDIS_URL

const TOKEN =
  process.env.UPSTASH_REDIS_REST_TOKEN ||
  process.env.KV_REST_API_TOKEN ||
  process.env.REDIS_TOKEN

function assertConfigured() {
  if (!URL || !TOKEN) {
    throw new Error(
      'Redis not configured. Connect an Upstash Redis database to this project in Vercel Storage, or set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN env vars.'
    )
  }
}

async function redis(command, ...args) {
  assertConfigured()
  const res = await fetch(`${URL}/${[command, ...args.map(encodeURIComponent)].join('/')}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Upstash ${command} failed: ${res.status} ${text}`)
  }
  const body = await res.json()
  return body.result
}

// Upstash's GET/SET REST endpoints take the value in the URL, which is
// ungainly for large JSON documents. Use the POST-with-body form instead.
async function redisBodyCommand(args) {
  assertConfigured()
  const res = await fetch(URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Upstash ${args[0]} failed: ${res.status} ${text}`)
  }
  const body = await res.json()
  return body.result
}

export async function kvGet(key) {
  const raw = await redisBodyCommand(['GET', key])
  if (raw == null) return null
  try { return JSON.parse(raw) } catch { return raw }
}

export async function kvSet(key, value) {
  const str = typeof value === 'string' ? value : JSON.stringify(value)
  return await redisBodyCommand(['SET', key, str])
}

// ── Domain helpers ───────────────────────────────────────────────────

export async function getGroup(id)          { return await kvGet(`group:${id}`) }
export async function setGroup(id, group)   { return await kvSet(`group:${id}`, group) }

export async function getActuals() {
  const saved = await kvGet('actuals')
  return saved ?? { lastUpdated: null, picks: {}, trades: [] }
}
export async function setActuals(actuals) { return await kvSet('actuals', actuals) }
