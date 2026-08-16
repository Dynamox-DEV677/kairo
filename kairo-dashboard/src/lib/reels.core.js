/**
 * Revision Reels — the deck, and where the student left off.
 *
 * The deck is built from data the app ALREADY owns: the student's collected
 * formulas and their flashcards (both live in the twin store, the same source
 * the Formula Sheet and Flashcards pages read). Nothing is generated and no
 * second card database exists — a reel card IS a formula or flashcard record,
 * so a doubt exported with recordFlashcard() appears here with no extra wiring.
 *
 * Pure .js + .d.ts so node --test exercises the real module. Same pattern as
 * selectors.core.js.
 */

/** One swipeable card, whichever record it came from. */
export function buildDeck({ formulas = [], flashcards = [] } = {}, opts = {}) {
  const now = opts.now ?? 0 // caller passes Date.now(); 0 keeps tests deterministic
  const cards = []

  for (const f of Array.isArray(formulas) ? formulas : []) {
    if (!f || !f.expr) continue
    cards.push({
      id: `f:${f.id}`,
      kind: 'formula',
      subject: f.subject || 'General',
      topic: f.topic || null,
      front: f.name || 'Formula',
      back: f.expr,
      // Rearrangements ride along on the one card — never as separate cards.
      // That is the A2 rule (one Ohm's Law, not three) applied here too.
      variants: Array.isArray(f.variants) ? f.variants : [],
      ts: f.ts || 0,
      due: false,
    })
  }

  for (const c of Array.isArray(flashcards) ? flashcards : []) {
    if (!c || !c.front) continue
    cards.push({
      id: `c:${c.id}`,
      kind: 'flashcard',
      subject: c.subject || 'General',
      topic: c.topic || null,
      front: c.front,
      back: c.back || '',
      variants: [],
      ts: c.ts || 0,
      // SM-2 says this card is at risk of being forgotten. Those surface first,
      // because "what should I look at" is the whole point of a reel.
      due: typeof c.dueAt === 'number' && c.dueAt <= now,
    })
  }

  // Due cards first, then newest first — a stable, explainable order. Random
  // shuffle would defeat resume: "card 14 of 60" must mean the same card
  // tomorrow, or the saved position is a lie.
  cards.sort((a, b) => (Number(b.due) - Number(a.due)) || (b.ts - a.ts))
  return cards
}

/** The subjects present in a deck, biggest first — the filter chips. */
export function deckSubjects(deck) {
  const counts = new Map()
  for (const c of deck || []) counts.set(c.subject, (counts.get(c.subject) || 0) + 1)
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([subject, count]) => ({ subject, count }))
}

/* ── Resume position ──────────────────────────────────────────────────────
 *
 * Stored per subject as { [subject]: cardId }. The CARD ID, not the index:
 * the deck grows at the front (newest first), so a saved index would silently
 * shift to a different card every time anything new was added.
 */

export function readPositions(raw) {
  try {
    const v = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (v && typeof v === 'object' && !Array.isArray(v)) return v
  } catch { /* corrupt -> start fresh */ }
  return {}
}

export function positionFor(deck, positions, subject) {
  const id = positions?.[subject || 'all']
  if (!id) return 0
  const i = (deck || []).findIndex(c => c.id === id)
  // Card deleted since last visit => start from the top rather than erroring.
  return i >= 0 ? i : 0
}

export function withPosition(positions, subject, cardId) {
  return { ...(positions || {}), [subject || 'all']: cardId }
}
