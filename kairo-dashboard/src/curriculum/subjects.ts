/**
 * THE canonical subject registry. No module may declare a subject array.
 *
 * Why this exists: nine modules each hardcoded their own list and none
 * agreed — "My goal" offered both `Math` AND `Mathematics` (a visible
 * duplicate), Adaptive Quiz offered no language at all, Onboarding used
 * `Maths`/`Social`/`Computer`, and Hindi was the only Indian language
 * anywhere. Adding languages to one screen would have deepened the split.
 *
 * CBSE data (`subjects.cbse.json`) is generated from CBSE's OWN document —
 * ANNEXURE-H SUBJECT LIST, CLASS-X/XII (2025-26), from parikshasangam —
 * not from a coaching-site copy. That mattered: the codes circulating in
 * secondary sources had Spanish as 096 (it is 099) and omitted ~14
 * languages including Sanskrit, Kashmiri, Mizo and Bahasa Melayu. The file
 * is data, correctable without a deploy.
 */
import RAW from './subjects.cbse.json'

export type SubjectKind = 'core' | 'language' | 'elective' | 'skill'
export type Stream = 'science' | 'commerce' | 'arts'

export interface Subject {
  /** stable slug — this is what gets PERSISTED, never the label */
  id: string
  label: string
  kind: SubjectKind
  /** the language's own script, shown beside the English label */
  nativeLabel?: string
  boards: string[]
  classes: string[]
  /** { cbse: { '10:default': '086', … } } — official paper codes */
  codes?: Record<string, Record<string, string>>
  streams?: Stream[]
}

const CBSE: Subject[] = (RAW as any).subjects
export const SUBJECT_SOURCE: string = (RAW as any).source

/* ── state boards ───────────────────────────────────────────────────────────
   A state-board student must never be shown the CBSE list. Each board names
   ONE default second language so onboarding can preselect sensibly, and the
   student can always change it.

   Tamil Nadu runs a TWO-LANGUAGE policy (Tamil + English). Hindi is
   deliberately NOT offered as a default or an expected subject there. */

export interface BoardProfile {
  id: string
  label: string
  /** language ids offered, in the order they should appear */
  languages: string[]
  /** the language preselected as first/primary */
  primaryLanguage: string
  /** preselected second language; null on two-language boards that use English */
  defaultSecondLanguage: string | null
  /** how many languages the board expects a student to take */
  languageCount: 2 | 3
  coreSubjects: string[]
}

export const BOARDS: Record<string, BoardProfile> = {
  cbse: {
    id: 'cbse', label: 'CBSE',
    languages: [], // = every language in the official list; filled at call time
    primaryLanguage: 'english',
    defaultSecondLanguage: 'hindi',
    languageCount: 2,
    coreSubjects: ['mathematics', 'science', 'social-science'],
  },
  icse: {
    id: 'icse', label: 'ICSE',
    languages: ['english', 'hindi', 'sanskrit', 'marathi', 'bengali', 'tamil', 'telugu', 'kannada', 'malayalam', 'gujarati', 'odia', 'punjabi', 'urdu', 'french', 'german', 'spanish'],
    primaryLanguage: 'english',
    defaultSecondLanguage: 'hindi',
    languageCount: 2,
    coreSubjects: ['mathematics', 'science', 'social-science'],
  },
  maharashtra: {
    id: 'maharashtra', label: 'Maharashtra State Board',
    languages: ['marathi', 'english', 'hindi', 'sanskrit', 'urdu'],
    primaryLanguage: 'marathi',
    defaultSecondLanguage: 'english',
    languageCount: 3,
    coreSubjects: ['mathematics', 'science', 'social-science'],
  },
  tamilnadu: {
    id: 'tamilnadu', label: 'Tamil Nadu State Board',
    // Two-language policy: Tamil + English. Hindi is not a default here.
    languages: ['tamil', 'english'],
    primaryLanguage: 'tamil',
    defaultSecondLanguage: 'english',
    languageCount: 2,
    coreSubjects: ['mathematics', 'science', 'social-science'],
  },
  karnataka: {
    id: 'karnataka', label: 'Karnataka State Board',
    languages: ['kannada', 'english', 'hindi', 'sanskrit', 'urdu'],
    primaryLanguage: 'kannada',
    defaultSecondLanguage: 'english',
    languageCount: 3,
    coreSubjects: ['mathematics', 'science', 'social-science'],
  },
  up: {
    id: 'up', label: 'UP Board',
    languages: ['hindi', 'english', 'sanskrit', 'urdu'],
    primaryLanguage: 'hindi',
    defaultSecondLanguage: 'english',
    languageCount: 2,
    coreSubjects: ['mathematics', 'science', 'social-science'],
  },
}

