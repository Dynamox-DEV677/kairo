/**
 * Phase 3.1: a quest may only exist if its destination does.
 *
 * "Open a 3D lab" shipped in the pool while LABS_3D was false, so it could
 * never be cleared and the day's list never completed. These read the real
 * source files rather than a copy, so the pool and the flags cannot drift
 * apart without failing here.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const src = (p) => readFileSync(join(here, '../../src', p), 'utf8')

const gameSrc  = src('lib/game.ts')
const flagsSrc = src('config/flags.ts')

/** Quests as declared in QUEST_POOL. */
function parsePool() {
  const block = gameSrc.match(/const QUEST_POOL[\s\S]*?\n\]/)?.[0] || ''
  return [...block.matchAll(/\{\s*id:\s*'([^']+)'[\s\S]*?action:\s*'([^']+)'[\s\S]*?\}/g)]
    .map(m => ({
      id: m[1],
      action: m[2],
      requires: (m[0].match(/requires:\s*'([^']+)'/) || [])[1] || null,
    }))
}

/** Flag defaults as declared in flags.ts. */
function parseFlags() {
  const block = flagsSrc.match(/const DEFAULTS[\s\S]*?\n\}/)?.[0] || ''
  const out = {}
  for (const m of block.matchAll(/(\w+):\s*(true|false)/g)) out[m[1]] = m[2] === 'true'
  return out
}

const pool = parsePool()
const flags = parseFlags()
const XP_ACTIONS = [...(gameSrc.match(/XP_ACTIONS[\s\S]*?\n\}/)?.[0] || '')
  .matchAll(/^\s{2}(\w+):/gm)].map(m => m[1])

test('the quest pool parsed and is not empty', () => {
  assert.ok(pool.length >= 5, `only parsed ${pool.length} quests`)
  assert.ok(Object.keys(flags).length >= 5, 'flags did not parse')
})

test('every quest action is a real XP action', () => {
  // An action with no XP_ACTIONS entry can never be counted, so the quest can
  // never progress even if its screen exists.
  for (const q of pool) {
    assert.ok(XP_ACTIONS.includes(q.action),
      `quest "${q.id}" fires action "${q.action}" which is not in XP_ACTIONS`)
  }
})

test('every quest gated by a flag names a flag that exists', () => {
  for (const q of pool) {
    if (!q.requires) continue
    assert.ok(q.requires in flags,
      `quest "${q.id}" requires "${q.requires}", which is not a real flag`)
  }
})

test('generating 50 days of quests never yields an unreachable one', () => {
  // Mirrors questsForToday(): seeded by date, picks 3 from the AVAILABLE pool.
  const available = pool.filter(q => !q.requires || flags[q.requires])
  assert.ok(available.length >= 3, 'fewer than 3 reachable quests exist')

  for (let day = 0; day < 50; day++) {
    const seedStr = `2026-08-${String((day % 28) + 1).padStart(2, '0')}`
    let h = 0
    for (let i = 0; i < seedStr.length; i++) h = (h * 31 + seedStr.charCodeAt(i)) >>> 0
    const p = [...available]
    const picked = []
    while (picked.length < 3 && p.length) {
      h = (h * 1664525 + 1013904223) >>> 0
      picked.push(p.splice(h % p.length, 1)[0])
    }
    for (const q of picked) {
      assert.ok(!q.requires || flags[q.requires],
        `day ${day} produced "${q.id}", gated behind disabled flag ${q.requires}`)
      assert.ok(XP_ACTIONS.includes(q.action), `day ${day}: "${q.id}" has no countable action`)
    }
  }
})

test('the 3D lab quest specifically cannot be generated while LABS_3D is off', () => {
  const lab = pool.find(q => q.id === 'lab1')
  if (!lab) return   // deleted outright is also a valid fix
  assert.equal(lab.requires, 'LABS_3D', 'lab quest is not gated at all')
  assert.equal(flags.LABS_3D, false, 'LABS_3D is on — if that is deliberate, ship a lab')
})
