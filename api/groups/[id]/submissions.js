// POST /api/groups/:id/submissions → add or replace a submission by member name
import { getGroup, setGroup, getActuals } from '../../_lib/storage.js'
import { sanitizeString, cors } from '../../_lib/util.js'

export default async function handler(req, res) {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { id } = req.query
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Missing group id' })
    }

    const group = await getGroup(id)
    if (!group) return res.status(404).json({ error: 'Group not found' })

    // Lock once actuals exist — no submissions after the draft starts
    const actuals = await getActuals()
    const draftStarted =
      Object.keys(actuals?.picks ?? {}).length > 0 || (actuals?.trades ?? []).length > 0
    if (draftStarted) {
      return res.status(423).json({ error: 'Submissions are locked — the draft has started.' })
    }

    const body = req.body ?? {}
    const name = sanitizeString(body.name, 40)
    if (!name) return res.status(400).json({ error: 'name is required' })

    const submission = {
      name,
      submittedAt: new Date().toISOString(),
      picks:  body.picks  ?? {},
      trades: Array.isArray(body.trades) ? body.trades : [],
    }

    // Replace any prior submission from the same name, keep one per person.
    const nextSubmissions = (group.submissions ?? []).filter(s => s.name !== name)
    nextSubmissions.push(submission)
    group.submissions = nextSubmissions

    await setGroup(id, group)
    return res.status(200).json({ ok: true, submission })
  } catch (err) {
    console.error('POST /api/groups/:id/submissions failed:', err)
    return res.status(500).json({ error: err.message ?? 'Server error' })
  }
}
