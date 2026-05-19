/**
 * NCERT Cache Lookup
 *
 * Normalises a user's question into clean tokens, then walks the in-bundle
 * NCERT cache to find a match. A hit returns a TextPlan-shaped object that
 * the Solver can use as if it came from /api/ai/solver/text.
 *
 * Match semantics:
 *   - Each entry has 1+ `match` groups (arrays of keywords).
 *   - A group HITS when every keyword in it appears in the question's tokens.
 *   - The entry HITS when any of its groups hit (OR over groups, AND inside).
 *
 * Token normalisation:
 *   - lowercase
 *   - strip apostrophes (newton's → newtons)
 *   - replace non-alphanum with spaces
 *   - simple plural stemming (laws → law, atoms → atom, classes → classe, but
 *     close enough for high-school question phrasing)
 */
import { NCERT_CACHE, type NcertEntry } from '../data/ncertCache'

export interface NcertHit {
  /** Shape-compatible with the server's TextPlan response. */
  questionType:    string
  topicKeyword:    string | null
  supports3D:      boolean
  labRoute:        string | null
  textExplanation: string
  formulas:        string[]
  relatedConcepts: string[]
  imageQueries:    string[]
  videoQuery:      string
  modelUsed:       string
  /** True when delivered from the local cache (used by the Solver to skip retries). */
  fromLocalCache:  true
}

// ─────────────────────────────────────────────────────────────────────────
function stem(t: string): string {
  // Strip trailing 's' for crude plural handling — keep words ≥ 3 chars long
  // to avoid mangling "is", "as", etc.
  if (t.length >= 4 && t.endsWith('s')) return t.slice(0, -1)
  return t
}

function tokenize(s: string): string[] {
  return s.toLowerCase()
    .replace(/['']/g, '')       // newton's → newtons
    .replace(/[^a-z0-9]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map(stem)
}

function entryMatches(tokens: string[], entry: NcertEntry): boolean {
  const tokenSet = new Set(tokens.map(stem))
  return entry.match.some(group =>
    group.every(kw => tokenSet.has(stem(kw.toLowerCase())))
  )
}

// ─────────────────────────────────────────────────────────────────────────
/**
 * Try to answer the given question from the local NCERT cache.
 * Returns a TextPlan-shaped object on hit, null on miss.
 */
export function lookupNcert(question: string): NcertHit | null {
  if (!question || typeof question !== 'string') return null
  const tokens = tokenize(question)
  if (tokens.length === 0) return null

  for (const entry of NCERT_CACHE) {
    if (entryMatches(tokens, entry)) {
      return {
        questionType:    'concept',
        topicKeyword:    entry.topicKeyword,
        supports3D:      entry.supports3D,
        labRoute:        entry.labRoute,
        textExplanation: entry.textExplanation,
        formulas:        entry.formulas,
        relatedConcepts: entry.relatedConcepts,
        imageQueries:    entry.imageQueries,
        videoQuery:      entry.videoQuery,
        modelUsed:       'ncert-local-cache',
        fromLocalCache:  true,
      }
    }
  }
  return null
}

/** Public count — useful for the Solver status chip and the /status page. */
export function ncertCacheSize(): number {
  return NCERT_CACHE.length
}
