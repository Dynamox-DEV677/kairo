import { supabaseAdmin } from '../services/supabase.js'

export function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for']
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  return (
    req.headers['x-real-ip']          ||
    req.headers['cf-connecting-ip']   ||
    req.headers['fastly-client-ip']   ||
    req.connection?.remoteAddress      ||
    req.socket?.remoteAddress          ||
    '0.0.0.0'
  )
}

export function isIpInRange(ip, cidr) {
  try {
    const cleanIp = ip.replace(/^::ffff:/, '')

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

export async function checkNetworkRestriction(req, res, next) {
  if (!req.schoolId) return next()

  if (req.user?.role === 'admin') return next()

  try {
    const { data: rules, error } = await supabaseAdmin
      .from('network_rules')
      .select('cidr, label')
      .eq('school_id', req.schoolId)
      .eq('enabled', true)

    if (error) {
      console.error('[NetworkRestriction] DB error:', error.message)
      return next()
    }

    if (!rules || rules.length === 0) return next()

    const clientIp = getClientIp(req)
    const allowed  = rules.some(rule => isIpInRange(clientIp, rule.cidr))

    if (!allowed) {
      return res.status(403).json({
        error:     "Access denied: your network is not allowed by your school's Wi-Fi policy.",
        client_ip: clientIp,
        rules_count: rules.length,
      })
    }

    next()
  } catch (e) {
    console.error('[NetworkRestriction]', e.message)
    next()
  }
}
