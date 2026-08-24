/**
 * Audit task 7 enforcement — the build fails if anyone writes or reads a
 * legacy `kairo`-prefixed localStorage key outside src/lib/storage.ts (the
 * one module allowed to know legacy names, for the migration and the
 * transitional read-fallbacks).
 *
 * Scans SOURCE, not runtime: a regression here is a code change, and this is
 * the cheapest place to catch it.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const SRC = join(import.meta.dirname, '..', '..', 'src')
const ALLOWED = new Set(['lib/storage.ts'])

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) yield* walk(p)
    else if (/\.(ts|tsx)$/.test(name) && !name.endsWith('.d.ts')) yield p
  }
}

const OFFENDING = /localStorage\s*\.\s*(getItem|setItem|removeItem)\s*\(\s*['"`]kairo/

test('no localStorage access to kairo-prefixed keys outside storage.ts', () => {
  const hits = []
  for (const file of walk(SRC)) {
    const rel = file.slice(SRC.length + 1).replace(/\\/g, '/')
    if (ALLOWED.has(rel)) continue
    const lines = readFileSync(file, 'utf-8').split('\n')
    lines.forEach((line, i) => {
      if (OFFENDING.test(line)) hits.push(`${rel}:${i + 1}  ${line.trim().slice(0, 90)}`)
    })
  }
  assert.deepEqual(hits, [], `legacy kairo key access found:\n${hits.join('\n')}`)
})

test('no NEW kairo-prefixed literals fed to the storage helpers either', () => {
  // getRaw('kairo:…') / setRaw('kairo:…') sneaking back in defeats the
  // migration just as surely as raw localStorage would.
  const RE = /\b(getRaw|setRaw|removeRaw|getJSON|setJSON)\s*\(\s*['"`]kairo/
  const hits = []
  for (const file of walk(SRC)) {
    const rel = file.slice(SRC.length + 1).replace(/\\/g, '/')
    if (ALLOWED.has(rel)) continue
    const lines = readFileSync(file, 'utf-8').split('\n')
    lines.forEach((line, i) => {
      if (RE.test(line)) hits.push(`${rel}:${i + 1}  ${line.trim().slice(0, 90)}`)
    })
  }
  assert.deepEqual(hits, [], `legacy-key helper usage found:\n${hits.join('\n')}`)
})
