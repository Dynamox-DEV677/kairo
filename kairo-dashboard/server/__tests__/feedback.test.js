/**
 * Tester feedback — and the two privacy promises around it.
 *
 * What these pin: only a known category and a sensible length are accepted;
 * nothing but three coarse device facts ever travels (the server re-cleans
 * whatever a client sends); the table is insert-own with no way for one
 * student to read another's words; and Delete account / Download my data
 * both cover it. Plus the Demo Mode guard: sample data only ever goes into an
 * empty account, because it appends to real history.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { FEEDBACK_CATEGORIES, normalizeFeedback, deviceSummary, MESSAGE_MAX } from '../../src/lib/feedback.core.js'

const ROOT = join(import.meta.dirname, '..', '..')
const read = (...p) => readFileSync(join(ROOT, ...p), 'utf-8')

test('a normal report is accepted and trimmed', () => {
  const r = normalizeFeedback({ category: 'bug', message: '  The timer froze on Q3\r\n', screen: 'practice', appVersion: '1.0.4' })
  assert.equal(r.ok, true)
  assert.equal(r.value.message, 'The timer froze on Q3')
  assert.equal(r.value.screen, 'practice')
  assert.equal(r.value.appVersion, '1.0.4')
})

test('every category the sheet offers is accepted; anything else is refused', () => {
  for (const c of FEEDBACK_CATEGORIES) assert.equal(normalizeFeedback({ category: c.id, message: 'okay then' }).ok, true)
  assert.equal(normalizeFeedback({ category: 'rant', message: 'okay then' }).ok, false)
  assert.equal(normalizeFeedback({ message: 'no category' }).ok, false)
})

test('too short or too long is refused with a reason a student can act on', () => {
  const short = normalizeFeedback({ category: 'idea', message: ' a ' })
  assert.equal(short.ok, false)
  assert.match(short.error, /more/)
  const long = normalizeFeedback({ category: 'idea', message: 'x'.repeat(MESSAGE_MAX + 1) })
  assert.equal(long.ok, false)
  assert.equal(normalizeFeedback({ category: 'idea', message: 'x'.repeat(MESSAGE_MAX) }).ok, true)
})

test('an unknown screen becomes "other" — never free text into the table', () => {
  assert.equal(normalizeFeedback({ category: 'bug', message: 'broken here', screen: '<script>' }).value.screen, 'other')
})

test('only three coarse device facts survive, whatever a client sends', () => {
  const d = deviceSummary({ platform: 'android', width: 390.4, height: 844, online: true, userAgent: 'Mozilla/…', email: 'kid@example.com' })
  assert.deepEqual(d, { platform: 'android', viewport: '390x844', online: true })
  assert.equal(deviceSummary({ platform: 'hacker-os' }).platform, 'web')
  assert.equal(deviceSummary({}).viewport, null)
  const viaNormalize = normalizeFeedback({ category: 'bug', message: 'broken here', device: { platform: 'ios', width: 1, height: 1, secret: 'x' } })
  assert.deepEqual(Object.keys(viaNormalize.value.device).sort(), ['online', 'platform', 'viewport'])
})

test('the table is insert-own only: RLS on, and no student can read another student\'s words', () => {
  const sql = read('server', 'db', '2026-09-26_tester_feedback.sql')
  assert.match(sql, /enable row level security/i)
  assert.match(sql, /for insert[\s\S]*with check \(auth\.uid\(\) = user_id\)/i)
  assert.doesNotMatch(sql, /for\s+(select|update|delete|all)\b/i)
})

test('Delete account and Download my data both cover the feedback table', () => {
  assert.match(read('server', 'routes', 'account.js'), /\['tester_feedback', 'user_id'\]/)
})

test('the route is mounted and demands a signed-in student', () => {
  assert.match(read('server', 'app.js'), /app\.use\('\/api\/feedback',\s*feedbackRoutes\)/)
  assert.match(read('server', 'routes', 'feedback.js'), /router\.use\(requireSupabaseAuth\)/)
})

test('the app never claims "sent" unless the server says it was stored', () => {
  const profile = read('src', 'pages', 'Profile.tsx')
  assert.match(profile, /if \(r\?\.stored\)/)
})

test('Demo Mode only ever fills an EMPTY account', () => {
  const lib = read('src', 'lib', 'demoMode.ts')
  assert.match(lib, /export function loadDemo\(\)[\s\S]*if \(!demoAvailable\(\)\) throw/)
  assert.match(lib, /events \|\| \[\]\)\.length === 0/)
  // every place that offers it asks the same question first
  assert.match(read('src', 'pages', 'Performance.tsx'), /demoAvailable\(\) &&/)
  assert.match(read('src', 'components', 'DemoModePrompt.tsx'), /if \(!demoAvailable\(\)\) return/)
})
