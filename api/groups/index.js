// POST /api/groups → create a new group
import { getGroup, setGroup } from '../_lib/storage.js'
import { generateGroupId, sanitizeString, cors } from '../_lib/util.js'

export default async function handler(req, res) {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const body = req.body ?? {}
    const name             = sanitizeString(body.name, 80)
    const teamId           = sanitizeString(body.teamId, 4).toUpperCase()
    const commissionerName = sanitizeString(body.commissionerName, 40)

    if (!name || !teamId || !commissionerName) {
      return res.status(400).json({ error: 'name, teamId, and commissionerName are required' })
    }

    // Retry up to 5 times on ID collision (very unlikely).
    let id
    for (let i = 0; i < 5; i++) {
      id = generateGroupId()
      const existing = await getGroup(id)
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
    await setGroup(id, group)
    return res.status(201).json({ id })
  } catch (err) {
    console.error('POST /api/groups failed:', err)
    return res.status(500).json({ error: err.message ?? 'Server error' })
  }
}
