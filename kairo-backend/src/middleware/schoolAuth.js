/**
 * School Auth Middleware
 *
 * requireSchoolAdmin        — must be 'admin' role within a school
 * requireTeacherOrAdmin     — must be 'teacher' or 'admin'
 * checkNetworkRestriction   — blocks request if school has IP rules and client IP is not whitelisted
 * getClientIp(req)          — extract real IP from headers (proxy-aware)
 * isIpInRange(ip, cidr)     — pure-JS IPv4 CIDR membership check
 *
 * Usage (order matters):
 *   router.post('/foo', requireSupabaseAuth, requireSchoolAdmin, handler)
 *   router.post('/bar', requireSupabaseAuth, checkNetworkRestriction, handler)
 */
import { supabaseAdmin } from '../services/supabase.js'

// ── IP Extraction ──────────────────────────────────────────────────────────────
/**
 * Returns the real client IP address, checking standard proxy headers first.
 * Falls back to socket remote address.
 */
export function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for']
  if (forwarded) {
    // x-forwarded-for may contain multiple IPs: client, proxy1, proxy2, ...
    return forwarded.split(',')[0].trim()
  }
  return (
    req.headers['x-real-ip']          ||
    req.headers['cf-connecting-ip']   ||  // Cloudflare
    req.headers['fastly-client-ip']   ||
    req.connection?.remoteAddress      ||
    req.socket?.remoteAddress          ||
    '0.0.0.0'
  )
}

// ── CIDR Matching ─────────────────────────────────────────────────────────────
/**
 * Checks whether an IPv4 address falls within a CIDR range.
 * Handles both "192.168.1.0/24" notation and bare IPs ("203.0.113.5" treated as /32).
 * Returns false for IPv6 addresses (CIDR matching for IPv6 not yet supported).
 */
export function isIpInRange(ip, cidr) {
  try {
    // Strip IPv6-mapped-IPv4 prefix (e.g. ::ffff:192.168.1.1 → 192.168.1.1)
    const cleanIp = ip.replace(/^::ffff:/, '')

    // Reject pure IPv6 (contains ':' after cleanup)
    if (cleanIp.includes(':')) return false

    const [range, bits] = cidr.split('/')
    const maskBits = bits !== undefined ? parseInt(bits, 10) : 32

    if (isNaN(maskBits) || maskBits < 0 || maskBits > 32) return false

    const ipInt    = ipv4ToInt(cleanIp)
    const rangeInt = ipv4ToInt(range)
    const maskInt  = maskBits === 0 ? 0 : (~0 << (32 - maskBits)) >>> 0

    return (ipInt & maskInt) === (rangeInt & maskInt)
  } catch {
    return false
  }
}

function ipv4ToInt(ip) {
  const parts = ip.split('.')
  if (parts.length !== 4) throw new Error(`Invalid IPv4: ${ip}`)
  return parts.reduce((acc, octet) => {
    const n = parseInt(octet, 10)
    if (isNaN(n) || n < 0 || n > 255) throw new Error(`Invalid octet: ${octet}`)
    return (acc << 8) + n
  }, 0) >>> 0
}

// ── requireSchoolAdmin ────────────────────────────────────────────────────────
/**
 * Requires the authenticated user to have role 'admin'.
 * Must be used AFTER requireSupabaseAuth.
 */
export function requireSchoolAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated.' })
  }
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      error: `School admin access required. Your role: ${req.user.role}`,
    })
  }
  if (!req.schoolId) {
    return res.status(403).json({ error: 'You are not part of a school.' })
  }
  next()
}

// ── requireTeacherOrAdmin ─────────────────────────────────────────────────────
/**
 * Requires the authenticated user to have role 'teacher' or 'admin'.
 * Must be used AFTER requireSupabaseAuth.
 */
export function requireTeacherOrAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated.' })
  }
  if (!['teacher', 'admin'].includes(req.user.role)) {
    return res.status(403).json({
      error: `Teacher or admin access required. Your role: ${req.user.role}`,
    })
  }
  if (!req.schoolId) {
    return res.status(403).json({ error: 'You are not part of a school.' })
  }
  next()
}

// ── checkNetworkRestriction ───────────────────────────────────────────────────
/**
 * If the user's school has ANY enabled network rules, the client IP must
 * match at least one of them. If no rules exist the check passes (open access).
 *
 * Must be used AFTER requireSupabaseAuth so req.schoolId is available.
 * Admins bypass the restriction (they need access from anywhere to manage things).
 */
export async function checkNetworkRestriction(req, res, next) {
  // No school context → skip
  if (!req.schoolId) return next()

  // Admins are always allowed regardless of IP rules
  if (req.user?.role === 'admin') return next()

  try {
    const { data: rules, error } = await supabaseAdmin
      .from('network_rules')
      .select('cidr, label')
      .eq('school_id', req.schoolId)
      .eq('enabled', true)

    if (error) {
      console.error('[NetworkRestriction] DB error:', error.message)
      return next()  // fail open — don't block on DB errors
    }

    // No rules → open access
    if (!rules || rules.length === 0) return next()

    const clientIp = getClientIp(req)
    const allowed  = rules.some(rule => isIpInRange(clientIp, rule.cidr))

    if (!allowed) {
      return res.status(403).json({
        error:     'Access denied: your network is not allowed by your school's Wi-Fi policy.',
        client_ip: clientIp,
        rules_count: rules.length,
      })
    }

    next()
  } catch (e) {
    console.error('[NetworkRestriction]', e.message)
    next()  // fail open
  }
}
