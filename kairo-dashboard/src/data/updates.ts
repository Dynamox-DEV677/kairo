import type { UpdateEntry } from '../lib/updates.core'
import raw from './updates.json'

/**
 * THE update list. Content lives in ./updates.json and nowhere else.
 *
 * JSON rather than inline TS for one reason: server/__tests__/updates.test.js
 * can import the actual shipping file and validate it. A .ts data file is
 * invisible to `node --test`, so the test that guards the process rule below
 * would have silently passed on nothing.
 *
 * ── Process rule, when you ship ──────────────────────────────────────────────
 * 1. Add exactly ONE entry per shipped batch, with the next `n`. Never renumber
 *    an existing entry: `n` is what students' devices have stored as "seen", so
 *    changing it either re-shows an old update or silently swallows a new one.
 * 2. Only list things a student would NOTICE using the app. A refactor, a test,
 *    a migration, a dependency bump — none of those go here. If you cannot
 *    finish the sentence "you'll see..." then it does not belong.
 * 3. Write it in the student's words, not the commit's. "Your streak survives
 *    one missed day a week", not "streak freeze token accrual".
 * 4. Never write an entry for work that has not actually shipped. The whole
 *    value of this list is that it is true.
 *
 * The test enforces the shape: sequential from 1, no gaps, no duplicates, ISO
 * dates, and at least one non-empty change line per entry.
 */
export const UPDATES: UpdateEntry[] = raw as UpdateEntry[]

export default UPDATES
