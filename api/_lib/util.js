// Shared helpers for the Vercel API routes.

// 6-char URL-friendly ID. ~36^6 ≈ 2B combos — enough for this app.
// Avoids 0/o/1/l to reduce confusion when read aloud.
export function generateGroupId() {
  const alphabet = '23456789abcdefghjkmnpqrstuvwxyz'
  let out = ''
  for (let i = 0; i < 6; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)]
  }
  return out
}

export function sanitizeString(s, maxLen = 60) {
  if (typeof s !== 'string') return ''
  return s.trim().slice(0, maxLen)
}

export function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Secret')
}

export function requireAdmin(req, res) {
  const expected = process.env.ADMIN_SECRET
  if (!expected) {
    res.status(500).json({
      error: 'ADMIN_SECRET is not configured on the server. Set it in Vercel env vars.',
    })
    return false
  }
  const provided = req.headers['x-admin-secret']
  if (provided !== expected) {
    res.status(401).json({ error: 'Unauthorized' })
    return false
  }
  return true
}
