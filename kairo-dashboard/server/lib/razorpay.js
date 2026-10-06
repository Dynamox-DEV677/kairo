import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Razorpay signs the exact bytes of a webhook body (HMAC-SHA256, hex). So the
 * check has to run on those bytes, not on JSON.stringify(req.body): that is a
 * re-serialisation, and any difference in spacing or in how characters were
 * escaped makes a genuine payment fail the check -- the school pays and never
 * activates. app.js gives the webhook route its raw bytes (express.raw).
 *
 * The comparison is constant-time, so how long it takes says nothing about how
 * much of a guessed signature was right. A signature that is not exactly 64 hex
 * characters is refused before comparing (timingSafeEqual needs equal lengths).
 */
export function verifyRazorpaySignature(rawBody, signature, secret) {
  if (!Buffer.isBuffer(rawBody) || !secret || typeof signature !== 'string') return false
  if (!/^[0-9a-f]{64}$/i.test(signature)) return false
  const expected = createHmac('sha256', secret).update(rawBody).digest()
  return timingSafeEqual(expected, Buffer.from(signature, 'hex'))
}
