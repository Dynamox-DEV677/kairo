import rateLimit from 'express-rate-limit'

/** General API rate limit */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again in 15 minutes.' },
})

/** Strict limit for credential save/test (prevent brute force) */
export const credentialLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,  // 1 hour
  max: 10,
  message: { error: 'Too many credential attempts. Try again in 1 hour.' },
})

/** Email send endpoint — prevent accidental spam */
export const emailLimiter = rateLimit({
  windowMs: 60 * 1000,  // 1 minute
  max: 5,
  message: { error: 'Email send rate limit hit. Max 5 sends per minute.' },
})
