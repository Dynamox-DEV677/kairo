/**
 * A forced-border class must not sit on a button with no padding.
 *
 * .kyno-ghost / .kyno-danger / .kyno-chunky set their border and radius with
 * !important — deliberately, so one definition reaches every call site. But
 * none of them sets padding. So a button that inherited the class while keeping
 * an inline `padding: 0` (because it used to be a plain text link) gets a
 * 1.5px purple border clamped straight onto the glyphs. That is what Settings'
 * "Change photo" looked like, and 26 other buttons had it too — including bare
 * close icons, where it drew a box around an X.
 *
 * The rule is narrow on purpose. A button wearing one of these classes WITH
 * real padding is the canon and is left alone; only the zero-padding case is a
 * defect.
 *
 * Note the tag walker. A regex that stops at the first '>' truncates on
 * `onClick={() => x}` — which is how the originally-reported button escaped the
 * first pass of this very check.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const SRC = join(import.meta.dirname, '..', '..', 'src')
const FORCED = ['kyno-ghost', 'kyno-danger', 'kyno-chunky']

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) yield* walk(p)
    else if (/\.tsx$/.test(name)) yield p
  }
}

/** Every <button ...> opening tag, brace- and quote-aware. */
function* buttonTags(src) {
  const re = /<button\b/g
  let m
  while ((m = re.exec(src))) {
    let i = re.lastIndex, depth = 0, quote = null
    while (i < src.length) {
      const c = src[i]
      if (quote) {
        if (c === quote && src[i - 1] !== '\\') quote = null
      } else if (c === '"' || c === "'" || c === '`') quote = c
      else if (c === '{') depth++
      else if (c === '}') depth--
      else if (c === '>' && depth === 0 && src[i - 1] !== '=') {
        yield { start: m.index, tag: src.slice(re.lastIndex, i) }
        break
      }
      i++
    }
  }
}

/** Zero-ish padding means the class's border lands on the text. */
function isClamped(tag) {
  const m = tag.match(/padding:\s*'([^']*)'|padding:\s*(\d+)/)
  if (!m) return true
  if (m[2] !== undefined) return Number(m[2]) <= 4
  return m[1].split(/\s+/).every(v => v === '0' || v === '0px')
}

test('no button wears a forced-border class with no padding to hold it off the text', () => {
  const offenders = []

  for (const file of walk(SRC)) {
    const rel = file.slice(SRC.length + 1).replace(/\\/g, '/')
    const src = readFileSync(file, 'utf-8')

    for (const { start, tag } of buttonTags(src)) {
      if (!/border:\s*'none'/.test(tag)) continue
      const cls = FORCED.find(c =>
        new RegExp(`className=(?:"|\\{\`|')[^"'\`]*\\b${c}\\b`).test(tag))
      if (!cls || !isClamped(tag)) continue
      offenders.push(`${rel}:${src.slice(0, start).split('\n').length}  .${cls}`)
    }
  }

  assert.deepEqual(offenders, [],
    'These buttons carry a class whose border is !important, but have no padding, ' +
    'so the border clamps onto the text. They are text links or bare icons — drop ' +
    'the class and let the inline styles stand:\n  ' + offenders.join('\n  '))
})
