import { supabaseAdmin } from '../services/supabase.js'

export async function requireSupabaseAuth(req, res, next) {
  const header = req.headers.authorization || ''
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null

  if (!token) return res.status(401).json({ error: 'Missing Bearer token.' })

  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
    if (error || !user) return res.status(401).json({ error: 'Invalid or expired token.' })

    const { data: profile, error: profileErr } = await supabaseAdmin
      .from('users')
      .select('id, name, role, school_id, avatar_url, status')
      .eq('id', user.id)
      .single()

    if (profileErr || !profile) {
      return res.status(403).json({ error: 'User profile not found. Please complete registration.' })
    }

    // Status used to be read here and then ignored. The only check lived in
    // /api/users/login, which the app never calls - it signs in with Supabase
    // directly - so a suspended account kept full API access.
    if (profile.status === 'suspended') {
      return res.status(403).json({ error: 'This account has been suspended. Contact your school.', suspended: true })
    }

    let school = null
    if (profile.school_id) {
      const { data } = await supabaseAdmin
        .from('schools')
        .select('id, school_name, school_logo_url, school_email, plan')
        .eq('id', profile.school_id)
        .single()
      school = data
    }

    req.supabaseUser = user
    req.user         = profile
    req.school       = school
    req.schoolId     = profile.school_id

    next()
  } catch (err) {
    console.error('[supabaseAuth]', err.message)
    res.status(500).json({ error: 'Auth check failed.' })
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated.' })
    // A role is only a power once it has been approved. A teacher who joined
    // with the school passcode is 'pending' until an admin approves them, and
    // must not read a class's marks in the meantime. (null = rows from before
    // the status column existed, which were all active.)
    if (req.user.status && req.user.status !== 'active') {
      return res.status(403).json({ error: 'Your account is waiting for your school admin to approve it.', pending: true })
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Access denied. Required role: ${roles.join(' or ')}. Your role: ${req.user.role}`,
      })
    }
    next()
  }
}

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
