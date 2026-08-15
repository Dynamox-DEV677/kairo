import jwt from 'jsonwebtoken'
import { randomBytes } from 'node:crypto'

/**
 * JWT_SECRET has no fallback in production, and that is the whole point.
 *
 * It used to default to the literal string
 * 'kairo-dev-secret-change-in-production'. That string is in the repo, so if
 * the env var was ever unset on a deploy, anyone who read the source could
 * mint a valid token for any user id and role — including admin. Nothing would
 * look wrong; the forged token verifies cleanly.
 *
 * Fail closed rather than fail quiet. In production a missing secret disables
 * this verifier entirely (401 on every legacy-token route) instead of
 * accepting a guessable one. Supabase auth is unaffected, so the app keeps
 * working — only the legacy self-signed path stops.
 *
 * In development a random per-process secret is generated: it works, tokens
 * do not survive a restart, and it can never be the same value as anyone
 * else's.
 */
const IS_PROD = process.env.NODE_ENV === 'production'
const JWT_SECRET = process.env.JWT_SECRET
  || (IS_PROD ? null : randomBytes(32).toString('hex'))

if (!JWT_SECRET) {
  console.error(
    '[auth] JWT_SECRET is not set. Legacy token auth is DISABLED — every route ' +
    'using requireAuth will return 401. Set JWT_SECRET in the environment.',
  )
} else if (!process.env.JWT_SECRET) {
  console.warn('[auth] JWT_SECRET not set — using a random dev secret. Tokens reset on restart.')
}

/** Shared refusal, so a missing secret can never fall through to a verify. */
function secretMissing(res) {
  return res.status(401).json({
    error: { code: 'AUTH_UNAVAILABLE', message: 'Authentication is not configured on this server.' },
  })
}

export function requireAuth(req, res, next) {
  if (!JWT_SECRET) return secretMissing(res)
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
  if (!JWT_SECRET) return next()   // anonymous, never a guessed identity
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
  // Refuse to MINT a token we could not verify safely, rather than issuing
  // one signed with a secret the whole internet can read.
  if (!JWT_SECRET) throw new Error('JWT_SECRET is not configured — refusing to issue a token.')
  return jwt.sign(payload, JWT_SECRET, { expiresIn })
}
