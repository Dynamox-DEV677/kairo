/**
 * Every AI call must send a token that is still alive.
 *
 * The Solver started answering "Missing Bearer token." about an hour after
 * sign-in. Not an expired token rejected by the server -- no Authorization
 * header at all. The synchronous aiHeaders() read the token from storage and,
 * when it had expired, returned `{}`, so the header was simply absent and
 * requireSupabaseAuth 401'd before any handler ran.
 *
 * aiHeadersAsync() awaits getSession(), which refreshes a near-expiry session,
 * so it cannot produce a headerless request. The sync version is deleted.
 *
 * These pin both halves: the dead helper stays dead, and any page calling an
 * auth-gated AI route actually imports the async one.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const SRC = join(import.meta.dirname, '..', '..', 'src')

/** Routes behind requireSupabaseAuth — a fetch to one of these needs a token. */
const GATED = [
  '/api/ai/',
  '/api/camera/',
  '/api/document/',
  '/api/council',
  '/api/topic-architect',
]

function walk(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out.push(...walk(p))
    else if (name.endsWith('.ts') || name.endsWith('.tsx')) out.push(p)
  }
  return out
}

const files = walk(SRC).map(p => ({ path: p, src: readFileSync(p, 'utf-8') }))

test('the synchronous aiHeaders() is gone and stays gone', () => {
  const offenders = []
  for (const { path, src } of files) {
    src.split('\n').forEach((line, i) => {
      const t = line.trim()
      if (t.startsWith('*') || t.startsWith('//') || t.startsWith('/*')) return
      // aiHeaders( but not aiHeadersAsync(
      if (/\baiHeaders\s*\(/.test(line) && !/\baiHeadersAsync\s*\(/.test(line)) {
        offenders.push(`${path}:${i + 1}  ${t.slice(0, 80)}`)
      }
    })
  }
  assert.deepEqual(offenders, [],
    'aiHeaders() drops the Authorization header once the token expires, which ' +
    'reads to the student as the feature being broken. Use aiHeadersAsync():\n  ' +
    offenders.join('\n  '))
})

test('every page calling a gated AI route imports aiHeadersAsync', () => {
  const offenders = []
  for (const { path, src } of files) {
    const hit = GATED.find(r => src.includes(`'${r}`) || src.includes(`"${r}`) || src.includes(`\`${r}`))
    if (!hit) continue
    if (path.endsWith('devKey.ts')) continue        // defines the helper
    // *-preview.tsx are dev harnesses that STUB fetch for these routes; they
    // never send a request, so they never need a token.
    if (/-preview\.tsx$/.test(path)) continue
    if (!src.includes('aiHeadersAsync')) {
      offenders.push(`${path}  (fetches ${hit} with no session token)`)
    }
  }
  assert.deepEqual(offenders, [],
    'These call an auth-gated AI route without sending a token. The server ' +
    'answers 401 "Missing Bearer token." and the feature is dead:\n  ' +
    offenders.join('\n  '))
})

test('aiHeadersAsync is awaited, never spread as a bare promise', () => {
  // `...aiHeadersAsync()` without await spreads a Promise, which contributes
  // no keys at all -- the same headerless request, with no type error to
  // catch it, because spreading any object is legal.
  const offenders = []
  for (const { path, src } of files) {
    src.split('\n').forEach((line, i) => {
      if (/\.\.\.\s*aiHeadersAsync\s*\(/.test(line) && !/await\s+aiHeadersAsync/.test(line)) {
        offenders.push(`${path}:${i + 1}  ${line.trim().slice(0, 80)}`)
      }
    })
  }
  assert.deepEqual(offenders, [],
    'Spreading the promise instead of its result sends no headers:\n  ' +
    offenders.join('\n  '))
})
