/**
 * The QA findings that were about honesty rather than layout.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(import.meta.dirname, '..', '..')
const read = (...p) => readFileSync(join(ROOT, ...p), 'utf-8')

test('telemetry is OFF until a student turns it on', () => {
  const usage = read('src', 'lib', 'usage.ts')
  const fn = usage.slice(usage.indexOf('export function telemetryEnabled'), usage.indexOf('export function setTelemetryEnabled'))
  assert.match(fn, /=== '1'/, 'opt-IN: behavioural telemetry on minors cannot default on')
  assert.match(fn, /catch \{ return false \}/, 'and it fails closed')
  const profile = read('src', 'pages', 'Profile.tsx')
  assert.match(profile, /The screen name and the time, never what you typed/, 'the copy says what is sent')
})

test('no page invents a school for a student who has none', () => {
  for (const f of ['AdaptiveQuiz', 'ExamHall', 'FormulaSheet', 'ConceptTools', 'WritingTools', 'Gamification']) {
    const src = read('src', 'pages', f + '.tsx')
    assert.doesNotMatch(src, /const SCHOOL_ID = 'demo_school'/, f + ' still sends a fabricated school id')
  }
  const helper = read('src', 'lib', 'schoolId.ts')
  assert.match(helper, /!== 'demo_school'/, 'and the helper refuses the demo id outright')
})

test('quitting a session does not pay for finishing it', () => {
  const p = read('src', 'pages', 'Practice.tsx')
  assert.match(p, /function finish\(completed = true\)/)
  assert.match(p, /if \(completed\) \{ try \{ awardXP\('session_done'\)/, 'the bonus is conditional')
  assert.match(p, /onClose=\{\(\) => finish\(false\)\}/, 'closing is not completing')
})

test('a format the session drops is announced, not swallowed', () => {
  const p = read('src', 'pages', 'Practice.tsx')
  assert.match(p, /Questions skipped/, 'the notice names what went')
  assert.match(p, /still ready/, 'and what survived')
  // it used to be set and never rendered, which is what made it silent
  assert.ok(p.split('qNote').length - 1 >= 4, 'qNote must be rendered, not just assigned')
})

test('the stuck chat opens anchored to the step', () => {
  const doubt = read('src', 'pages', 'DoubtSolving.tsx')
  assert.match(doubt, /step: shown/, 'the step travels')
  assert.match(doubt, /working: steps\[shown - 1\]\?\.working/, 'and so does the working')
  const chat = read('src', 'pages', 'KairoChat.tsx')
  assert.match(chat, /Stuck on step \{anchor\.step\} of \{anchor\.total\}/, 'the chat pins it')
  assert.match(chat, /turns\.length === 0 && !anchor/, 'and the cold-start hero is suppressed')
  const dash = read('src', 'pages', 'Dashboard.tsx')
  // tied to the page it describes: as a bare string, the effect that clears
  // it on [active] ran a tick after the handler set it and wiped it every time
  assert.match(dash, /setTitleOverride\(anchor \? \{ page: 'doubt', text: `Stuck on step/, 'the header says so too')
  assert.match(dash, /titleOverride\?\.page === active/, 'and it only applies to its own page')
  // the student already pressed a button that says what they want
  assert.match(chat, /pending\.current = seed/, 'the first message is sent, not left in the box')
  assert.match(chat, /Got it, next step/, 'and the follow-ups are the ones a stuck student needs')
  assert.doesNotMatch(chat, /Explain quadratic equations[^]{0,200}anchor/, 'no generic cold-start chips in stuck mode')
})

test('Plan has a door to the focus timer, and one answer for days studied', () => {
  const plan = read('src', 'pages', 'Plan.tsx')
  assert.match(plan, /Start 25 minutes/, 'the merged timer needs an entry point')
  assert.match(plan, /startFocus\('Study', 25\)/)
  assert.match(plan, /selectStreak/, 'the day count comes from the same selector Progress reads')
  assert.doesNotMatch(plan, /of 7 days of study time recorded/, 'the contradictory line is gone')
})

test('touch targets meet the floor', () => {
  const shell = read('src', 'components', 'MobileShell.tsx')
  assert.match(shell, /width: 44, height: 44, borderRadius: 12/, 'the hamburger was 38')
  assert.doesNotMatch(shell, /fontSize: 10, color: isDark/, 'nav labels were 10px')
  const progress = read('src', 'pages', 'Progress.tsx')
  assert.match(progress, /minHeight: 44, padding: '0 14px', borderRadius: 100/, 'battle subject chips were under 40')
})
