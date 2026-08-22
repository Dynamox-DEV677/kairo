/**
 * Starter decks — which decks a student is offered, and how a deck becomes
 * flashcards without creating duplicates. Pure + testable; the data is in
 * src/data/starterDecks.ts, the wiring is in RevisionReels.tsx.
 */

/** Decks that suit this student's board (and class, when a deck pins one). */
export function decksForCurriculum(decks, { board, cls } = {}) {
  const b = String(board || '').toLowerCase()
  const boardKey = b.includes('cambridge') || b.includes('igcse') ? 'cambridge'
    : b.includes('ib') || b.includes('baccalaureate') ? 'ib'
    : b.includes('icse') || b.includes('cisce') ? 'icse'
    : (b.includes('cbse') || b.includes('ncert') || b.includes('state') || b.includes('board')) ? 'ncert'
    : 'generic'
  const classNo = String(cls ?? '').match(/\d{1,2}/)?.[0] || null

  return (decks || []).filter(d => {
    const boardOk = d.boards.includes('*') || d.boards.includes(boardKey)
    const classOk = !d.classes?.length || (classNo && d.classes.includes(classNo))
    return boardOk && classOk
  })
}

/** How a card is matched for dedupe — normalised front within a subject. */
export function cardKey(subject, front) {
  return `${String(subject || '').toLowerCase()}|${String(front || '').trim().toLowerCase().replace(/\s+/g, ' ')}`
}

/**
 * The flashcard payloads to write for a deck, skipping any whose front already
 * exists in the student's cards. Returns [] if the whole deck is already added,
 * so "Add" is idempotent — tapping twice never doubles the deck.
 */
export function newCardsForDeck(deck, existingFlashcards = []) {
  const have = new Set(
    (existingFlashcards || []).map(f => cardKey(f.subject || deck.subject, f.front)),
  )
  // The reel card header already prints "{subject} · {topic}", and the deck
  // title starts with the subject ("Physics · Units & constants"), so use the
  // part AFTER the "· " as the topic — otherwise the header doubles the subject
  // ("Physics · Physics · Units & constants").
  const topic = deck.title.includes('·') ? deck.title.split('·').slice(1).join('·').trim() : deck.title
  return (deck.cards || [])
    .filter(c => !have.has(cardKey(deck.subject, c.front)))
    .map(c => ({
      front: c.front,
      back: c.back,
      subject: deck.subject,
      topic,
      source: 'starter',
    }))
}

/** True once every card of a deck is already in the student's collection. */
export function deckAlreadyAdded(deck, existingFlashcards = []) {
  return newCardsForDeck(deck, existingFlashcards).length === 0
}

/** How many of a deck's cards the student still doesn't have. */
export function deckRemainingCount(deck, existingFlashcards = []) {
  return newCardsForDeck(deck, existingFlashcards).length
}
