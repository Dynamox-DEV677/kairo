/**
 * The one on/off switch, and it must read at a glance on a phone.
 *
 * These control privacy -- who sees you in a league, whether you appear in a
 * study room -- so an ambiguous switch is not a cosmetic problem.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(import.meta.dirname, '..', '..')
const src = readFileSync(join(ROOT, 'src', 'components', 'Switch.tsx'), 'utf-8')

test('the switch is fixed pixels, never a percentage', () => {
  assert.ok(src.includes('const TRACK_W = 42'))
  assert.ok(src.includes('const TRACK_H = 25'))
  assert.ok(src.includes('const KNOB = 19'))
  assert.ok(src.includes('const PAD = 3'))
  // A percentage in SIZING or POSITION is what resolves differently at 375px
  // than at 390px. borderRadius: '50%' is just a circle, so drop those first.
  const withoutRadii = src.replace(/borderRadius: '[^']*'/g, '')
  assert.ok(!withoutRadii.includes('%'), 'no percentage may drive size or position')
})

test('on and off differ in POSITION and in CONTRAST', () => {
  // the old one put a mid-grey knob on a mid-grey track, so at phone width
  // it read as a blob in the middle rather than a knob parked at one end
  assert.ok(src.includes("SWITCH_ON_TRACK = '#7C5CFF'"))
  assert.ok(src.includes("SWITCH_OFF_TRACK = '#2A2A3C'"))
  assert.ok(src.includes("SWITCH_OFF_KNOB = '#7E7E96'"))
  assert.ok(src.includes("justifyContent: on ? 'flex-end' : 'flex-start'"), 'one mechanism for movement')
})

test('it is a real switch, not a div that looks like one', () => {
  assert.ok(src.includes("role=\"switch\""))
  assert.ok(src.includes('aria-checked={on}'))
  assert.ok(src.includes('aria-label={label}'))
})

test('the 44px touch target survives the 25px pill', () => {
  // a global rule gives every button a 44px minimum, which stretched the
  // pill and is what made the knob look stranded in an over-tall track
  assert.ok(src.includes('TWO boxes on purpose'), 'the reason is written down')
  assert.ok(src.includes("background: 'none', border: 'none', padding: 0"), 'the button is invisible')
})

test('every toggle in the app is this one', () => {
  const walk = d => readdirSync(d).flatMap(n => {
    const p = join(d, n)
    return statSync(p).isDirectory() ? walk(p) : [p]
  })
  const SRC = join(ROOT, 'src')
  const offenders = []
  for (const f of walk(SRC).filter(f => f.endsWith('.tsx'))) {
    if (f.endsWith('Switch.tsx')) continue
    const s = readFileSync(f, 'utf-8')
    if (s.includes('role="switch"')) offenders.push(f.slice(SRC.length + 1))
  }
  assert.deepEqual(offenders, [], 'a second toggle means fixing one and missing the other')
})
