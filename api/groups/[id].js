// GET /api/groups/:id → fetch a group's full document
import { getGroup } from '../_lib/storage.js'
import { cors } from '../_lib/util.js'

export default async function handler(req, res) {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { id } = req.query
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Missing id' })
    }
    const group = await getGroup(id)
    if (!group) return res.status(404).json({ error: 'Group not found' })
    return res.status(200).json(group)
  } catch (err) {
    console.error('GET /api/groups/:id failed:', err)
    return res.status(500).json({ error: err.message ?? 'Server error' })
  }
}
