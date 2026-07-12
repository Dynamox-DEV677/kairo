import rateLimit from 'express-rate-limit'

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
