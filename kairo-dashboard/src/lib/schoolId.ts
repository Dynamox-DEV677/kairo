/**
 * The student's real school, or nothing.
 *
 * Twelve pages carried `const SCHOOL_ID = 'demo_school'`, so a personal
 * student -- who has no school at all -- was sending a fabricated id to the
 * server with every request. One of those requests, the timetable, is
 * teacher-only, so it came back 403 "Required role: teacher or admin" from a
 * student session: a made-up id asking a question it was never allowed to ask.
 *
 * Kyno is dual-mode. Most students have no school, and the honest value for
 * them is absent, not invented.
 */
import { getProfile } from './twin'

export function schoolId(): string | null {
  try {
    const p = getProfile() as { school_id?: string | null; schoolId?: string | null } | null
    const id = p?.school_id || p?.schoolId
    return typeof id === 'string' && id.trim() && id !== 'demo_school' ? id : null
  } catch { return null }
}

/** Spread into a request body: adds school_id only when there really is one. */
export function schoolFields(): { school_id?: string } {
  const id = schoolId()
  return id ? { school_id: id } : {}
}
