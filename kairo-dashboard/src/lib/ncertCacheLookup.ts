import { NCERT_CACHE, type NcertEntry } from '../data/ncertCache'

export interface NcertHit {
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
  fromLocalCache:  true
}

function stem(t: string): string {
  if (t.length >= 4 && t.endsWith('s')) return t.slice(0, -1)
  return t
}

function tokenize(s: string): string[] {
  return s.toLowerCase()
    .replace(/['']/g, '')
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

export function ncertCacheSize(): number {
  return NCERT_CACHE.length
}
