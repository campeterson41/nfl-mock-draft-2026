// GET /api/admin/groups → admin-only; returns summary list of all groups.
// Summaries omit full submission picks/trades so the admin UI stays light.

import { listGroupSummaries } from '../_lib/storage.js'
import { cors, requireAdmin } from '../_lib/util.js'

export default async function handler(req, res) {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!requireAdmin(req, res)) return

  try {
    const groups = await listGroupSummaries()
    return res.status(200).json({ groups })
  } catch (err) {
    console.error('GET /api/admin/groups failed:', err)
    return res.status(500).json({ error: err.message ?? 'Server error' })
  }
}
