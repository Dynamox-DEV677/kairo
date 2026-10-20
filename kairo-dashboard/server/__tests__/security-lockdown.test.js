/**
 * The 2026-10-20 security check, pinned.
 *
 * Found from outside and in the code: the user_profile view answered the
 * public anon key with 28 users' profiles; any account could set its own role
 * to admin; anyone with the school passcode became an active teacher; a
 * suspended account kept API access; thirteen NeDB routes took school_id from
 * the request; names went into email HTML unescaped; two security codes came
 * from Math.random. Each test below fails if its fix is undone.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ownSchoolOnly, ownSchoolParam, ownUserOnly, ownSchoolId } from '../middleware/ownSchool.js'

const ROOT = join(import.meta.dirname, '..', '..')
const read = (...p) => readFileSync(join(ROOT, ...p), 'utf-8')

function run(mw, req) {
  let status = 200, body = null, nexted = false
  const res = { status(s) { status = s; return this }, json(b) { body = b; return this } }
  mw(req, res, () => { nexted = true })
  return { status, body, nexted, req }
}

test('ownSchoolOnly: the school in the request is always the caller\'s own', () => {
  const r = run(ownSchoolOnly, { user: { id: 'u1' }, schoolId: 'S1', body: { school_id: 'OTHER' }, query: { school_id: 'OTHER' } })
  assert.equal(r.nexted, true)
  assert.equal(r.req.body.school_id, 'S1')
  assert.equal(r.req.query.school_id, 'S1')
})

test('ownSchoolOnly: no shared bucket for students without a school', () => {
  const r = run(ownSchoolOnly, { user: { id: 'u1' }, schoolId: null, body: {}, query: { school_id: 'demo_school' } })
  assert.equal(r.req.query.school_id, 'user:u1')
  assert.equal(ownSchoolId({ user: { id: 'u2' } }), 'user:u2')
})

test('ownSchoolOnly: an operator object instead of a string is refused', () => {
  const r = run(ownSchoolOnly, { user: { id: 'u1' }, schoolId: 'S1', body: {}, query: { school_id: { $ne: 'x' } } })
  assert.equal(r.nexted, false)
  assert.equal(r.status, 400)
})

test('ownSchoolParam and ownUserOnly', () => {
  assert.equal(run(ownSchoolParam('schoolId'), { user: { id: 'u' }, schoolId: 'S1', params: { schoolId: 'S2' } }).status, 403)
  assert.equal(run(ownSchoolParam('schoolId'), { user: { id: 'u' }, schoolId: 'S1', params: { schoolId: 'S1' } }).nexted, true)
  const r = run(ownUserOnly, { user: { id: 'me' }, body: { user_id: 'someone' }, query: { user_id: 'someone' } })
  assert.equal(r.req.body.user_id, 'me')
  assert.equal(r.req.query.user_id, 'me')
})

test('every NeDB route that took school_id from the request is guarded', () => {
  for (const f of ['quiz', 'concept', 'formula', 'grading', 'announcement', 'gamification', 'analytics',
                   'attendance', 'timetable', 'students', 'fees', 'emails', 'credentials']) {
    assert.match(read('server', 'routes', `${f}.js`), /router\.use\(ownSchoolOnly\)/, f)
  }
  assert.match(read('server', 'routes', 'gamification.js'), /router\.use\(ownUserOnly\)/)
  const creds = read('server', 'routes', 'credentials.js')
  assert.match(creds, /router\.get\('\/:schoolId', ownSchoolParam\('schoolId'\)/)
  assert.match(creds, /router\.delete\('\/:schoolId', ownSchoolParam\('schoolId'\)/)
})

test('suspended accounts are refused, and a role is only a power once approved', () => {
  const auth = read('server', 'middleware', 'supabaseAuth.js')
  assert.match(auth, /profile\.status === 'suspended'/)
  assert.match(auth, /req\.user\.status && req\.user\.status !== 'active'/)
})

test('a teacher joining with the school passcode waits for the admin', () => {
  const src = read('server', 'routes', 'usersV2.js')
  assert.match(src, /effectiveRole !== 'student' \? 'pending'/)
  assert.match(src, /req\.user\.role !== 'student' \? 'pending'/)
})

test('the database lockdown covers all four holes', () => {
  const sql = read('server', 'db', '2026-10-20_security_lockdown.sql')
  assert.match(sql, /'user_profile', 'parent_profile', 'active_notifications'/)
  assert.match(sql, /set \(security_invoker = true\)/)
  assert.match(sql, /revoke all on public\.%I from anon, authenticated/)
  assert.match(sql, /before insert or update on public\.users/)
  assert.match(sql, /'role', 'student', 'school_id', null/)
  assert.match(sql, /alter table public\.kairo_otps enable row level security/)
  assert.doesNotMatch(sql, /disable row level security/i)
})

test('names in email HTML are escaped', async () => {
  const m = await import('../email/templates/schoolCreated.js')
  const render = Object.values(m).find(f => typeof f === 'function' && /Html/.test(f.name))
  const html = render({ name: 'A', schoolName: '<img src=x onerror=alert(1)>', joinCode: 'ABC', plan: 'trial', trial: true })
  assert.ok(!html.includes('<img src=x'), 'raw markup reached the email')
  assert.ok(html.includes('&lt;img src=x'))
})

test('security codes come from crypto, not Math.random', () => {
  assert.match(read('server', 'routes', 'account.js'), /crypto\.randomInt\(100000, 1_000_000\)/)
  const parent = read('server', 'routes', 'parent.js')
  assert.match(parent, /chars\[crypto\.randomInt\(chars\.length\)\]/)
  assert.doesNotMatch(parent, /Code generated for student \$\{req\.user\.id\}: \$\{code\}/, 'the code is not logged')
})
