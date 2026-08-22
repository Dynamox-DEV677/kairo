/**
 * B4 — diagram labelling recall (the "image occlusion" gap from the competitor
 * check, done honestly).
 *
 * A vision model cannot give reliable pixel boxes for each label, so we do NOT
 * fake Anki-style occlusion over the image. Instead the model identifies the
 * diagram and lists its parts as {label, clue}; the student recalls each label
 * from its clue, then reveals — real active recall, and the parts can be saved
 * as flashcards so they flow into Reels + spaced repetition.
 *
 * This file is the pure parse + honesty gate: a low-confidence or thin result
 * becomes an honest "couldn't identify it" rather than a guessed diagram.
 */

export const MIN_PARTS = 2

/**
 * Turn the model's raw text into either a usable recall set or an honest miss.
 * Expects a JSON object: { diagramType, confidence: 'high'|'low', parts:[{label, clue}] }.
 */
export function parseDiagramResponse(raw) {
  const text = typeof raw === 'string' ? raw : ''
  const m = text.match(/\{[\s\S]*\}/)
  if (!m) return { ok: false, reason: 'unreadable' }

  let obj
  try { obj = JSON.parse(m[0]) } catch { return { ok: false, reason: 'unreadable' } }

  const diagramType = typeof obj.diagramType === 'string' ? obj.diagramType.trim() : ''
  const parts = Array.isArray(obj.parts)
    ? obj.parts
        .filter(p => p && typeof p.label === 'string' && p.label.trim())
        .map(p => ({ label: p.label.trim(), clue: (typeof p.clue === 'string' ? p.clue : '').trim() }))
    : []

  // Honesty gate: the model must be confident AND give enough parts to be a
  // real exercise. Anything weaker is a miss, not a guessed diagram.
  if (obj.confidence !== 'high' || !diagramType || parts.length < MIN_PARTS) {
    return { ok: false, reason: 'low-confidence', diagramType: diagramType || null }
  }

  return { ok: true, diagramType, parts }
}

/** Flashcards for the recalled parts, so they join Reels + SRS. */
export function cardsFromDiagram(diagramType, parts) {
  return (parts || []).map(p => ({
    front: p.clue
      ? `In a ${diagramType}, which part: ${p.clue}?`
      : `Name this part of a ${diagramType}.`,
    back: p.label,
    subject: null,
    topic: diagramType,
  }))
}
