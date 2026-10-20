/**
 * A number that goes up whenever the flashcard deck changes, for use in
 * useMemo / useEffect deps.
 *
 * WHY THIS EXISTS. Dashboard keeps pages mounted after their first visit and
 * hides them with display:none. Practice, Flashcards, Reels, Listen, Notes,
 * Progress and Today's 3 each read listFlashcards() once into a memo - so a
 * card made in the Reader, Doubt Solving or the Solver landed in the store
 * and then never appeared on a page that had already been opened. "I clicked
 * create and nothing came" was the cards existing and every screen showing a
 * stale copy until the app was reloaded.
 *
 * Bumps on:
 *   - kyno:flashcards-changed, which twin.ts fires when THIS tab adds or
 *     reviews a card (coalesced, so adding five cards is one bump);
 *   - a storage event on the twin key: another tab, or a cloud sync landing.
 *
 * `ignoreReviews` is for screens that show the deck in an order the student
 * is moving through (Reels, Listen): reviewing a card there must not rebuild
 * the deck under their thumb. They still pick up newly added cards.
 */
import { useEffect, useState } from 'react'
import { FLASHCARDS_CHANGED } from './twin'

export function useFlashcardsVersion(opts: { ignoreReviews?: boolean } = {}): number {
  const [version, setVersion] = useState(0)
  const ignoreReviews = !!opts.ignoreReviews

  useEffect(() => {
    const onChange = (e: Event) => {
      const kinds: string[] = (e as CustomEvent).detail?.kinds ?? []
      if (ignoreReviews && kinds.length > 0 && kinds.every(k => k === 'reviewed')) return
      setVersion(v => v + 1)
    }
    const onStorage = (e: StorageEvent) => {
      if (!e.key || e.key.startsWith('kyno:twin:')) setVersion(v => v + 1)
    }
    window.addEventListener(FLASHCARDS_CHANGED, onChange)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener(FLASHCARDS_CHANGED, onChange)
      window.removeEventListener('storage', onStorage)
    }
  }, [ignoreReviews])

  return version
}
