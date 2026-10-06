/**
 * Which OTHER websites' pages may read this API's answers in a browser.
 *
 * Kyno itself never needs this. The web app and the Android app (which loads
 * the live site) call /api from their own origin, and same-origin requests skip
 * CORS entirely. So this list is only "other sites we trust" -- and it used to
 * include every *.vercel.app site, which anyone can deploy in a minute.
 *
 * Exact origins only: the production site, anything listed in ALLOWED_ORIGIN
 * (comma-separated), and -- outside production -- a local dev server.
 */
export const KYNO_ORIGINS = ['https://kairo-daily-edu.vercel.app']

export function isAllowedOrigin(origin, env = process.env) {
  if (!origin) return false
  if (KYNO_ORIGINS.includes(origin)) return true
  const extra = String(env.ALLOWED_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean)
  if (extra.includes(origin)) return true
  return env.NODE_ENV !== 'production' && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
}

export function kynoCors(env = process.env) {
  return (req, res, next) => {
    const origin = req.headers.origin || ''
    if (isAllowedOrigin(origin, env)) {
      res.setHeader('Access-Control-Allow-Origin', origin)
      res.vary('Origin')   // the answer depends on who asked, so caches must key on it
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    if (req.method === 'OPTIONS') return res.sendStatus(204)
    next()
  }
}
