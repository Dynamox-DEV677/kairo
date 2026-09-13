/**
 * Two things the app kept getting wrong in interpolated strings.
 *
 * Both are the kind of bug that never breaks a build and is visible in every
 * screenshot: "Acids And Bases", and "lost to these 1".
 */

/**
 * Title case that knows English.
 *
 * CSS `text-transform: capitalize` capitalises EVERY word, so a stored topic
 * "acids and bases" rendered "Acids And Bases". It also cannot be fixed by
 * styling alone -- the rule has no idea what a conjunction is.
 *
 * First and last word are always capitalised, because "The Rise And Fall of"
 * is wrong in the other direction.
 */
const SMALL = new Set([
  'a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'from', 'in', 'into',
  'nor', 'of', 'on', 'onto', 'or', 'over', 'per', 'the', 'to', 'up', 'via',
  'vs', 'with', 'within', 'without',
])

export function titleCase(input) {
  const raw = String(input ?? '').trim()
  if (!raw) return ''
  const words = raw.split(/\s+/)
  return words
    .map((w, i) => {
      const lower = w.toLowerCase()
      // Leave anything with inner capitals alone: pH, DNA, mRNA, CBSE.
      if (/[A-Z]/.test(w.slice(1))) return w
      if (i !== 0 && i !== words.length - 1 && SMALL.has(lower)) return lower
      return lower.charAt(0).toUpperCase() + lower.slice(1)
    })
    .join(' ')
}

/**
 * "1 mark", "4 marks", and never "1 marks".
 *
 * Takes the singular and adds -s, with an explicit plural for the words that
 * do not follow that rule. Returning the COUNT with the noun keeps the two
 * from drifting apart at the call site, which is how "these 1" happened.
 */
export function plural(n, singular, pluralForm) {
  const count = Number(n) || 0
  const word = Math.abs(count) === 1 ? singular : (pluralForm || singular + 's')
  return `${count} ${word}`
}

/** The noun alone, when the number is already on screen in a bigger font. */
export function pluralWord(n, singular, pluralForm) {
  return Math.abs(Number(n) || 0) === 1 ? singular : (pluralForm || singular + 's')
}
