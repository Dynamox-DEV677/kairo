/**
 * A screen must not die on a temporal dead zone.
 *
 * Four space roots rendered the error boundary with "Cannot access 'I' before
 * initialization". The cause was a hook whose dependency array named a `const`
 * declared further down the same component. It only bites after the bundler
 * hoists and minifies, so the dev server never showed it and only a PRODUCTION
 * build reproduced it.
 *
 * This scans for exactly that shape. It was a tsc run first, which was correct
 * but took ten minutes and made the whole suite unusable -- a guard nobody can
 * afford to run is not a guard.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(import.meta.dirname, '..', '..')
const SRC = join(ROOT, 'src')
const read = (...p) => readFileSync(join(ROOT, ...p), 'utf-8')
const walk = d => readdirSync(d).flatMap(n => {
  const p = join(d, n)
  return statSync(p).isDirectory() ? walk(p) : [p]
})

test('no hook dependency names a const declared below it', () => {
  const offenders = []
  for (const file of walk(SRC).filter(f => /[.]tsx?$/.test(f) && !/[.]d[.]ts$/.test(f))) {
    const lines = readFileSync(file, 'utf-8').split('\n')
    // where each top-level const in a component is declared
    const declaredAt = new Map()
    lines.forEach((l, i) => {
      const m = l.match(/^\s{2}const (\w+) = (?:useCallback|useMemo|useRef|useState)\(/)
      if (m && !declaredAt.has(m[1])) declaredAt.set(m[1], i)
    })
    lines.forEach((l, i) => {
      for (const m of l.matchAll(/}, *\[([^\]]*)\]\)/g)) {
      for (const raw of m[1].split(',')) {
        const dep = raw.trim().split('.')[0]
        if (!dep) continue
        const at = declaredAt.get(dep)
        if (at != null && at > i) {
          offenders.push(file.slice(ROOT.length + 1) + ':' + (i + 1) + '  [' + dep + '] declared at line ' + (at + 1))
        }
      }
      }
    })
  }
  assert.deepEqual(offenders, [],
    'these crash the screen in a production build, where the dev server hides them:' + '\n' + '  ' + offenders.join('\n' + '  '))
})

test('the error boundary gives the student something to act on', () => {
  const src = read('src', 'components', 'ErrorBoundary.tsx')
  assert.match(src, /Reference/, 'a reference id they can read out')
  assert.match(src, /this[.]state[.]message/, 'and the error text itself')
  assert.match(src, /copyDetails/, 'and a way to copy both')
  assert.match(src, /ref: this[.]state[.]ref/, 'the same id goes to the server report')
  assert.doesNotMatch(src, /⚠/, 'inline SVG, not an emoji')
})

test('chunk splitting never claims our own source', () => {
  const cfg = read('vite.config.ts')
  const fn = cfg.slice(cfg.indexOf('manualChunks'), cfg.indexOf('manualChunks') + 1200)
  assert.match(fn, /if [(]!id[.]includes[(]'node_modules'[)][)] return undefined/,
    "these are substring matches: src/lib/katex.ts matched the 'katex' vendor rule")
})
