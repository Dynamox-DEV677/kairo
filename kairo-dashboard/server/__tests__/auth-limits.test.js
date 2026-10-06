/**
 * Sign-in and "forgot password" limits, counted per account.
 *
 * What these pin: repeated wrong passwords for one account hit a wall while
 * everyone else carries on; a whole class signing in from one school network
 * (one shared IP) is never blocked; successful sign-ins don't use up attempts;
 * reset links are capped per email, with a message the Login screen will
 * actually show; and the three routes are wired to the limiters.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import express from 'express'
import { accountKey, createLoginLimiter, createResetRequestLimiter } from '../middleware/rateLimit.js'
import { isSafeForStudents } from '../../src/lib/aiError.core.js'

const ROOT = join(import.meta.dirname, '..', '..')
const read = (...p) => readFileSync(join(ROOT, ...p), 'utf-8')

async function serve(app) {
  const server = http.createServer(app)
  await new Promise(r => server.listen(0, '127.0.0.1', r))
  return {
    base: `http://127.0.0.1:${server.address().port}`,
    close: () => { server.closeAllConnections(); server.close() },
  }
}
const postJson = (url, body) =>
  fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })

// A stand-in login: one right password, everything else is a 401 -- the same
// statuses the real routes answer with.
function loginApp() {
  const app = express()
  app.use(express.json())
  app.post('/login', createLoginLimiter(), (req, res) =>
    req.body.password === 'right-one'
      ? res.json({ ok: true })
      : res.status(401).json({ error: 'Invalid email or password.' }))
  return app
}

test('ten wrong passwords pause that account; another account is untouched', async () => {
  const s = await serve(loginApp())
  try {
    for (let i = 0; i < 10; i++) {
      assert.equal((await postJson(`${s.base}/login`, { email: 'asha@school.in', password: `wrong${i}` })).status, 401)
    }
    const paused = await postJson(`${s.base}/login`, { email: 'asha@school.in', password: 'wrong10' })
    assert.equal(paused.status, 429)
    assert.match((await paused.json()).error, /Too many sign-in attempts/)
    // The same email typed differently is the same account.
    assert.equal((await postJson(`${s.base}/login`, { email: '  ASHA@school.in ', password: 'x' })).status, 429)
    // Someone else signs in normally.
    assert.equal((await postJson(`${s.base}/login`, { email: 'ravi@school.in', password: 'right-one' })).status, 200)
  } finally {
    s.close()
  }
})

test('a whole class signing in from one school network is not blocked', async () => {
  const s = await serve(loginApp())
  try {
    // Every request here comes from 127.0.0.1 -- one shared IP, like a computer lab.
    for (let i = 0; i < 40; i++) {
      assert.equal((await postJson(`${s.base}/login`, { email: `student${i}@school.in`, password: 'typo' })).status, 401)
      assert.equal((await postJson(`${s.base}/login`, { email: `student${i}@school.in`, password: 'right-one' })).status, 200)
    }
  } finally {
    s.close()
  }
})

test('successful sign-ins do not use up attempts', async () => {
  const s = await serve(loginApp())
  try {
    for (let i = 0; i < 25; i++) {
      assert.equal((await postJson(`${s.base}/login`, { email: 'meera@school.in', password: 'right-one' })).status, 200)
    }
    for (let i = 0; i < 10; i++) {
      assert.equal((await postJson(`${s.base}/login`, { email: 'meera@school.in', password: 'nope' })).status, 401)
    }
    assert.equal((await postJson(`${s.base}/login`, { email: 'meera@school.in', password: 'nope' })).status, 429)
  } finally {
    s.close()
  }
})

test('reset links: five per email per hour, then a message the Login screen will show', async () => {
  const app = express()
  app.use(express.json())
  app.post('/forgot-password', createResetRequestLimiter(), (_req, res) =>
    res.json({ message: 'If an account exists for that email, a reset link is on its way.' }))
  const s = await serve(app)
  try {
    for (let i = 0; i < 5; i++) {
      assert.equal((await postJson(`${s.base}/forgot-password`, { email: 'kiran@school.in' })).status, 200)
    }
    const capped = await postJson(`${s.base}/forgot-password`, { email: 'kiran@school.in' })
    assert.equal(capped.status, 429)
    const { error } = await capped.json()
    // Login.tsx shows safeDetail(e) -- which drops any message that fails this.
    assert.equal(isSafeForStudents(error), true, `would be hidden on the Login screen: ${error}`)
    // A different email still gets its link.
    assert.equal((await postJson(`${s.base}/forgot-password`, { email: 'dev@school.in' })).status, 200)
  } finally {
    s.close()
  }
})

test('accountKey: the email when there is one, the client IP when there is not', () => {
  const ipReq = (body) => ({ body, headers: { 'x-forwarded-for': '203.0.113.7' } })
  assert.equal(accountKey(ipReq({ email: ' A@B.in ' })), 'acct:a@b.in')
  assert.equal(accountKey(ipReq({})), 'ip:203.0.113.7')
  assert.equal(accountKey(ipReq({ email: 42 })), 'ip:203.0.113.7')           // not a string
  assert.equal(accountKey(ipReq(undefined)), 'ip:203.0.113.7')
  assert.equal(accountKey(ipReq({ email: 'x'.repeat(5000) })).length, 'acct:'.length + 254)
})

test('both sign-in routes and forgot-password are wired to the limiters', () => {
  assert.match(read('server', 'routes', 'auth.js'),          /router\.post\('\/login', loginLimiter,/)
  assert.match(read('server', 'routes', 'usersV2.js'),       /router\.post\('\/login', loginLimiter,/)
  assert.match(read('server', 'routes', 'passwordReset.js'), /router\.use\('\/forgot-password', resetRequestLimiter\)/)
})
