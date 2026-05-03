/**
 * Supabase Auth Middleware
 *
 * requireSupabaseAuth  — verifies Bearer JWT from Supabase, attaches req.user + req.school
 * requireRole(...roles) — role guard that runs AFTER requireSupabaseAuth
 */
import { supabaseAdmin } from '../services/supabase.js'

// ── Verify Supabase JWT + load user profile ────────────────────────────────────
export async function requireSupabaseAuth(req, res, next) {
  const header = req.headers.authorization || ''
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null

  if (!token) return res.status(401).json({ error: 'Missing Bearer token.' })

  try {
    // Verify the JWT with Supabase
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
    if (error || !user) return res.status(401).json({ error: 'Invalid or expired token.' })

    // Load full user profile (role + school)
    const { data: profile, error: profileErr } = await supabaseAdmin
      .from('users')
      .select('id, name, role, school_id, avatar_url')
      .eq('id', user.id)
      .single()

    if (profileErr || !profile) {
      return res.status(403).json({ error: 'User profile not found. Please complete registration.' })
    }

    // Load school context
    let school = null
    if (profile.school_id) {
      const { data } = await supabaseAdmin
        .from('schools')
        .select('id, school_name, school_logo_url, school_email, plan')
        .eq('id', profile.school_id)
        .single()
      school = data
    }

    req.supabaseUser = user          // raw Supabase auth user
    req.user         = profile       // our users table row
    req.school       = school        // school context (null if no school)
    req.schoolId     = profile.school_id

    next()
  } catch (err) {
    console.error('[supabaseAuth]', err.message)
    res.status(500).json({ error: 'Auth check failed.' })
  }
}

// ── Role Guard ────────────────────────────────────────────────────────────────
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated.' })
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Access denied. Required role: ${roles.join(' or ')}. Your role: ${req.user.role}`,
      })
    }
    next()
  }
}

// ── Optional Auth (attaches user if token present, does not block) ─────────────
export async function optionalSupabaseAuth(req, _res, next) {
  const header = req.headers.authorization || ''
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return next()

  try {
    const { data: { user } } = await supabaseAdmin.auth.getUser(token)
    if (user) {
      const { data: profile } = await supabaseAdmin
        .from('users').select('*').eq('id', user.id).single()
      req.user   = profile
      req.schoolId = profile?.school_id
    }
  } catch {}
  next()
}
