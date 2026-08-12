/**
 * PR1 / PR2 — the routes that served live data to anyone must not any more.
 *
 * NODE_ENV is forced to production here so the dev-surface assertions test the
 * configuration users actually get, not the one developers run.
 */
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'

process.env.NODE_ENV = 'production'

const { default: app } = await import('../app.js')

let server
let base

before(async () => {
  server = createServer(app)
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  base = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
  await new Promise((r) => server.close(r))
})

const get = (path, headers = {}) => fetch(`${base}${path}`, { headers })

// Routes that used to answer 200 with live rows and no token at all.
for (const path of [
  '/api/flashcards',
  '/api/flashcards/due',
  '/api/study-plan',
  '/api/essay',
]) {
  test(`GET ${path} without a token is rejected`, async () => {
    const res = await get(path)
    assert.equal(res.status, 401, `${path} must not serve data anonymously`)
  })
}

test('a client-supplied school_id cannot be used to widen scope', async () => {
  // Even with the parameter that used to select the tenant, no token means
  // no data. The scope now comes from the verified token only.
  const res = await get('/api/flashcards?school_id=1')
  assert.equal(res.status, 401)
})

test('a client-supplied user_id cannot be used to read another user', async () => {
  const res = await get('/api/study-plan?user_id=00000000-0000-0000-0000-000000000001')
  assert.equal(res.status, 401)
})

test('the dev email inbox is not mounted in production', async () => {
  const res = await get('/api/dev/emails')
  assert.equal(res.status, 404)
})

test('an x-forwarded-for spoof does not unlock anything', async () => {
  // The past OTP bypass came from trusting a client-controlled header.
  const res = await get('/api/flashcards', { 'x-forwarded-for': '127.0.0.1' })
  assert.equal(res.status, 401)
})

test('errors do not leak database internals', async () => {
  const res = await get('/api/league/board?week=NOT-A-DATE')
  const body = JSON.stringify(await res.json()).toLowerCase()
  for (const leak of ['syntax for type', 'postgres', 'pg_', 'relation ']) {
    assert.ok(!body.includes(leak), `response leaked "${leak}"`)
  }
})

// --- Study Engine ---------------------------------------------------------

test('GET /api/study/today requires a token', async () => {
  const res = await get('/api/study/today')
  assert.equal(res.status, 401)
})

test('POST /api/study/session requires a token', async () => {
  const res = await fetch(`${base}/api/study/session`, { method: 'POST' })
  assert.equal(res.status, 401)
})
