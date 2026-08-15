/**
 * "Kyno Update N" — deciding what a student still needs to be shown.
 *
 * Plain .js with a sibling .d.ts so server/__tests__ can import the real
 * implementation rather than a copy that drifts. Same pattern as
 * selectors.core.js.
 *
 * The rule that matters: a student who skipped four days must see all four
 * updates, not just the newest one. Overwriting lastSeen with "the latest" on
 * every login is the obvious implementation and it silently loses the ones in
 * between, which is exactly the failure this feature exists to avoid.
 */

/** Highest update number in a list. 0 for an empty list — never null, so the
 *  caller can compare with < without a special case. */
export function latestUpdateNumber(entries) {
  if (!Array.isArray(entries) || entries.length === 0) return 0
  return entries.reduce((max, e) => (Number(e?.n) > max ? Number(e.n) : max), 0)
}

/**
 * Whatever came out of storage, turned into a number we can compare.
 *
 * localStorage hands back strings, and a device that has been through a few
 * builds can hand back null, "undefined", or something a user typed into
 * devtools. Anything we cannot read as a non-negative integer means "has seen
 * nothing" — showing an update twice is a small annoyance, skipping one is the
 * bug we care about.
 */
export function readLastSeen(raw) {
  const n = typeof raw === 'number' ? raw : parseInt(String(raw ?? ''), 10)
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.floor(n)
}

/**
 * Every update the student has not seen, oldest first.
 *
 * Oldest first because the modal reads top to bottom as a history: "here is
 * what you missed, in order". Newest-first would put the oldest change at the
 * bottom of a scroll the student may never reach.
 */
export function pendingUpdates(entries, lastSeenRaw) {
  const lastSeen = readLastSeen(lastSeenRaw)
  if (!Array.isArray(entries)) return []
  return entries
    .filter(e => Number.isFinite(Number(e?.n)) && Number(e.n) > lastSeen)
    .slice()
    .sort((a, b) => Number(a.n) - Number(b.n))
}

/**
 * What to write back on dismiss: the highest number actually shown.
 *
 * Deliberately NOT latestUpdateNumber(allEntries). If the data file gains an
 * entry between render and dismiss — a deploy mid-session — writing the file's
 * max would mark an update seen that was never on screen.
 */
export function seenAfterDismiss(shown, currentLastSeen) {
  const highestShown = latestUpdateNumber(shown)
  const current = readLastSeen(currentLastSeen)
  // Never move backwards: two tabs open, the stale one dismissing last.
  return Math.max(highestShown, current)
}

/**
 * Guards the process rule in ../data/updates.ts, so a malformed entry fails a
 * test run instead of quietly showing a student a blank card.
 *
 * Returns a list of human-readable problems; empty means the file is sound.
 */
export function validateUpdates(entries) {
  const problems = []
  if (!Array.isArray(entries)) return ['updates must be an array']
  if (entries.length === 0) return problems

  const seen = new Set()
  for (const e of entries) {
    const n = Number(e?.n)
    if (!Number.isInteger(n) || n < 1) { problems.push(`entry has a non-positive-integer n: ${JSON.stringify(e?.n)}`); continue }
    if (seen.has(n)) problems.push(`duplicate update number ${n}`)
    seen.add(n)
    if (!e.title || typeof e.title !== 'string') problems.push(`update ${n} has no title`)
    if (!e.date || !/^\d{4}-\d{2}-\d{2}$/.test(e.date)) problems.push(`update ${n} needs an ISO date (YYYY-MM-DD)`)
    if (!Array.isArray(e.changes) || e.changes.length === 0) problems.push(`update ${n} lists no changes`)
    else if (e.changes.some(c => typeof c !== 'string' || !c.trim())) problems.push(`update ${n} has an empty change line`)
  }

  // Sequential from 1, no gaps. A gap means someone renumbered by hand, and a
  // student sitting on lastSeen inside the gap would be shown the wrong set.
  const nums = [...seen].sort((a, b) => a - b)
  nums.forEach((n, i) => { if (n !== i + 1) problems.push(`update numbers must run 1..N with no gaps — found ${n} at position ${i + 1}`) })

  return problems
}