export function boardProfile(board: unknown): BoardProfile {
  const key = String(board || '').toLowerCase().replace(/[^a-z]/g, '')
  for (const b of Object.values(BOARDS)) {
    if (key.includes(b.id) || b.id.includes(key)) return b
  }
  if (key.includes('tamil')) return BOARDS.tamilnadu
  if (key.includes('maha')) return BOARDS.maharashtra
  if (key.includes('karnat')) return BOARDS.karnataka
  if (key.includes('icse') || key.includes('cisce')) return BOARDS.icse
  return BOARDS.cbse
}

const byId = new Map(CBSE.map(s => [s.id, s]))

export function getSubject(id: string): Subject | null {
  return byId.get(String(id || '').toLowerCase()) || null
}

/** Old display labels → canonical ids. `Math` and `Mathematics` are ONE id. */
const ALIASES: Record<string, string> = {
  math: 'mathematics', maths: 'mathematics', mathematic: 'mathematics',
  'mathematics standard': 'mathematics', 'mathematics basic': 'mathematics',
  social: 'social-science', 'social studies': 'social-science', sst: 'social-science',
  computer: 'computer-applications', 'computer science': 'computer-science',
  'political science': 'political-science', 'business studies': 'business-studies',
  'home science': 'home-science', 'physical education': 'physical-education',
  general: 'general', sanskrit: 'sanskrit', bio: 'biology',
}

/**
 * Anything a student's device might have stored — a label, an old alias, a
 * different case — resolved to one stable id. Returns null when it genuinely
 * is not a subject we know, so callers can drop it visibly instead of
 * inventing something.
 */
export function resolveSubjectId(value: unknown): string | null {
  const raw = String(value || '').trim().toLowerCase()
  if (!raw) return null
  if (byId.has(raw)) return raw
  if (ALIASES[raw]) return ALIASES[raw]
  const slug = raw.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  if (byId.has(slug)) return slug
  if (ALIASES[slug.replace(/-/g, ' ')]) return ALIASES[slug.replace(/-/g, ' ')]
  // last resort: match on label
  const hit = CBSE.find(s => s.label.toLowerCase() === raw)
  return hit ? hit.id : null
}

function classKey(cls: unknown): string {
  const n = String(cls || '').replace(/\D/g, '')
  return n || '10'
}

/**
 * Every subject this student could actually sit. Board-scoped: a Tamil Nadu
 * student is never shown Limboo, and never shown Hindi as an expectation.
 */
export function availableSubjects(board: unknown, cls: unknown, stream?: Stream): Subject[] {
  const profile = boardProfile(board)
  const c = classKey(cls)
  const inClass = CBSE.filter(s => s.classes.includes(c) || s.classes.length === 0)

  const languages = profile.languages.length
    ? profile.languages.map(id => byId.get(id)).filter(Boolean) as Subject[]
    : inClass.filter(s => s.kind === 'language')

  const nonLanguage = inClass.filter(s => s.kind !== 'language').filter(s => {
    if (!stream || !s.streams) return true
    return s.streams.includes(stream)
  })

  // board default language first, then the rest in the board's own order
  const ordered = [...languages].sort((a, b) => {
    const rank = (s: Subject) =>
      s.id === profile.primaryLanguage ? 0
      : s.id === profile.defaultSecondLanguage ? 1
      : isForeign(s.id) ? 3 : 2
    return rank(a) - rank(b) || a.label.localeCompare(b.label)
  })

  return [...ordered, ...nonLanguage]
}

