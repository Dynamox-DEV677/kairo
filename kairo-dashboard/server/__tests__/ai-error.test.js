/**
 * What a student is allowed to read when the AI breaks.
 *
 * Two failures this pins down, both real and both shipped:
 *
 *   · "AI request failed. Last error: HTTP 401" reached a student's screen.
 *     No HTTP status may ever be rendered.
 *   · friendlyError() mapped EVERY 5xx to "Kyno's servers are busy right now",
 *     so a server fault claimed to be load. That is false to the student and it
 *     hid a real outage from us.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { AiError, studentMessage } from '../../src/lib/aiError.core.js'

const err = (message, status) => Object.assign(new Error(message), status ? { status } : {})

test('auth failures are recognised however they arrive', () => {
  for (const e of [
    err('HTTP 401', 401),
    err('Missing Bearer token.', 401),
    err('Invalid or expired token.'),
    err('AUTH_UNAVAILABLE'),
    err('Not authenticated.', 403),
  ]) {
    assert.equal(AiError.from(e).code, 'AUTH_EXPIRED', e.message)
  }
})

test('only a real 429 is allowed to blame load', () => {
  assert.equal(AiError.from(err('HTTP 429', 429)).code, 'RATE_LIMITED')
  assert.equal(AiError.from(err('rate limit exceeded')).code, 'RATE_LIMITED')
})

test('THE LIE: a 500 must not claim the servers are busy', () => {
  const e = AiError.from(err('API error 500', 500))
  assert.equal(e.code, 'SERVER_FAULT')
  assert.doesNotMatch(e.message, /busy/i)
  assert.doesNotMatch(e.message, /lot of students/i)
  assert.match(e.message, /our side, not yours/i)
})

test('502/503/504 are faults too, not load', () => {
  for (const s of [502, 503, 504]) {
    const e = AiError.from(err(`API error ${s}`, s))
    assert.equal(e.code, 'SERVER_FAULT', String(s))
    assert.doesNotMatch(e.message, /busy/i)
  }
})

test('no student-facing message ever contains an HTTP status', () => {
  const inputs = [
    err('HTTP 401', 401), err('HTTP 429', 429), err('HTTP 500', 500),
    err('API error 503', 503), err('AI request failed. Last error: HTTP 401'),
    err('Kyno is busy right now (502) — try again'),
    err('something weird nobody predicted'),
    'a bare string', null, undefined, { message: 'HTTP 418', status: 418 },
  ]
  for (const i of inputs) {
    const msg = studentMessage(i)
    assert.doesNotMatch(msg, /\b[1-5]\d\d\b/, `leaked a status: "${msg}"`)
    assert.doesNotMatch(msg, /HTTP/i, `leaked "HTTP": "${msg}"`)
    assert.doesNotMatch(msg, /\berror:/i, `leaked a debug prefix: "${msg}"`)
  }
})

test('an unrecognised error does not get echoed back verbatim', () => {
  // friendlyError used to `return msg` for anything it did not match, which is
  // precisely how internal strings reached the UI.
  const leak = 'ECONNREFUSED 10.0.0.4:5432 relation "users" does not exist'
  const msg = studentMessage(err(leak))
  assert.notEqual(msg, leak)
  assert.doesNotMatch(msg, /ECONNREFUSED|relation|10\.0\.0/)
})

test('network and timeout are distinguished from load', () => {
  assert.equal(AiError.from(err('Failed to fetch')).code, 'OFFLINE')
  assert.equal(AiError.from(err('The operation was aborted')).code, 'TIMEOUT')
  assert.equal(AiError.from(Object.assign(new Error('x'), { name: 'AbortError' })).code, 'TIMEOUT')
})

test('a missing provider key reads as not-configured, not as the student‘s fault', () => {
  const e = AiError.from(err('No live Groq keys — set GROQ_API_KEYS in env'))
  assert.equal(e.code, 'NOT_CONFIGURED')
  assert.doesNotMatch(e.message, /GROQ|env|key/i)
})

test('retryability is honest', () => {
  // Retrying an expired session just fails again; retrying a timeout may work.
  assert.equal(AiError.from(err('HTTP 401', 401)).retryable, false)
  assert.equal(AiError.from(err('HTTP 429', 429)).retryable, true)
  assert.equal(AiError.from(err('HTTP 500', 500)).retryable, true)
  assert.equal(AiError.from(err('No live Groq keys')).retryable, false)
})

test('AiError passes through unchanged rather than being re-wrapped', () => {
  const original = new AiError('RATE_LIMITED')
  assert.equal(AiError.from(original), original)
})

test('every code produces a non-empty, non-technical sentence', () => {
  const codes = ['AUTH_EXPIRED', 'RATE_LIMITED', 'TIMEOUT', 'OFFLINE',
                 'SERVER_FAULT', 'NOT_CONFIGURED', 'BAD_RESPONSE', 'UNKNOWN']
  for (const c of codes) {
    const m = new AiError(c).message
    assert.ok(m.length > 20, `${c} message is too terse: "${m}"`)
    assert.doesNotMatch(m, /undefined|null|\[object/i, c)
  }
})

/* ── the safety valve ─────────────────────────────────────────────────────── */

test('RATE_LIMITED is unreachable from any status except 429', () => {
  // The brief's explicit ask: reporting an auth outage as popularity is how
  // nobody noticed the API was down. This fails if that door ever reopens.
  for (let s = 400; s <= 599; s++) {
    if (s === 429) continue
    const code = AiError.from(Object.assign(new Error(`API error ${s}`), { status: s })).code
    assert.notEqual(code, 'RATE_LIMITED', `status ${s} produced RATE_LIMITED`)
  }
  assert.equal(AiError.from(Object.assign(new Error('x'), { status: 429 })).code, 'RATE_LIMITED')
})

test('every status maps to the code the brief specifies', () => {
  const expect = { 401: 'AUTH_EXPIRED', 403: 'AUTH_EXPIRED', 429: 'RATE_LIMITED',
                   500: 'SERVER_FAULT', 502: 'SERVER_FAULT', 503: 'SERVER_FAULT', 504: 'SERVER_FAULT' }
  for (const [status, code] of Object.entries(expect)) {
    const e = AiError.from(Object.assign(new Error('x'), { status: Number(status) }))
    assert.equal(e.code, code, `status ${status}`)
  }
})

test('a genuinely useful server sentence survives', () => {
  // Flattening these to "Something went wrong" would be a downgrade dressed
  // up as a fix.
  for (const msg of [
    'You already have a deck with that name.',
    'Pick at least one subject before generating a plan.',
    'That topic is not in your syllabus for Class 10.',
  ]) {
    assert.equal(studentMessage(new Error(msg)), msg)
  }
})

test('but anything that could leak internals does not', () => {
  for (const msg of [
    'API error 500',
    'HTTP 401 Unauthorized',
    'error: connect ECONNREFUSED 127.0.0.1:5432',
    'TypeError: Cannot read properties of undefined',
    'at handler (/var/task/server/routes/quiz.js:88:12)',
    'select * from users where id = $1 failed',
    'Invalid api_key provided: gsk_abc123',
    'fetch failed for http://localhost:3002/api/ai/chat',
    '[object Object]',
  ]) {
    const out = studentMessage(new Error(msg))
    assert.notEqual(out, msg, `leaked: ${msg}`)
    assert.doesNotMatch(out, /\b[1-5]\d\d\b|HTTP|ECONN|gsk_|localhost|\[object/i)
  }
})
