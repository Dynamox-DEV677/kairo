import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'kairo-dev-secret-change-in-production'

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null

  if (!token) return res.status(401).json({ error: 'No token provided.' })

  try {
    req.user = jwt.verify(token, JWT_SECRET)
    next()
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token.' })
  }
}

/**
 * Decode the token when one is present, but never reject.
 * For endpoints that work signed-out yet must trust the token's identity over
 * anything the client claims in the body when a user IS signed in.
 */
export function optionalAuth(req, _res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (token) {
    try { req.user = jwt.verify(token, JWT_SECRET) } catch { /* treat as anonymous */ }
  }
  next()
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role)) {
      return res.status(403).json({ error: `Access denied. Required role: ${roles.join(' or ')}.` })
    }
    next()
  }
}

export function signToken(payload, expiresIn = '7d') {
  return jwt.sign(payload, JWT_SECRET, { expiresIn })
}
