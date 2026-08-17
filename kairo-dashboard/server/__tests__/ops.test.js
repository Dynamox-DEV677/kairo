/**
 * A1 — the ops endpoints must not be readable by the public.
 *
 * Uses node:test and a real ephemeral HTTP server, so there is no test
 * framework and no supertest dependency to install. Run with `npm test`.
 *
 * A valid OPS_TOKEN is injected here rather than read from .env, so the suite
 * passes identically on a laptop and in CI.
 */
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'

const GOOD_TOKEN = 'test-ops-token-that-is-long-enough-32'
process.env.OPS_TOKEN = GOOD_TOKEN

const { default: app } = await import('../app.js')

let server
let base

before(async () => {
  server = createServer(app)
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  base = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
  await new Promise((resolve) => server.close(resolve))
})

const get = (path, token) =>
  fetch(`${base}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })

test('GET /api/ops/status is 404 without a token', async () => {
  const res = await get('/api/ops/status')
  assert.equal(res.status, 404)
})

test('GET /api/ops/status is 404 with a wrong token', async () => {
  const res = await get('/api/ops/status', 'not-the-token-but-also-long-enough')
  assert.equal(res.status, 404)
})

test('the gated 404 is indistinguishable from a route that does not exist', async () => {
  // If these differ, an attacker can enumerate which ops routes are deployed
  // without ever holding a token.
  const gated = await get('/api/ops/status')
  const absent = await get('/api/ops/definitely-not-a-route')
  assert.equal(gated.status, absent.status)
  assert.deepEqual(await gated.json(), await absent.json())
})

test('GET /api/ops/diagnose is 404 without a token', async () => {
  const res = await get('/api/ops/diagnose')
  assert.equal(res.status, 404)
})

test('GET /api/ops/status returns the snapshot with a valid token', async () => {
  const res = await get('/api/ops/status', GOOD_TOKEN)
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.equal(body.project, 'kairo-dashboard')
  assert.ok(body.features?.total > 0)
})

test('the snapshot no longer carries build identity or secret inventory', async () => {
  const res = await get('/api/ops/status', GOOD_TOKEN)
  const body = await res.json()

  assert.equal(body.env, undefined, 'env must be gone entirely')
  for (const field of ['commitMessage', 'repo', 'owner', 'deploymentId']) {
    assert.equal(body.deploy[field], undefined, `deploy.${field} must be gone`)
  }

  // Belt and braces: none of it may survive anywhere in the payload under a
  // different key.
  const raw = JSON.stringify(body)
  for (const leak of ['hasGroq', 'hasServiceRole', 'hasRazorpay', 'commitMessage']) {
    assert.ok(!raw.includes(leak), `payload still contains "${leak}"`)
  }
})

test('with OPS_TOKEN unset the endpoint fails closed', async () => {
  delete process.env.OPS_TOKEN
  try {
    const res = await get('/api/ops/status', GOOD_TOKEN)
    assert.equal(res.status, 404)
  } finally {
    process.env.OPS_TOKEN = GOOD_TOKEN
  }
})

test('a short OPS_TOKEN is rejected rather than trusted', async () => {
  process.env.OPS_TOKEN = 'short'
  try {
    const res = await get('/api/ops/status', 'short')
    assert.equal(res.status, 404)
  } finally {
    process.env.OPS_TOKEN = GOOD_TOKEN
  }
})

test('GET /api/health is public and returns exactly { ok: true }', async () => {
  const res = await get('/api/health')
  assert.equal(res.status, 200)
  assert.deepEqual(await res.json(), { ok: true })
})

test('GET /api no longer publishes the route inventory', async () => {
  const res = await get('/api')
  assert.equal(res.status, 404)
})

// ── council fallback (incident: /api/council/brief 500 loop, 2026-08-16) ────
// When aiCall throws (pool cooling / quota) the route must serve a brief built
// from the request's own data instead of 500ing the whole Home screen.
import { fallbackBrief } from '../routes/council.js'

test('council fallback is built from the student\'s real topics, no invented scores', () => {
  const b = fallbackBrief({
    name: 'Darshan',
    weakTopics: ['trigonometry', 'mole concept'],
    strongTopics: ['cells'],
    nextExam: { name: 'Unit test', days: 3 },
    withDays: [],
  })
  assert.equal(b.fallback, true)
  assert.equal(b.todaysFocus.length, 2)
  assert.match(b.todaysFocus[0].task, /trigonometry/)
  assert.equal(b.mainWeakness, 'trigonometry')
  assert.match(b.mentorNote, /Unit test is 3 days out/)
  // The fabricatable fields must be ABSENT, not guessed.
  assert.ok(!('predictedScore' in b))
  assert.ok(!('motivation' in b))
  assert.ok(!('trend' in b))
})

test('council fallback with no topic data gives one honest starter task', () => {
  const b = fallbackBrief({ name: 'S', weakTopics: [], strongTopics: [] })
  assert.equal(b.todaysFocus.length, 1)
  assert.match(b.todaysFocus[0].why, /No topic data yet/)
  assert.equal(b.mainWeakness, null)
})
