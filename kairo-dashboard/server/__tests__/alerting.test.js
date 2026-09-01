/**
 * "We've been alerted" has to be true.
 *
 * That sentence ships to students. It was false: /api/ops/error accepted every
 * report and pushed it into an in-memory array that dies with each Vercel
 * instance, and the only way to read it was behind a 404-gated endpoint. Two
 * features were dead in production and the first anyone knew was a screenshot.
 *
 * These pin the two properties that make it true: faults are reported, and
 * routes stop leaking internal error text to students.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { alertStatus, _reset } from '../services/alert.js'

const ROUTES = join(import.meta.dirname, '..', 'routes')
const files = readdirSync(ROUTES).filter(f => f.endsWith('.js'))

test('no route sends a raw error message to the client', () => {
  const offenders = []
  for (const f of files) {
    readFileSync(join(ROUTES, f), 'utf-8').split('\n').forEach((line, i) => {
      // A commented-out example does not execute. Explaining what the old bad
      // line was is exactly how these fixes stay understood, so the rule must
      // not punish it — the same false positive bit the privacy check earlier.
      const t = line.trim()
      if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return

      if (/res\.status\(\d+\)\.json\(\{\s*error:\s*\w+\??\.message/.test(line)) {
        offenders.push(`${f}:${i + 1}  ${t.slice(0, 84)}`)
      }
    })
  }
  assert.deepEqual(offenders, [],
    'These put a caught error message on the wire. Whatever the database or the ' +
    'AI provider said goes straight to a student. Use fail(res, req, e):\n  ' +
    offenders.join('\n  '))
})

test('fail() is called with req, never a handler that declared _req', () => {
  // fail() names the route from req. A handler written (_req, res) that calls
  // fail(res, req, e) throws ReferenceError at the exact moment something is
  // already going wrong — the worst possible time.
  const offenders = []
  for (const f of files) {
    const src = readFileSync(join(ROUTES, f), 'utf-8')
    for (const m of src.matchAll(/\(\s*_req\s*,\s*res\s*\)\s*=>\s*\{/g)) {
      const start = m.index + m[0].length
      const next = src.indexOf('\nrouter.', start)
      const body = src.slice(start, next > 0 ? next : src.length)
      if (body.includes('fail(res, req')) {
        offenders.push(`${f}:${src.slice(0, m.index).split('\n').length}`)
      }
    }
  }
  assert.deepEqual(offenders, [],
    'Handler declares _req but calls fail(res, req, …) — req is undefined:\n  ' +
    offenders.join('\n  '))
})

test('the quiz and topic routes report their faults', () => {
  // The two features that were dead in production. If these ever go back to a
  // bare res.status(500), nobody finds out again.
  for (const f of ['quiz.js', 'topicArchitect.js']) {
    const src = readFileSync(join(ROUTES, f), 'utf-8')
    assert.ok(src.includes('fail(res, req'), `${f} does not report its faults`)
  }
})

test('alertStatus never leaks the address or the password', () => {
  _reset()
  const s = alertStatus()
  assert.equal(typeof s.configured, 'boolean')
  assert.equal(s.sentThisHour, 0)
  if (s.to) {
    assert.match(s.to, /\*\*\*/, 'the alert address must be masked')
  }
  assert.equal(JSON.stringify(s).includes('APP_PASSWORD'), false)
})
