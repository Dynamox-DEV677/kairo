/**
 * A screen must not die on a temporal dead zone.
 *
 * Four space roots rendered the error boundary with "Cannot access 'I' before
 * initialization". The cause was an effect whose dependency array named a
 * `const` declared further down the same component -- a use-before-declaration
 * that only bites once the bundler has hoisted and minified, so the dev server
 * never showed it and only a PRODUCTION build reproduced it.
 *
 * TypeScript knew the whole time. It reports TS2448/TS2454 and the error was
 * lost among the pre-existing noise. This test pulls exactly that class out so
 * it cannot hide again.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(import.meta.dirname, '..', '..')

test('no block-scoped variable is used before its declaration', { timeout: 240000 }, () => {
  let out = ''
  try {
    out = execFileSync('npx', ['tsc', '-b', '--force'], { cwd: ROOT, encoding: 'utf-8', shell: true })
  } catch (e) {
    out = String(e.stdout || '') + String(e.stderr || '')
  }
  const tdz = out.split('\n').filter(l => /error TS2448|error TS2454/.test(l))
  assert.deepEqual(tdz, [],
    'these crash the screen in a production build, where the dev server hides them:' + '\n' + '  ' + tdz.join('\n' + '  '))
})

test('the error boundary gives the student something to act on', () => {
  const src = readFileSync(join(ROOT, 'src', 'components', 'ErrorBoundary.tsx'), 'utf-8')
  assert.match(src, /Reference/, 'a reference id they can read out')
  assert.match(src, /this\.state\.message/, 'and the error text itself')
  assert.match(src, /copyDetails/, 'and a way to copy both')
  assert.match(src, /ref: this\.state\.ref/, 'the same id goes to the server report')
  assert.doesNotMatch(src, /⚠/, 'inline SVG, not an emoji')
})

test('chunk splitting never claims our own source', () => {
  const cfg = readFileSync(join(ROOT, 'vite.config.ts'), 'utf-8')
  const fn = cfg.slice(cfg.indexOf('manualChunks'), cfg.indexOf('manualChunks') + 1200)
  assert.match(fn, /if \(!id\.includes\('node_modules'\)\) return undefined/,
    "these are substring matches: src/lib/katex.ts matched the 'katex' vendor rule")
})
