/**
 * The privacy page must describe the app that actually exists.
 *
 * Settings claimed "Nothing is sent to our servers" while the twin blob
 * synced on a debounce, every doubt went to a model, and screen views were
 * beaconed. Copy drifts from code silently; a test does not. So the inventory
 * is derived from the route table, and adding a route you have not classified
 * breaks the build until you say what it sends.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { ROUTE_CATEGORY, DATA_FLOWS, activeFlows, privacyHeadline } from '../../src/lib/privacy.core.js'

const ROUTES_DIR = join(import.meta.dirname, '..', 'routes')

test('every server route is classified by what it sends', () => {
  const onDisk = readdirSync(ROUTES_DIR)
    .filter(f => f.endsWith('.js'))
    .map(f => f.replace(/\.js$/, ''))
  const missing = onDisk.filter(r => !ROUTE_CATEGORY[r])
  assert.deepEqual(missing, [],
    'new server routes with no privacy classification. Add each to ROUTE_CATEGORY in ' +
    'src/lib/privacy.core.js and say what student data it carries:\n  ' + missing.join('\n  '))
})

test('the classification does not describe routes that no longer exist', () => {
  const onDisk = new Set(readdirSync(ROUTES_DIR).filter(f => f.endsWith('.js')).map(f => f.replace(/\.js$/, '')))
  const stale = Object.keys(ROUTE_CATEGORY).filter(r => !onDisk.has(r))
  assert.deepEqual(stale, [], 'ROUTE_CATEGORY lists routes that are gone: ' + stale.join(', '))
})

test('every category a route uses is explained to the student', () => {
  const explained = new Set(DATA_FLOWS.map(f => f.category))
  const used = new Set(Object.values(ROUTE_CATEGORY))
  const unexplained = [...used].filter(c => !explained.has(c))
  assert.deepEqual(unexplained, [],
    'routes send data in categories the privacy table never mentions: ' + unexplained.join(', '))
})

test('Settings does not make the absolute claim any more', () => {
  const src = readFileSync(join(import.meta.dirname, '..', '..', 'src', 'pages', 'Settings.tsx'), 'utf-8')
  for (const lie of ['Nothing is sent to our servers', 'All your data is stored locally']) {
    assert.equal(src.includes(lie), false,
      `Settings.tsx still claims "${lie}", which is false for any signed-in student. ` +
      'Render privacyHeadline()/activeFlows() from src/lib/privacy.core.js instead.')
  }
})

test('local mode with telemetry off is the only state that gets the strong claim', () => {
  const strong = privacyHeadline({ signedIn: false, telemetry: false })
  assert.match(strong, /Nothing leaves this device/)

  for (const state of [
    { signedIn: true, telemetry: false },
    { signedIn: true, telemetry: true },
    { signedIn: false, telemetry: true },
  ]) {
    assert.doesNotMatch(privacyHeadline(state), /Nothing leaves this device/,
      'strong claim made in state ' + JSON.stringify(state))
  }
})

test('the strong claim still admits the AI calls', () => {
  // Even offline-ish, a doubt you ask has to reach a model. Saying "nothing
  // leaves" full stop would be the old lie with extra steps.
  assert.match(privacyHeadline({ signedIn: false, telemetry: false }), /except what you ask the AI/)
})

test('signing in surfaces the twin backup, signing out hides it', () => {
  const out = activeFlows({ signedIn: false }).map(f => f.id)
  const inn = activeFlows({ signedIn: true }).map(f => f.id)
  assert.equal(out.includes('twin'), false)
  assert.equal(out.includes('account'), false)
  assert.equal(inn.includes('twin'), true)
  assert.equal(inn.includes('account'), true)
})

test('AI and media flows apply to everyone, signed in or not', () => {
  for (const signedIn of [true, false]) {
    const ids = activeFlows({ signedIn }).map(f => f.id)
    assert.equal(ids.includes('ai'), true, 'ai missing when signedIn=' + signedIn)
    assert.equal(ids.includes('media'), true, 'media missing when signedIn=' + signedIn)
  }
})

test('turning telemetry off removes it from the list, and only it', () => {
  const on  = activeFlows({ signedIn: true, telemetry: true }).map(f => f.id)
  const off = activeFlows({ signedIn: true, telemetry: false }).map(f => f.id)
  assert.equal(on.includes('telemetry'), true)
  assert.equal(off.includes('telemetry'), false)
  assert.deepEqual(on.filter(id => id !== 'telemetry'), off,
    'the telemetry switch must not quietly change anything else')
})

test('school data is only listed for school-mode students', () => {
  assert.equal(activeFlows({ signedIn: true, schoolMode: false }).map(f => f.id).includes('school'), false)
  assert.equal(activeFlows({ signedIn: true, schoolMode: true }).map(f => f.id).includes('school'), true)
})

test('ops is never shown — it carries nothing about the student', () => {
  for (const state of [{ signedIn: true, schoolMode: true }, { signedIn: false }]) {
    assert.equal(activeFlows(state).some(f => f.category === 'ops'), false)
  }
})

test('only flows a student can genuinely switch off are marked optional', () => {
  // If this list grows, a real switch has to exist for the new entry.
  assert.deepEqual(DATA_FLOWS.filter(f => f.optional).map(f => f.id), ['telemetry'])
})

test('every flow says what, when and where in plain words', () => {
  for (const f of DATA_FLOWS) {
    for (const field of ['what', 'when', 'where']) {
      assert.equal(typeof f[field], 'string', `${f.id}.${field}`)
      assert.ok(f[field].length > 8, `${f.id}.${field} is too vague to be useful: "${f[field]}"`)
    }
  }
})
