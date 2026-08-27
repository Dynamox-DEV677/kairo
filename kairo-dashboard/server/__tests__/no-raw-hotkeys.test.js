/**
 * Structural rule: a page may not bind a printable key on `window` by hand.
 *
 * Pages stay mounted when hidden, so a raw window keydown listener outlives the
 * screen that registered it. Reels did this with Space and arrows, and it broke
 * typing across the whole app. useHotkeys (src/lib/useHotkeys.ts) applies both
 * guards; anything else has to prove it only touches keys that can't be text.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const SRC = join(import.meta.dirname, '..', '..', 'src')

/**
 * Keys that are never text, so binding them globally is safe:
 * Escape, and anything gated behind a modifier (Ctrl+K).
 */
const SAFE_KEY = /'(Escape|Tab|F\d{1,2})'|metaKey|ctrlKey|altKey/

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) yield* walk(p)
    else if (/\.(ts|tsx)$/.test(name) && !name.endsWith('.d.ts')) yield p
  }
}

test('no page binds a printable key on window without the typing guard', () => {
  const offenders = []
  for (const file of walk(SRC)) {
    const rel = file.slice(SRC.length + 1).replace(/\\/g, '/')
    if (rel === 'lib/useHotkeys.ts') continue           // the sanctioned one
    const src = readFileSync(file, 'utf-8')

    // Follow only what is actually registered on window/document. A keydown
    // prop on a JSX element (Enter-to-send in a textarea) is correctly scoped
    // to that element and is none of this rule's business.
    for (const reg of src.matchAll(/(?:window|document)\.addEventListener\(\s*['"]keydown['"]\s*,\s*(\w+)/g)) {
      const name = reg[1]
      const decl = new RegExp(
        '(?:const|let)\\s+' + name + '\\s*=\\s*(?:\\([^)]*\\)|\\w+)\\s*=>\\s*\\{([\\s\\S]*?)\\n\\s*\\}' +
        '|function\\s+' + name + '\\s*\\([^)]*\\)\\s*\\{([\\s\\S]*?)\\n\\s*\\}')
      const m = src.match(decl)
      if (!m) continue
      const body = m[1] ?? m[2] ?? ''
      if (!/\be\.key\b|\bevent\.key\b/.test(body)) continue
      if (SAFE_KEY.test(body)) continue                  // Escape / modifier combos only
      const guarded = /isTypingTarget|shouldHandleHotkey|tagName\s*===\s*'INPUT'|tagName\s*===\s*'TEXTAREA'|isContentEditable/.test(body)
      if (!guarded) offenders.push(rel + '  (' + name + ')  ->  ' + body.trim().split('\n')[0].slice(0, 80))
    }
  }
  assert.deepEqual(offenders, [],
    'raw window keydown handlers binding printable keys - use useHotkeys(handler, { containerRef }) ' +
    'from src/lib/useHotkeys.ts instead:\n' + offenders.join('\n'))
})
