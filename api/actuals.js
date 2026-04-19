// GET  /api/actuals → public; returns the current actuals doc
// POST /api/actuals → admin-only; requires X-Admin-Secret header matching
//                     the ADMIN_SECRET env var set in Vercel.

import { getActuals, setActuals } from './_lib/storage.js'
import { cors } from './_lib/util.js'

export default async function handler(req, res) {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(204).end()

  try {
    if (req.method === 'GET') {
      const actuals = await getActuals()
      return res.status(200).json(actuals)
    }

    if (req.method === 'POST') {
      const expected = process.env.ADMIN_SECRET
      if (!expected) {
        return res.status(500).json({
          error: 'ADMIN_SECRET is not configured on the server. Set it in Vercel env vars.',
        })
      }
      const provided = req.headers['x-admin-secret']
      if (provided !== expected) {
        return res.status(401).json({ error: 'Unauthorized' })
      }

      const body = req.body ?? {}
      const actuals = {
        lastUpdated: new Date().toISOString(),
        picks:  body.picks  ?? {},
        trades: Array.isArray(body.trades) ? body.trades : [],
      }
      await setActuals(actuals)
      return res.status(200).json(actuals)
    }

    res.setHeader('Allow', 'GET, POST, OPTIONS')
    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err) {
    console.error('/api/actuals failed:', err)
    return res.status(500).json({ error: err.message ?? 'Server error' })
  }
}
