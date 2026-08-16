import cbse from './cbse.json'
import cambridge from './cambridge.json'
import ib from './ib.json'

/**
 * The syllabus map, and the only sanctioned way to turn text into a topic.
 *
 * Two rules this file exists to enforce:
 *
 *  1. A topic is NEVER a free-text string. The learner model currently holds
 *     entries like "wat is ur name" and "sin30=1/2, cos60=1/2 so answer = 1/4"
 *     as weak topics, because whatever the student typed was stored verbatim.
 *     Everything now resolves to a topicId or is stored as unclassified.
 *
 *  2. The model NEVER decides what is in scope. Topic Architect claimed
 *     kinetics and catalysis are outside the NEET syllabus; they are not. Scope
 *     questions are answered by code reading this JSON.
 */

export interface Topic {
  topicId: string
  name: string
  retired?: boolean
}

export interface ResolvedTopic {
  topicId: string
  name: string
  subject: string
  chapter: string
  /** 0–1. Below CONFIDENCE_FLOOR the caller must store `unclassified`. */
  confidence: number
}

export type BoardId = 'cbse' | 'cambridge' | 'ib' | 'icse' | 'jee' | 'neet'

/** Below this, a match is a guess, and a guessed weakness is worse than none. */
export const CONFIDENCE_FLOOR = 0.55

const BOARDS: Partial<Record<BoardId, any>> = { cbse, cambridge, ib }

export function boardAvailable(board: BoardId): boolean {
  return !!BOARDS[board]
}

/**
 * Which key inside `classes` to read for a given student class.
 *
 * IGCSE is a two-year course for roughly 14-16 year olds and Cambridge does not
 * divide the syllabus by year, so cambridge.json declares `singleStage` and
 * every class number resolves to it. Splitting IGCSE content across "class 9"
 * and "class 10" would be a structure we invented, which is exactly what the
 * board map exists to prevent.
 */
function stageKey(board: BoardId, cls?: string): string | undefined {
  const single = (BOARDS[board] as any)?.singleStage
  return single || cls
}

interface FlatTopic extends Topic {
  subject: string
  chapter: string
  cls: string
  tokens: Set<string>
}

const flatCache = new Map<string, FlatTopic[]>()

/** Every topic for a board, optionally narrowed to one class. */
export function allTopics(board: BoardId, cls?: string): FlatTopic[] {
  const want = stageKey(board, cls)
  const cacheKey = `${board}:${want ?? '*'}`
  const hit = flatCache.get(cacheKey)
  if (hit) return hit

  const data = BOARDS[board]
  const out: FlatTopic[] = []
  if (data) {
    for (const [c, subjects] of Object.entries(data.classes)) {
      if (want && c !== want) continue
      for (const [subject, chapters] of Object.entries(subjects as Record<string, Record<string, Topic[]>>)) {
        for (const [chapter, topics] of Object.entries(chapters)) {
          for (const t of topics) {
            if (t.retired) continue
            out.push({ ...t, subject, chapter, cls: c, tokens: tokenise(`${t.name} ${chapter}`) })
          }
        }
      }
    }
  }
  flatCache.set(cacheKey, out)
  return out
}

/** Is this id real, and is it inside the given board/class? */
export function isInScope(topicId: string, board: BoardId, cls?: string): boolean {
  return allTopics(board, cls).some(t => t.topicId === topicId)
}

/**
 * Filter a model's proposed topic list down to what is genuinely in scope.
 * Returns the accepted ids and the rejected strings, so a caller can tell the
 * student "3 of these are not in your syllabus" instead of silently dropping.
 */
export function validateTopics(
  proposed: string[],
  board: BoardId,
  cls?: string,
): { accepted: ResolvedTopic[]; rejected: string[] } {
  const accepted: ResolvedTopic[] = []
  const rejected: string[] = []
  for (const p of proposed) {
    const r = resolveTopic(p, board, cls)
    if (r) accepted.push(r)
    else rejected.push(p)
  }
  return { accepted, rejected }
}

const STOP = new Set([
  'the', 'a', 'an', 'of', 'and', 'in', 'to', 'for', 'on', 'is', 'are', 'its',
  'what', 'how', 'why', 'explain', 'chapter', 'topic', 'class', 'question',
])

function tokenise(s: string): Set<string> {
  return new Set(
    s.toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2 && !STOP.has(w))
      .map(stem),
  )
}

/** Crude but sufficient: collapses equations/equation, reactions/reaction. */
function stem(w: string): string {
  return w.replace(/(ies)$/, 'y').replace(/(es|s)$/, '')
}

/**
 * Resolve free text to a syllabus topic.
 *
 * Deliberately conservative — an exact id passes through, a strong token
 * overlap resolves, and anything weaker returns null so the caller stores it
 * as unclassified rather than inventing a weakness.
 */
export function resolveTopic(raw: string, board: BoardId, cls?: string): ResolvedTopic | null {
  const text = (raw || '').trim()
  if (!text) return null

  const pool = allTopics(board, cls)
  if (!pool.length) return null

  // An id that already exists is not a guess.
  const direct = pool.find(t => t.topicId === text)
  if (direct) return shape(direct, 1)

  const q = tokenise(text)
  if (!q.size) return null

  let best: FlatTopic | null = null
  let bestScore = 0

  for (const t of pool) {
    let shared = 0
    for (const tok of q) if (t.tokens.has(tok)) shared++
    if (!shared) continue

    // Jaccard-ish, but weighted toward covering the topic's own tokens so a
    // long rambling question can still match a short topic name.
    const score = shared / Math.min(q.size, t.tokens.size)
    if (score > bestScore) { bestScore = score; best = t }
  }

  if (!best || bestScore < CONFIDENCE_FLOOR) return null
  return shape(best, Math.min(1, bestScore))
}

function shape(t: FlatTopic, confidence: number): ResolvedTopic {
  return {
    topicId: t.topicId,
    name: t.name,
    subject: t.subject,
    chapter: t.chapter,
    confidence,
  }
}

/** The allowed-topic list to pass into a prompt, so the model picks from a set
 *  instead of inventing scope. */
export function scopeForPrompt(board: BoardId, cls: string, subject?: string): string[] {
  return allTopics(board, cls)
    .filter(t => !subject || t.subject === subject)
    .map(t => `${t.topicId} — ${t.name} (${t.chapter})`)
}
