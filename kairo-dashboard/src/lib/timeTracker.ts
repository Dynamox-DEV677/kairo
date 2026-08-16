import { readStore, credit } from './time.core'
import { getRaw, setRaw, get as getKey } from './storage'

/**
 * C24, browser side — attributes real elapsed time to the (subject, topic) the
 * student is actually looking at.
 *
 * Honesty rules, enforced here rather than hoped for:
 * - Time only counts while the tab is visible. Backgrounding pauses the clock.
 * - One credit is clamped in time.core.js, so a parked tab cannot bank hours.
 * - Only screens that KNOW their topic call this. No guessing an attribution.
 */

function storeKey(): string {
  const uid = getKey<string>('lastUid') || 'local'
  return `kyno:time:${uid}`
}

function save(subject: string | null | undefined, topic: string | null | undefined, ms: number) {
  try {
    const next = credit(readStore(getRaw(storeKey())), { subject, topic, ms, ts: Date.now() })
    setRaw(storeKey(), JSON.stringify(next))
  } catch { /* private mode / quota — tracking must never break study */ }
}

/** One-shot credit for a completed activity of known length (e.g. a drill). */
export function creditTime(subject: string | null | undefined, topic: string | null | undefined, ms: number) {
  save(subject, topic, ms)
}

export interface TopicClock { switch(subject: string | null, topic: string | null): void; stop(): void }

/**
 * A running clock for view-based screens (Reels, Solver answers): call
 * switch() whenever the visible topic changes, stop() on unmount. Elapsed
 * visible time is credited to the topic that was on screen.
 */
export function startTopicClock(): TopicClock {
  let cur: { subject: string | null; topic: string | null } | null = null
  let since = Date.now()
  let hiddenAt: number | null = document.visibilityState === 'hidden' ? Date.now() : null
  let hiddenTotal = 0

  const onVis = () => {
    if (document.visibilityState === 'hidden') hiddenAt = Date.now()
    else if (hiddenAt != null) { hiddenTotal += Date.now() - hiddenAt; hiddenAt = null }
  }
  document.addEventListener('visibilitychange', onVis)

  const flush = () => {
    if (!cur) return
    const hidden = hiddenTotal + (hiddenAt != null ? Date.now() - hiddenAt : 0)
    const visibleMs = Date.now() - since - hidden
    save(cur.subject, cur.topic, visibleMs)
  }

  return {
    switch(subject, topic) {
      flush()
      cur = { subject, topic }
      since = Date.now()
      hiddenTotal = 0
      hiddenAt = document.visibilityState === 'hidden' ? Date.now() : null
    },
    stop() {
      flush()
      cur = null
      document.removeEventListener('visibilitychange', onVis)
    },
  }
}

export function readTimeStore() {
  return readStore(getRaw(storeKey()))
}
