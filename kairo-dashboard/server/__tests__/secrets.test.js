/**
 * A0b — no guessable secret may ever be accepted.
 *
 * These read the source rather than importing it, because the failure mode is
 * a literal string sitting in the repo: if someone reintroduces a fallback,
 * the module would still import and behave fine, and only a reader would
 * notice. A test that greps is the right shape for this one.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))

/**
 * Source with comments stripped.
 *
 * The comments in these files deliberately QUOTE the old secrets, to explain
 * what was wrong and stop someone reinstating them. Grepping raw source would
 * flag that documentation as the vulnerability — so strip comments first and
 * assert against code only.
 */
const read = (p) =>
  readFileSync(join(here, '..', p), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')     // block comments
    .replace(/(^|[^:])\/\/.*$/gm, '$1')   // line comments, sparing http://

test('JWT_SECRET has no hardcoded fallback', () => {
  const src = read('middleware/auth.js')
  assert.ok(!/kairo-dev-secret/.test(src), 'the old dev secret is back in the source')
  assert.ok(
    !/JWT_SECRET\s*\|\|\s*['"`][a-z]/i.test(src),
    'JWT_SECRET falls back to a string literal',
  )
})

test('every JWT entry point refuses to run without a secret', () => {
  const src = read('middleware/auth.js')
  for (const fn of ['requireAuth', 'optionalAuth', 'signToken']) {
    const body = src.slice(src.indexOf(`export function ${fn}`))
    assert.match(body.slice(0, 400), /!JWT_SECRET/, `${fn} does not guard on a missing secret`)
  }
})

test('signToken refuses to mint rather than signing with a weak key', () => {
  const src = read('middleware/auth.js')
  const body = src.slice(src.indexOf('export function signToken'))
  assert.match(body.slice(0, 300), /throw new Error/, 'signToken does not throw on a missing secret')
})

test('ENCRYPTION_SECRET is never overwritten with a default at boot', () => {
  const src = read('app.js')
  assert.ok(
    !/process\.env\.ENCRYPTION_SECRET\s*=/.test(src),
    'app.js assigns ENCRYPTION_SECRET — a fixed value in the repo becomes the live key',
  )
  assert.ok(!/kairo-default-secret-key/.test(src), 'the old default is back')
})

test('password-reset tokens are not signed with a fallback secret', () => {
  // Account recovery is the one path that must never be guessable.
  const src = read('routes/passwordReset.js')
  assert.ok(!/kairo-default-secret/.test(src), 'the forgeable reset secret is back')
  assert.match(src, /throw new Error/, 'resetSecret() does not throw when unset')
})

test('both reset routes are gated so a missing secret is 503, not a crash', () => {
  const src = read('routes/passwordReset.js')
  const routes = [...src.matchAll(/router\.post\('\/(forgot|reset)-password',\s*(\w+)/g)]
  assert.equal(routes.length, 2, 'expected both reset routes')
  for (const m of routes) {
    assert.equal(m[2], 'needsSecret', `/${m[1]}-password is not wrapped in needsSecret`)
  }
})
