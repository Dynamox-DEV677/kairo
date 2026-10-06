/**
 * CORS: exact origins only.
 *
 * It used to allow every *.vercel.app site -- anyone can deploy one. Kyno's own
 * pages call /api from their own origin and never needed it. Pinned here: the
 * production site is allowed, other Vercel sites and look-alike domains are
 * not, ALLOWED_ORIGIN adds exact origins, a local dev server only works outside
 * production, and app.js uses this middleware.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import express from 'express'
import { isAllowedOrigin, kynoCors } from '../lib/cors.js'

const ROOT = join(import.meta.dirname, '..', '..')
const read = (...p) => readFileSync(join(ROOT, ...p), 'utf-8')
const PROD = { NODE_ENV: 'production' }

test("Kyno's own site is allowed; other Vercel sites and look-alikes are not", () => {
  assert.equal(isAllowedOrigin('https://kairo-daily-edu.vercel.app', PROD), true)
  for (const o of [
    'https://someone-else.vercel.app',
    'https://kairo-daily-edu.vercel.app.example.com',
    'https://xkairo-daily-edu.vercel.app',
    'http://kairo-daily-edu.vercel.app',
    'https://kairo-daily-edu.vercel.app/',
    'null',
    '',
  ]) {
    assert.equal(isAllowedOrigin(o, PROD), false, o)
  }
})

test('ALLOWED_ORIGIN adds exact origins, comma-separated', () => {
  const env = { NODE_ENV: 'production', ALLOWED_ORIGIN: ' https://kyno.app , https://www.kyno.app' }
  assert.equal(isAllowedOrigin('https://kyno.app', env), true)
  assert.equal(isAllowedOrigin('https://www.kyno.app', env), true)
  assert.equal(isAllowedOrigin('https://evil.kyno.app', env), false)
})

test('a local dev server is allowed only outside production', () => {
  for (const o of ['http://localhost:5173', 'http://127.0.0.1:3001', 'http://localhost']) {
    assert.equal(isAllowedOrigin(o, {}), true, o)
    assert.equal(isAllowedOrigin(o, PROD), false, o)
  }
  assert.equal(isAllowedOrigin('http://localhost.example.com', {}), false)
})

test('in a real Express app: the allowed origin gets the header, everyone else gets none', async () => {
  const app = express()
  app.use(kynoCors(PROD))
  app.get('/api/x', (_req, res) => res.json({ ok: true }))
  const server = http.createServer(app)
  await new Promise(r => server.listen(0, '127.0.0.1', r))
  try {
    const base = `http://127.0.0.1:${server.address().port}`
    const own = await fetch(`${base}/api/x`, { headers: { origin: 'https://kairo-daily-edu.vercel.app' } })
    assert.equal(own.headers.get('access-control-allow-origin'), 'https://kairo-daily-edu.vercel.app')
    assert.match(own.headers.get('vary') || '', /Origin/)

    const other = await fetch(`${base}/api/x`, { headers: { origin: 'https://someone-else.vercel.app' } })
    assert.equal(other.headers.get('access-control-allow-origin'), null)

    const preflight = await fetch(`${base}/api/x`, { method: 'OPTIONS', headers: { origin: 'https://someone-else.vercel.app' } })
    assert.equal(preflight.status, 204)
    assert.equal(preflight.headers.get('access-control-allow-origin'), null)
  } finally {
    server.closeAllConnections()
    server.close()
  }
})

test('app.js uses kynoCors and no longer trusts every *.vercel.app', () => {
  const app = read('server', 'app.js')
  assert.match(app, /app\.use\(kynoCors\(\)\)/)
  assert.doesNotMatch(app, /vercel\\\.app\$/)
  assert.doesNotMatch(app, /isVercel/)
})
