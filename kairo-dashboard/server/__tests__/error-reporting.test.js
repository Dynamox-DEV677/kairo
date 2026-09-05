/**
 * Four 500s were showing one sentence: "Something's broken on our side."
 *
 * A student cannot report that, and it cannot be matched to a server log. Each
 * failure now names the step, says what to do, and carries a reference id that
 * is also printed beside the real stack on the server.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(import.meta.dirname, '..', '..')
const read = (...p) => readFileSync(join(ROOT, ...p), 'utf-8')

test('every failure carries a reference id, to the log and to the student', () => {
  const fail = read('server', 'lib', 'fail.js')
  assert.match(fail, /const ref = /, 'fail() mints a reference')
  assert.match(fail, /console\.error\(`\[fail \$\{ref\}\]/, 'and prints it beside the real error')
  assert.match(fail, /json\(\{ error: message, ref \}\)/, 'and returns it to the client')
  const api = read('src', 'lib', 'api.ts')
  assert.match(api, /err\.ref = /, 'the client keeps it so it can be shown')
})

test('quiz/start never 500s on a model that returned no questions', () => {
  const quiz = read('server', 'routes', 'quiz.js')
  // data.questions.length used to throw a TypeError straight into fail()
  const guard = quiz.slice(quiz.indexOf('const data = parseJSON(raw)'), quiz.indexOf('const session ='))
  assert.match(guard, /Array\.isArray\(data\?\.questions\)/, 'the shape is checked')
  assert.match(guard, /status: 502/, 'a bad upstream answer is not our 500')
  assert.match(guard, /could not write/, 'and the message names the step')
})

test('a spoken transcript is saved BEFORE it is graded', () => {
  const practice = read('src', 'pages', 'Practice.tsx')
  const grade = practice.slice(practice.indexOf('async function grade()'), practice.indexOf('async function grade()') + 1400)
  const save = grade.indexOf('saveToNotebook')
  const send = grade.indexOf("post('/practice/teachback'")
  assert.ok(save > -1 && send > -1, 'both steps exist')
  assert.ok(save < send, 'the transcript must be saved before the request that can fail')
  assert.match(grade, /Could not grade your answer/, 'the failure names the step')
  assert.match(grade, /saved in Notes/, 'and tells the student their words are safe')
})

test('the RLS migration removes the recursion instead of patching it', () => {
  const raw = read('server', 'db', '2026-09-05_users_rls_self_only.sql')
  // strip -- comments: the header quotes the OLD policy to explain what it broke
  const NL = String.fromCharCode(10)
  const sql = raw.split(NL).filter(l => !l.trim().startsWith('-' + '-')).join(NL)
  assert.match(sql, /drop function if exists public\.current_school_id/, 'the recursing helper is deleted')
  assert.match(sql, /alter table public\.users enable row level security/, 'RLS stays ON')
  assert.doesNotMatch(sql, /using \(school_id/, 'no policy reads users from inside a users policy')
  assert.match(sql, /auth\.uid\(\) = id/, 'self-access only')
})

test('the app shows the real database error, because a phone has no server log', () => {
  const profile = read('src', 'pages', 'Profile.tsx')
  assert.match(profile, /failureLog/, 'Profile reads the recorded failures')
  assert.match(profile, /Copy all errors/, 'and they can be copied out verbatim')
})
