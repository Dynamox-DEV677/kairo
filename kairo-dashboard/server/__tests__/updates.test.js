/**
 * "Kyno Update N" — acceptance.
 *
 * The one that matters is "missed several, sees all of them". The obvious
 * implementation (set lastSeen = latest on every login) passes every other case
 * and silently swallows the middle updates, so it gets its own test with two
 * sequential entries, exactly as the brief asks.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  latestUpdateNumber, readLastSeen, pendingUpdates, seenAfterDismiss, validateUpdates,
} from '../../src/lib/updates.core.js'

/** Two sequential fake entries — the "missed both" scenario from the brief. */
const FAKE = [
  { n: 1, title: 'Kyno Update 1', date: '2026-08-01', changes: ['Thing one shipped'] },
  { n: 2, title: 'Kyno Update 2', date: '2026-08-09', changes: ['Thing two shipped', 'And a fix'] },
]

test('a student who has never seen an update sees every entry', () => {
  const shown = pendingUpdates(FAKE, null)
  assert.equal(shown.length, 2)
  assert.deepEqual(shown.map(u => u.n), [1, 2])
})

test('a student who missed two updates in a row sees BOTH, not just the newest', () => {
  // lastSeen 0 => behind by two. This is the regression the feature exists for.
  const shown = pendingUpdates(FAKE, '0')
  assert.deepEqual(shown.map(u => u.title), ['Kyno Update 1', 'Kyno Update 2'])
})

test('a student who is caught up sees nothing', () => {
  assert.deepEqual(pendingUpdates(FAKE, '2'), [])
  assert.deepEqual(pendingUpdates(FAKE, 2), [])
})

test('a student behind by one sees only the one they missed', () => {
  const shown = pendingUpdates(FAKE, '1')
  assert.deepEqual(shown.map(u => u.n), [2])
})

test('dismissing marks everything shown as seen, so it does not reappear', () => {
  const shown = pendingUpdates(FAKE, null)
  const after = seenAfterDismiss(shown, null)
  assert.equal(after, 2)
  // Second login, same data file: nothing pending.
  assert.deepEqual(pendingUpdates(FAKE, after), [])
})

test('a new entry after dismissal shows up, and only that entry', () => {
  const after = seenAfterDismiss(pendingUpdates(FAKE, null), null)
  const withThird = [...FAKE, { n: 3, title: 'Kyno Update 3', date: '2026-08-15', changes: ['Thing three'] }]
  const shown = pendingUpdates(withThird, after)
  assert.deepEqual(shown.map(u => u.n), [3])
})

test('updates render oldest first, whatever order the data file is in', () => {
  const jumbled = [FAKE[1], FAKE[0]]
  assert.deepEqual(pendingUpdates(jumbled, 0).map(u => u.n), [1, 2])
})

test('dismiss never moves lastSeen backwards', () => {
  // Two tabs: the stale one renders update 1 only, then dismisses after the
  // fresh one already recorded 2. It must not un-see update 2.
  assert.equal(seenAfterDismiss([FAKE[0]], 2), 2)
})

test('garbage in storage means "has seen nothing", never "has seen everything"', () => {
  for (const junk of [null, undefined, '', 'undefined', 'NaN', '-3', {}, [], 'abc']) {
    assert.equal(readLastSeen(junk), 0, `readLastSeen(${JSON.stringify(junk)})`)
    assert.equal(pendingUpdates(FAKE, junk).length, 2, `pendingUpdates with ${JSON.stringify(junk)}`)
  }
})

test('an empty update list shows nothing and does not throw', () => {
  assert.deepEqual(pendingUpdates([], null), [])
  assert.equal(latestUpdateNumber([]), 0)
  assert.deepEqual(validateUpdates([]), [])
})

test('validateUpdates catches the mistakes a future release note could make', () => {
  assert.deepEqual(validateUpdates(FAKE), [], 'the fake fixture is well formed')

  const dup = [FAKE[0], { ...FAKE[1], n: 1 }]
  assert.ok(validateUpdates(dup).some(p => /duplicate/.test(p)))

  const gap = [FAKE[0], { ...FAKE[1], n: 3 }]
  assert.ok(validateUpdates(gap).some(p => /no gaps/.test(p)))

  const noChanges = [{ ...FAKE[0], changes: [] }]
  assert.ok(validateUpdates(noChanges).some(p => /lists no changes/.test(p)))

  const badDate = [{ ...FAKE[0], date: '15 Aug 2026' }]
  assert.ok(validateUpdates(badDate).some(p => /ISO date/.test(p)))

  const zeroth = [{ ...FAKE[0], n: 0 }]
  assert.ok(validateUpdates(zeroth).length > 0)
})

test('the REAL updates file obeys the process rule', async () => {
  // Guards the actual shipping content, so a hand-edited release note that
  // renumbers, duplicates or skips an entry fails here rather than on a
  // student's device. This is why the data is .json and not inline .ts.
  const { default: UPDATES } = await import('../../src/data/updates.json', { with: { type: 'json' } })

  assert.deepEqual(validateUpdates(UPDATES), [])
  assert.ok(UPDATES.length > 0, 'ship at least one update entry')

  // No placeholder text. The brief's "no fabricated content" rule, enforced.
  for (const u of UPDATES) {
    for (const c of u.changes) {
      assert.ok(!/lorem|tbd|placeholder|coming soon|todo/i.test(c), `placeholder text in ${u.title}: "${c}"`)
      assert.ok(c.trim().length > 15, `change line too short to be real in ${u.title}: "${c}"`)
    }
  }
})
