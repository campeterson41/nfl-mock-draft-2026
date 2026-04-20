// GET    /api/groups/:id → public; fetch a group's full document
// DELETE /api/groups/:id → admin-only; hard-delete the group (gone forever)

import { getGroup, deleteGroup } from '../../_lib/storage.js'
import { cors, requireAdmin } from '../../_lib/util.js'

export default async function handler(req, res) {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(204).end()

  try {
    const { id } = req.query
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Missing id' })
    }

    if (req.method === 'GET') {
      const group = await getGroup(id)
      if (!group) return res.status(404).json({ error: 'Group not found' })
      return res.status(200).json(group)
    }

    if (req.method === 'DELETE') {
      if (!requireAdmin(req, res)) return
      const existing = await getGroup(id)
      if (!existing) return res.status(404).json({ error: 'Group not found' })
      await deleteGroup(id)
      return res.status(200).json({ ok: true, id })
    }

    res.setHeader('Allow', 'GET, DELETE, OPTIONS')
    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err) {
    console.error('/api/groups/:id failed:', err)
    return res.status(500).json({ error: err.message ?? 'Server error' })
  }
}
