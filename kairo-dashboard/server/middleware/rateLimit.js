import rateLimit from 'express-rate-limit'
import { getClientIp } from './schoolAuth.js'

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again in 15 minutes.' },
})

export const credentialLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { error: 'Too many credential attempts. Try again in 1 hour.' },
})

export const emailLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: 'Email send rate limit hit. Max 5 sends per minute.' },
})

export const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip,
  validate: false,
  message: { error: 'Too many AI requests right now — wait a few seconds and try again.' },
})

/**
 * Sign-in and reset requests are counted per ACCOUNT -- the email in the
 * request -- not per IP:
 *  - This app sets no 'trust proxy', so behind Vercel's proxy req.ip is not
 *    guaranteed to be the visitor. Keying on the account doesn't depend on it.
 *  - A school computer lab shares one public IP. Thirty students signing in at
 *    once is normal; thirty guesses at one account is not.
 * A request with no email falls back to the client's IP.
 *
 * Counts live in each server instance's memory, like the limiters above, so on
 * Vercel this is a strong speed bump rather than a hard wall.
 */
export function accountKey(req) {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase().slice(0, 254) : ''
  return email ? `acct:${email}` : `ip:${getClientIp(req)}`
}

/** Password guesses: 10 failed attempts per account per 15 minutes. Successful sign-ins don't count. */
export function createLoginLimiter() {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    keyGenerator: accountKey,
    skipSuccessfulRequests: true,
    standardHeaders: true,
    legacyHeaders: false,
    validate: false,
    message: { error: 'Too many sign-in attempts for this account. Wait 15 minutes and try again.' },
  })
}

/**
 * "Forgot password" mails a link, and every send comes out of the same Gmail
 * account that delivers sign-in codes. 5 per account per hour is enough for a
 * typo and a retry, not enough to flood someone's inbox or use up the sending
 * quota. The message is shown after "Couldn't send reset email:" on the Login
 * screen, so it is written to pass isSafeForStudents (no "password").
 */
export function createResetRequestLimiter() {
  return rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5,
    keyGenerator: accountKey,
    standardHeaders: true,
    legacyHeaders: false,
    validate: false,
    message: { error: 'Too many reset requests for this email. Check your inbox and spam folder for the last link, or try again in an hour.' },
  })
}

export const loginLimiter = createLoginLimiter()
export const resetRequestLimiter = createResetRequestLimiter()
