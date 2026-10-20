/**
 * Feature flags for the student-only v1.
 *
 * Nothing here deletes code. Teacher, admin and parent surfaces stay in the
 * repo and their API routes stay deployed (behind role checks) — they are
 * simply not reachable from this build's UI.
 *
 * Override per environment with VITE_FLAG_<NAME>=true|false, so a flag can be
 * flipped on a preview deploy without a code change.
 */

const DEFAULTS = {
  TEACHER_TOOLS: false,
  ADMIN_TOOLS:   false,
  PARENT_PORTAL: false,
  SCHOOL_MODE:   false,
  /** 1.3MB of three.js across 18 chunks, for a feature with no measured
   *  usage, on a phone. Code retained; excluded from the v1 bundle. */
  LABS_3D:       false,
  VOICE_MODE:    true,
  PDF_ENGINE:    true,
} as const

export type FlagName = keyof typeof DEFAULTS

/**
 * Each override written out by name, never looked up with a computed key.
 *
 * This used to read import.meta.env[`VITE_FLAG_${name}`]. Vite cannot know at
 * build time which variable a computed key means, so it inlined the WHOLE env
 * object into the bundle - every VITE_ variable on the Vercel project, which
 * put a live OpenRouter key in public JavaScript for anyone to copy. Spelling
 * each one out makes Vite inline exactly these seven values and nothing else.
 * server/__tests__/env-leak.test.js keeps it that way.
 */
const ENV_OVERRIDES: Record<FlagName, string | undefined> = {
  TEACHER_TOOLS: import.meta.env.VITE_FLAG_TEACHER_TOOLS,
  ADMIN_TOOLS:   import.meta.env.VITE_FLAG_ADMIN_TOOLS,
  PARENT_PORTAL: import.meta.env.VITE_FLAG_PARENT_PORTAL,
  SCHOOL_MODE:   import.meta.env.VITE_FLAG_SCHOOL_MODE,
  LABS_3D:       import.meta.env.VITE_FLAG_LABS_3D,
  VOICE_MODE:    import.meta.env.VITE_FLAG_VOICE_MODE,
  PDF_ENGINE:    import.meta.env.VITE_FLAG_PDF_ENGINE,
}

/** Only 'true' and 'false' count. Anything else falls back to the default,
 *  so a typo in an env var can't silently disable a shipped feature. */
function envOverride(name: FlagName): boolean | undefined {
  const raw = ENV_OVERRIDES[name]
  if (raw === 'true') return true
  if (raw === 'false') return false
  return undefined
}

export const FLAGS: Record<FlagName, boolean> = Object.fromEntries(
  (Object.keys(DEFAULTS) as FlagName[]).map(k => [k, envOverride(k) ?? DEFAULTS[k]]),
) as Record<FlagName, boolean>

/**
 * Registry ids that must not render, must not appear in nav, and must not be
 * reachable by deep link in v1. Kept next to the flags because the two are
 * read together — see filterFeatures().
 */
export const DEFERRED_FEATURE_IDS: readonly string[] = [
  'school-hub', 'attendance', 'timetable', 'announcement', 'fee-reminder',
  'admission', 'analytics', 'lesson-plan', 'question-paper', 'parent-message',
  'parent', 'teacher', 'health',
] as const

/** Which flag governs each deferred id, for the cases where flipping one flag
 *  should bring a group back. Anything unlisted is governed by its audience
 *  alone and stays off while it is in DEFERRED_FEATURE_IDS. */
const FEATURE_FLAG: Partial<Record<string, FlagName>> = {
  'school-hub':     'SCHOOL_MODE',
  'attendance':     'SCHOOL_MODE',
  'timetable':      'ADMIN_TOOLS',
  'announcement':   'ADMIN_TOOLS',
  'fee-reminder':   'ADMIN_TOOLS',
  'admission':      'ADMIN_TOOLS',
  'analytics':      'ADMIN_TOOLS',
  'health':         'ADMIN_TOOLS',
  'lesson-plan':    'TEACHER_TOOLS',
  'question-paper': 'TEACHER_TOOLS',
  'parent-message': 'TEACHER_TOOLS',
  'teacher':        'TEACHER_TOOLS',
  'parent':         'PARENT_PORTAL',
}

export interface RegistryFeature {
  id: string
  label: string
  route: string
  /** Comma-separated in the server registry: 'teacher,admin'. */
  audience: string
}

/**
 * A feature ships only if it is for students AND its governing flag is on.
 * Both conditions, per §3.2 — audience alone was not enough, because several
 * admin tools were also tagged for students.
 */
export function isFeatureEnabled(f: RegistryFeature): boolean {
  const audiences = f.audience.split(',').map(s => s.trim())
  if (!audiences.includes('student')) return false

  const flag = FEATURE_FLAG[f.id]
  if (flag && !FLAGS[flag]) return false
  if (DEFERRED_FEATURE_IDS.includes(f.id) && !flag) return false

  if (f.id === 'labs' && !FLAGS.LABS_3D) return false
  if (f.id === 'voice' && !FLAGS.VOICE_MODE) return false

  return true
}

export function filterFeatures(all: readonly RegistryFeature[]): RegistryFeature[] {
  return all.filter(isFeatureEnabled)
}
