/**
 * No Supabase call may fail silently.
 *
 * An RLS policy on users began recursing, every request started returning 500,
 * and the app went on looking healthy for weeks because one `catch {}` threw
 * the error away. Persistence was dead and nothing said so.
 *
 * This test makes that specific mistake impossible to repeat: a client-side
 * Supabase call must go through tracked(), which logs the table, the operation
 * and the message, and drives the "not synced" indicator.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const SRC = join(import.meta.dirname, '..', '..', 'src')
const read = (...p) => readFileSync(join(SRC, ...p), 'utf-8')

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) yield* walk(p)
    else if (/\.tsx?$/.test(name) && !name.endsWith('.d.ts')) yield p
  }
}

test('every client Supabase table call is wrapped in tracked()', () => {
  const offenders = []
  for (const file of walk(SRC)) {
    const rel = file.slice(SRC.length + 1).replace(/\\/g, '/')
    if (rel === 'lib/dbError.ts') continue
    const src = readFileSync(file, 'utf-8')
    src.split('\n').forEach((line, i) => {
      if (!/supabase\s*\n?\s*\.?from\(|supabase\.from\(/.test(line)) return
      // the call, or the tracked() that opened a few lines above it
      const window = src.split('\n').slice(Math.max(0, i - 4), i + 1).join('\n')
      if (!/tracked\(/.test(window)) offenders.push(`${rel}:${i + 1}  ${line.trim().slice(0, 100)}`)
    })
  }
  assert.deepEqual(offenders, [],
    'these Supabase calls can still fail silently — wrap them in tracked() from src/lib/dbError.ts:\n  ' + offenders.join('\n  '))
})

test('the reporter logs the table, the operation and the real message', () => {
  const src = read('lib', 'dbError.ts')
  assert.match(src, /console\.error\(/, 'a failure must reach the console')
  for (const part of ['${op}', '${table}', 'failure.message', 'failure.code']) {
    assert.ok(src.includes(part), `the log line is missing ${part}`)
  }
  assert.match(src, /export function reportDbError/)
  assert.match(src, /export async function tracked/)
})

test('the indicator only ever claims what is true', () => {
  const src = read('components', 'SyncIndicator.tsx')
  assert.match(src, /Not synced/)
  assert.match(src, /saved on this device only/i, 'it must say where the work actually is')
  assert.doesNotMatch(src, /All changes saved|Saved to cloud/i, 'never claim a save the server did not confirm')
  // it stays out of the way while things work
  assert.match(src, /if \(state !== 'error'[\s\S]{0,60}return null/)
})

test('the boot path reports both the read and the write', () => {
  const app = read('App.tsx')
  assert.match(app, /tracked(<any>)?\('users', 'select'/)
  assert.match(app, /tracked(<any>)?\('users', 'upsert'/)
  assert.match(app, /<SyncIndicator \/>/)
})

test('the RLS fix is in the repo and keeps row level security ON', () => {
  const sql = readFileSync(join(SRC, '..', 'server', 'db', '2026-09-04_fix_users_rls_recursion.sql'), 'utf-8')
  assert.match(sql, /42P17/, 'the migration records the error it fixes')
  assert.match(sql, /security definer/i, 'the recursion is broken with a SECURITY DEFINER lookup')
  assert.match(sql, /alter table public\.users enable row level security/i)
  assert.doesNotMatch(sql, /alter table public\.users\s+disable row level security/i,
    'disabling RLS would expose children\'s data to anyone holding the anon key')
  assert.match(sql, /auth\.uid\(\) = id/, 'self-access is a direct comparison, never a subquery on users')
})
