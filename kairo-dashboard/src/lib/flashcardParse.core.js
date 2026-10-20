/**
 * Reading the cards a model generated, whatever shape they came back in.
 *
 * The Flashcards page asked for "ONLY the JSON array" and parsed exactly that.
 * Models often answer {"cards": [...]} instead - and in JSON mode they must,
 * because json_object cannot be a bare array - so the parse produced an
 * object, `.filter` threw, and the student saw an error after waiting for a
 * perfectly good answer. A single backslash in LaTeX (\sqrt) is also invalid
 * JSON and failed the same way.
 *
 * Accepts an array, {cards}, {flashcards}, fenced or with prose around it,
 * repairs lone backslashes, then repairs LaTeX that JSON escapes mangled
 * (\f in \frac becoming a form feed) on every front and back.
 */
import { repairLatex } from './bookStudio.core.js'

const MAX_CARDS = 20

function tryParse(s) {
  try { return JSON.parse(s) } catch { /* try the next shape */ }
  // A backslash JSON does not know (\s, \q, \l...) is LaTeX, not an escape.
  try { return JSON.parse(s.replace(/\\(?!["\\/bfnrtu])/g, '\\\\')) } catch { return null }
}

export function readGeneratedCards(raw) {
  const text = String(raw ?? '').replace(/```(?:json)?/gi, '').trim()
  if (!text) return []

  let value = tryParse(text)
  if (value == null) {
    // Prose around it: try the outermost object, then the outermost array.
    for (const [open, close] of [['{', '}'], ['[', ']']]) {
      const a = text.indexOf(open)
      const b = text.lastIndexOf(close)
      if (a >= 0 && b > a) {
        value = tryParse(text.slice(a, b + 1))
        if (value != null) break
      }
    }
  }

  const list = Array.isArray(value) ? value
    : Array.isArray(value?.cards) ? value.cards
    : Array.isArray(value?.flashcards) ? value.flashcards
    : []

  const clean = (s) => repairLatex(String(s)).replace(/\s+/g, ' ').trim()
  return list
    .filter(c => c && typeof c.front === 'string' && typeof c.back === 'string')
    .map(c => ({ front: clean(c.front), back: clean(c.back) }))
    .filter(c => c.front && c.back)
    .slice(0, MAX_CARDS)
}
