/**
 * Found in the pre-production check, 2026-10-23, by opening the live app.
 *
 *  - /status was a blank screen in production: it read `snap.deploy.region`
 *    from the public health probe, which has no `deploy`.
 *  - The "Try Demo Mode" popup rendered ONLY on logged-out screens, over the
 *    sign-in form on a phone, where "Load demo data" reloaded straight back to
 *    the same login page.
 *  - Play requires a public account-deletion URL and a privacy policy that
 *    matches the permissions the app asks for (camera, microphone).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { readHealth, parsePool } from '../../src/lib/statusHealth.core.js'

const ROOT = join(import.meta.dirname, '..', '..')
const read = (...p) => readFileSync(join(ROOT, ...p), 'utf-8')

// The exact shape /api/ops/health returned in production that day.
const LIVE = { ok: true, ts: 1792764703231, ai: { windowMinutes: 60, calls: 0, failures: 0, failRate: null, p50ms: null, p95ms: null, byReason: {}, pool: '10/10 keys live, 0 in cooldown' } }

test('the status page reads the public health probe without crashing', () => {
  const v = readHealth(LIVE, 640)
  assert.equal(v.overall, 'ok')
  assert.deepEqual(v.services.map(s => s.id), ['api', 'ai'])
  assert.match(v.services[1].body, /10 of 10 AI keys working/)
  assert.equal(readHealth({}, 100).overall, 'down')
  assert.equal(readHealth(null, 100).overall, 'down')
})

test('the status page says slow or down when it is', () => {
  assert.equal(readHealth({ ok: true, ai: { calls: 20, failures: 9, pool: '10/10' } }, 200).overall, 'degraded')
  assert.equal(readHealth({ ok: true, ai: { calls: 2, failures: 2, pool: '10/10' } }, 200).overall, 'ok', 'two calls are not a rate')
  assert.equal(readHealth({ ok: true, ai: { calls: 0, pool: '0/10 keys live' } }, 200).overall, 'down')
  assert.equal(readHealth({ ok: true, ai: { calls: 0, pool: '10/10' } }, 2400).overall, 'degraded')
  assert.deepEqual(parsePool('7/10 keys live'), { live: 7, total: 10 })
})

test('the status page no longer reads operator-only fields', () => {
  // Code only: the header comment quotes the old crash on purpose.
  const src = read('src', 'pages', 'StatusPage.tsx').replace(/\/\*[\s\S]*?\*\//g, '')
  for (const field of ['snap.deploy', 'snap.users', 'snap.database', 'snap.errors', 'snap.schools']) {
    assert.ok(!src.includes(field), field)
  }
})

test('the demo popup appears only inside the signed-in app', () => {
  const app = read('src', 'App.tsx')
  assert.equal((app.match(/<DemoModePrompt \/>/g) || []).length, 1)
  assert.match(app, /\{onboard === 'done' && <DemoModePrompt \/>\}/)
})

test('account deletion is reachable on the web and described accurately', () => {
  const page = read('public', 'delete-account.html')
  assert.match(page, /Profile<\/b>/)
  assert.match(page, /Delete account<\/b>/)
  assert.match(page, /kairoindustries\.cor@gmail\.com/)
  const vercel = JSON.parse(read('vercel.json'))
  assert.ok(vercel.rewrites.some(r => r.source === '/delete-account' && r.destination === '/delete-account.html'))
  // before the catch-all, or the SPA swallows it
  const idx = (s) => vercel.rewrites.findIndex(r => r.source === s)
  assert.ok(idx('/delete-account') < idx('/(.*)'))
})

test('the privacy policy covers the permissions the app asks for', () => {
  const p = read('public', 'privacy.html')
  assert.match(p, /Photos from your camera/)
  assert.match(p, /<b>Voice<\/b>/)
  assert.match(p, /Profile → Delete account/)
  assert.match(p, /delete-account\.html/)
})

test('a failed solve shows "Try again", not the crash screen', () => {
  const src = read('src', 'pages', 'KairoSolver.tsx')
  const panel = src.slice(src.indexOf('function ExplanationPanel'))
  assert.ok(!/\{topic && !busy/.test(panel), 'topic is not defined in ExplanationPanel')
  assert.ok(!/onClick=\{\(\) => ask\(topic\)\}/.test(panel), 'ask is not defined in ExplanationPanel')
  assert.match(panel, /\{question && !busy && \(/)
  assert.match(panel, /onClick=\{\(\) => onAskRelated\(question\)\}/)
})

test('account deletion only reports success when the sign-in is really gone', () => {
  const src = read('server', 'routes', 'account.js')
  const route = src.slice(src.indexOf("router.post('/delete'"))
  assert.ok(route.indexOf('auth.admin.deleteUser') < route.indexOf(".from('users').delete()"), 'sign-in first, so a retry is still possible')
  assert.match(route, /if \(results\.auth !== 'deleted'\) \{/)
  assert.match(route, /res\.status\(SUPABASE_CONFIGURED \? 500 : 503\)/)
})

test('the Reader shelf cannot wait forever on a blocked library upgrade', () => {
  const src = read('src', 'lib', 'library.ts')
  assert.match(src, /req\.onblocked = \(\) => \{/)
  assert.match(src, /Close it, then open your books again\./)
})