const FOREIGN = new Set(['french', 'german', 'spanish', 'russian', 'japanese', 'arabic', 'persian', 'tibetan', 'thai', 'bahasa-melayu'])
export function isForeign(id: string): boolean { return FOREIGN.has(id) }

/** A sensible preselect: the board's languages + its core subjects. */
export function defaultSubjects(board: unknown, cls: unknown, stream?: Stream): Subject[] {
  const p = boardProfile(board)
  const ids = [p.primaryLanguage, p.defaultSecondLanguage, ...p.coreSubjects].filter(Boolean) as string[]
  const seen = new Set<string>()
  const out: Subject[] = []
  for (const id of ids) {
    const s = byId.get(id)
    if (s && !seen.has(id)) { seen.add(id); out.push(s) }
  }
  return out
}

/** The official paper code, when the board publishes one. */
export function subjectCode(id: string, board: unknown, cls: unknown, variant = 'default'): string | null {
  const s = byId.get(id)
  const b = boardProfile(board).id
  const table = s?.codes?.[b]
  if (!table) return null
  const c = classKey(cls)
  return table[`${c}:${variant}`] || table[`${c}:default`]
    || Object.entries(table).find(([k]) => k.startsWith(`${c}:`))?.[1] || null
}

/** "Tamil / தமிழ்" — a student picking their mother tongue sees it in its script. */
export function displayLabel(s: Subject): string {
  return s.nativeLabel && s.nativeLabel !== s.label ? `${s.label} / ${s.nativeLabel}` : s.label
}

export const ALL_SUBJECTS = CBSE

/**
 * Convenience for the many screens that just need a dropdown of subject
 * NAMES for the student in front of them. Board- and class-aware, so a
 * Tamil Nadu student sees Tamil and never Limboo, and no screen has to
 * hardcode anything.
 *
 * `kinds` narrows it: Grader wants languages + humanities, Adaptive Quiz
 * wants everything academic, Formula Sheet wants the sciences.
 */
export function subjectLabels(opts: {
  board?: unknown
  cls?: unknown
  kinds?: SubjectKind[]
  /** prepend "General" for tools that accept an unscoped question */
  general?: boolean
  max?: number
} = {}): string[] {
  const { board, cls, kinds, general, max = 24 } = opts
  const list = availableSubjects(board, cls)
    .filter(s => !kinds || kinds.includes(s.kind))
    // skill subjects are a long tail nobody picks from a dropdown
    .filter(s => s.kind !== 'skill')
  const labels = list.slice(0, max).map(s => s.label)
  return general ? ['General', ...labels] : labels
}

/**
 * One-time migration of stored selections that used DISPLAY LABELS
 * ("Math", "Social") instead of ids. A student who picked Tamil last month
 * still has Tamil after this refactor.
 *
 * Anything that cannot be resolved is dropped and REPORTED, never silently
 * discarded — the caller shows a non-destructive note.
 */
export function migrateSubjectSelection(stored: unknown[]): { ids: string[]; dropped: string[] } {
  const ids: string[] = []
  const dropped: string[] = []
  for (const v of stored || []) {
    const id = resolveSubjectId(v)
    if (!id) { dropped.push(String(v)); continue }
    if (!ids.includes(id)) ids.push(id)
  }
  return { ids, dropped }
}

/**
 * Drop selections the student's CURRENT board/class no longer offers —
 * switching board must not leave an invalid subject silently scoring them.
 */
export function pruneToBoard(ids: string[], board: unknown, cls: unknown): { kept: string[]; removed: Subject[] } {
  const allowed = new Set(availableSubjects(board, cls).map(s => s.id))
  const kept: string[] = []
  const removed: Subject[] = []
  for (const id of ids || []) {
    if (allowed.has(id)) kept.push(id)
    else { const s = byId.get(id); if (s) removed.push(s) }
  }
  return { kept, removed }
}
