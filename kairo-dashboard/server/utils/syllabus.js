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
    // cbse.json and cambridge.json exist today. A board with no verified map
    // must degrade to "cannot classify" rather than throwing on every memory
    // write — and must never silently borrow another board's chapters.
    console.warn(`[syllabus] no map for board "${board}":`, e.message)
  }
  boards.set(board, data)
  return data
}

/**
 * Which key inside `classes` to read. Mirrors stageKey() in
 * src/data/syllabus/index.ts — cambridge.json sets `singleStage: "igcse"`
 * because Cambridge does not split the IGCSE syllabus by year, so every class
 * number resolves to the one stage.
 */
function stageKey(board, cls) {
  const single = load(board)?.singleStage
  return single || cls
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
  const want = stageKey(board, cls)
  const key = `${board}:${want ?? '*'}`
  if (flatCache.has(key)) return flatCache.get(key)

  const data = load(board)
  const out = []
  if (data) {
    for (const [c, subjects] of Object.entries(data.classes)) {
      if (want && String(c) !== String(want)) continue
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

/* ── Phase A.2/A.3: chapter provenance ─────────────────────────────────────
   Every answer, quiz, card and mistake has to be able to say which chapter it
   came from. resolveTopic() already returns the chapter; these turn that into
   a citation and attach the exam weightage the optimiser needs.            */

let _weightage = null

function loadWeightage(board = 'cbse') {
  if (_weightage) return _weightage
  try {
    _weightage = JSON.parse(readFileSync(join(DATA_DIR, `weightage.${board}.json`), 'utf8'))
  } catch (e) {
    // Only CBSE has verified numbers. A board without a weightage file must
    // degrade to "unknown marks", never to a guess -- a wrong mark total makes
    // every "+22 marks" projection wrong.
    console.warn(`[syllabus] no weightage for board "${board}":`, e.message)
    _weightage = { chapters: {}, papers: {} }
  }
  return _weightage
}

/**
 * "Class 10 Science · Electricity" — the reference that opens a grounded
 * answer. Returns null rather than a partial string when the topic does not
 * resolve, so a caller never prints a half-citation.
 */
export function chapterRef(topicIdOrText, board = 'cbse', cls) {
  const t = resolveTopic(topicIdOrText, board, cls)
  if (!t) return null
  const c = t.topicId.split('.')[1]
  return { label: `Class ${c} ${t.subject} · ${t.chapter}`, class: c, subject: t.subject, chapter: t.chapter, topicId: t.topicId }
}

/**
 * Marks and difficulty for whichever chapter a topic belongs to.
 * `marks: null` means "not published for this board yet" and must be rendered
 * as unknown, not as zero — zero would make the optimiser tell a student to
 * skip a chapter that might be worth 8 marks.
 */
export function weightageFor(topicIdOrText, board = 'cbse', cls) {
  const ref = chapterRef(topicIdOrText, board, cls)
  if (!ref) return null
  const w = loadWeightage(board)
  const paper = `${ref.class}.${ref.subject}`
  const entry = w.chapters?.[paper]?.[ref.chapter]
  return {
    ...ref,
    marks: entry?.marks ?? null,
    difficulty: entry?.difficulty ?? null,
    unit: entry?.unit ?? null,
    paperTotal: w.papers?.[paper]?.theoryMarks ?? null,
  }
}
