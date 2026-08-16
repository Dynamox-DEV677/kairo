/**
 * C17 — prerequisite check before a new topic.
 *
 * The dependency structure is NOT invented: within a subject, the syllabus
 * maps already order chapters the way the board teaches them (the JSON keeps
 * the official chapter order), and a chapter's prerequisites are the chapters
 * before it. That is how the books are sequenced — Gravitation follows Motion
 * and Force because it uses them. No fabricated knowledge graph.
 *
 * Weakness is real too: it comes from the student's own mastery rows, matched
 * by the same token-overlap used everywhere else. No mastery data on a
 * prerequisite means "unknown", which is NOT treated as weak — gating a
 * student on chapters the app has simply never seen them do would nag every
 * new user on every topic.
 */

import { similarity } from './bridge.core.js'

/** Mastery below this on a prerequisite chapter triggers the refresher offer. */
export const WEAK_BAR = 0.5

/** Only the nearest few prior chapters count — chapter 1 is not usefully a
 *  "prerequisite" of chapter 12, and a long list dilutes the one that matters. */
export const LOOKBACK = 3

/**
 * The chapters that come before the one containing `topicText`, nearest first.
 *
 * `lookup(board, cls)` is the injected allTopics (client or server build), the
 * same pattern bridge.core uses so this file stays dependency-free.
 */
export function prerequisitesFor(topicText, { board, cls, lookup }) {
  if (!board || !lookup) return []
  const pool = lookup(board, cls) || []
  if (!pool.length) return []

  // Locate the topic's chapter by best name overlap.
  let best = null, bestScore = 0
  for (const t of pool) {
    const s = Math.max(similarity(topicText, t.name), similarity(topicText, t.chapter))
    if (s > bestScore) { bestScore = s; best = t }
  }
  if (!best || bestScore < 0.6) return [] // can't place the topic -> no gate, honestly

  // Chapter order within that subject, as the syllabus lists it.
  const chapters = []
  for (const t of pool) {
    if (t.subject !== best.subject) continue
    if (!chapters.includes(t.chapter)) chapters.push(t.chapter)
  }
  const at = chapters.indexOf(best.chapter)
  if (at <= 0) return [] // first chapter has no prerequisites

  return chapters.slice(Math.max(0, at - LOOKBACK), at).reverse() // nearest first
}

/**
 * Should this student see a refresher offer before starting `topicText`?
 *
 * Returns null (no gate) unless a prerequisite chapter has REAL mastery
 * evidence below the bar. The offer names the chapter and the evidence, so it
 * reads as help, not as a lock — the student can always continue anyway.
 */
export function prereqGate(topicText, { board, cls, lookup, mastery = [] }) {
  const prereqs = prerequisitesFor(topicText, { board, cls, lookup })
  if (!prereqs.length) return null

  for (const chapter of prereqs) {
    let worst = null
    for (const row of mastery) {
      if (!row || typeof row.mastery !== 'number') continue
      const s = Math.max(similarity(chapter, row.topic || ''), similarity(chapter, row.chapter || ''))
      if (s >= 0.6 && row.mastery < WEAK_BAR) {
        if (!worst || row.mastery < worst.mastery) worst = row
      }
    }
    if (worst) {
      return {
        chapter,
        evidence: worst,
        message: `${chapter} comes right before this in your syllabus, and your last attempts there were still climbing (${Math.round(worst.mastery * 100)}%). A ten-minute brush-up first usually makes the new topic land easier.`,
      }
    }
  }
  return null
}
