import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

/**
 * Server-side topic resolution.
 *
 * The DATA has one home — src/data/syllabus/*.json, read here with fs and by
 * the client through the bundler. The ~40 lines of matching logic are mirrored
 * from src/data/syllabus/index.ts because the client module is TypeScript and
 * imports JSON through Vite, neither of which this plain-ESM server can do.
 * If the scoring changes, change it in both; server/__tests__/syllabus.test.js
 * pins the behaviour so a drift shows up as a failure.
 */

const here = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(here, '../../src/data/syllabus')

export const CONFIDENCE_FLOOR = 0.55

const boards = new Map()
const flatCache = new Map()

function load(board) {
  if (boards.has(board)) return boards.get(board)
  let data = null
  try {
    data = JSON.parse(readFileSync(join(DATA_DIR, `${board}.json`), 'utf8'))
  } catch (e) {
    // Only cbse.json exists today. A missing board must degrade to "cannot
    // classify" rather than throwing on every memory write.
    console.warn(`[syllabus] no map for board "${board}":`, e.message)
  }
  boards.set(board, data)
  return data
}

const STOP = new Set([
  'the', 'a', 'an', 'of', 'and', 'in', 'to', 'for', 'on', 'is', 'are', 'its',
  'what', 'how', 'why', 'explain', 'chapter', 'topic', 'class', 'question',
])

const stem = (w) => w.replace(/(ies)$/, 'y').replace(/(es|s)$/, '')

function tokenise(s) {
  return new Set(
    String(s).toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2 && !STOP.has(w))
      .map(stem),
  )
}

export function allTopics(board = 'cbse', cls) {
  const key = `${board}:${cls ?? '*'}`
  if (flatCache.has(key)) return flatCache.get(key)

  const data = load(board)
  const out = []
  if (data) {
    for (const [c, subjects] of Object.entries(data.classes)) {
      if (cls && String(c) !== String(cls)) continue
      for (const [subject, chapters] of Object.entries(subjects)) {
        for (const [chapter, topics] of Object.entries(chapters)) {
          for (const t of topics) {
            if (t.retired) continue
            out.push({ ...t, subject, chapter, cls: c, tokens: tokenise(`${t.name} ${chapter}`) })
          }
        }
      }
    }
  }
  flatCache.set(key, out)
  return out
}

/**
 * Free text -> a syllabus topic, or null.
 *
 * Returning null is the important half. The memory store is full of entries
 * like "wat is ur name" because whatever the student typed became a topic;
 * anything under the floor is now the caller's problem to store as
 * unclassified, and unclassified never enters the weak/strong lists.
 */
export function resolveTopic(raw, board = 'cbse', cls) {
  const text = String(raw || '').trim()
  if (!text) return null

  const pool = allTopics(board, cls)
  if (!pool.length) return null

  const direct = pool.find(t => t.topicId === text)
  if (direct) return shape(direct, 1)

  const q = tokenise(text)
  if (!q.size) return null

  let best = null
  let bestScore = 0
  for (const t of pool) {
    let shared = 0
    for (const tok of q) if (t.tokens.has(tok)) shared++
    if (!shared) continue
    const score = shared / Math.min(q.size, t.tokens.size)
    if (score > bestScore) { bestScore = score; best = t }
  }

  if (!best || bestScore < CONFIDENCE_FLOOR) return null
  return shape(best, Math.min(1, bestScore))
}

export function isInScope(topicId, board = 'cbse', cls) {
  return allTopics(board, cls).some(t => t.topicId === topicId)
}

function shape(t, confidence) {
  return {
    topicId: t.topicId,
    name: t.name,
    subject: t.subject,
    chapter: t.chapter,
    confidence,
  }
}
