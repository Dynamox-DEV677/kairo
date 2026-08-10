import { createHash, timingSafeEqual } from 'node:crypto'

/**
 * Gate for the operational endpoints (/api/ops/status, /api/ops/diagnose).
 *
 * Answers 404, never 401, and the body is byte-identical to the app's
 * catch-all 404. A 401 confirms the route exists, which is the fact we are
 * trying not to publish — someone who knows /api/ops/status is deployed knows
 * this is a Kyno box and can start guessing tokens against it. A 404 is
 * indistinguishable from a route that was never shipped.
 *
 * Fails closed. With OPS_TOKEN unset the endpoints are unreachable rather
 * than open, so a forgotten env var can never silently republish the payload.
 * The 32-char floor exists because a short token is barely better than none
 * against an attacker who can send unlimited requests.
 */
export function requireOpsToken(req, res, next) {
  const expected = process.env.OPS_TOKEN || ''
  if (expected.length < 32) return notFound(res)

  const header = req.headers.authorization || ''
  const supplied = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  if (!supplied) return notFound(res)

  if (!safeEqual(supplied, expected)) return notFound(res)

  next()
}

/**
 * Compare via SHA-256 digests rather than the raw strings: timingSafeEqual
 * throws on a length mismatch, and branching on length would itself leak the
 * token's length. Hashing makes both sides a fixed 32 bytes.
 */
function safeEqual(a, b) {
  const ha = createHash('sha256').update(a, 'utf8').digest()
  const hb = createHash('sha256').update(b, 'utf8').digest()
  return timingSafeEqual(ha, hb)
}

// Must stay identical to the catch-all 404 in server/app.js.
function notFound(res) {
  return res.status(404).json({ error: 'Route not found.' })
}
