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
