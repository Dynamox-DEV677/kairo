/**
 * The older NeDB routes trusted whatever school_id the request carried.
 *
 * Thirteen of them read `req.body.school_id || req.query.school_id`, so any
 * signed-in user could name another school and read or overwrite its quizzes,
 * doubts, announcements, fee records or Gmail credentials - and Express 4's
 * query parser turned `?school_id[$ne]=x` into a NeDB operator that matched
 * every school at once. Students with no school all landed in one shared
 * 'demo_school' bucket, so they read each other's saved doubts.
 *
 * ownSchoolOnly makes the caller's own school the only answer. It runs after
 * requireSupabaseAuth, so req.schoolId and req.user come from the verified
 * token and the users table, never from the request. A student with no school
 * gets a bucket of their own instead of a shared one.
 */

/** The only school id this caller may act on. */
export function ownSchoolId(req) {
  return req.schoolId ? String(req.schoolId) : `user:${req.user?.id}`
}

/**
 * Router-level: overwrite school_id in the body and the query with the
 * caller's own, and refuse anything that is not a plain string (an object
 * there is an injection attempt, not a typo).
 */
export function ownSchoolOnly(req, res, next) {
  if (!req.user?.id) return res.status(401).json({ error: 'Not authenticated.' })
  for (const bag of [req.body, req.query]) {
    if (bag && typeof bag === 'object' && bag.school_id != null && typeof bag.school_id !== 'string') {
      return res.status(400).json({ error: 'school_id must be a string.' })
    }
  }
  const own = ownSchoolId(req)
  if (req.body && typeof req.body === 'object' && !Array.isArray(req.body)) req.body.school_id = own
  if (req.query && typeof req.query === 'object') req.query.school_id = own
  next()
}

/** Route-level, for /:schoolId paths: the id in the URL must be the caller's. */
export function ownSchoolParam(name = 'schoolId') {
  return (req, res, next) => {
    if (String(req.params?.[name] ?? '') !== ownSchoolId(req)) {
      return res.status(403).json({ error: 'That is not your school.' })
    }
    next()
  }
}

/** For routes that also took a user_id from the request: it is always the caller. */
export function ownUserOnly(req, res, next) {
  if (!req.user?.id) return res.status(401).json({ error: 'Not authenticated.' })
  if (req.body && typeof req.body === 'object' && !Array.isArray(req.body)) req.body.user_id = req.user.id
  if (req.query && typeof req.query === 'object') req.query.user_id = req.user.id
  next()
}
