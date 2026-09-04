/**
 * XP rewards the right thing -- and only the published things.
 *
 * The old table paid for asking Kyno questions (farmable, and an API call per
 * reward), for opening labs, for generating cards. These tests pin the new
 * table to the brief and make sure no screen quietly reintroduces a reward for
 * opening the app, asking, or time spent.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { xpFor } from '../../src/lib/practice.core.js'

const SRC = join(import.meta.dirname, '..', '..', 'src')
const game = readFileSync(join(SRC, 'lib', 'game.ts'), 'utf-8')

const TABLE = { card_retained: 5, pattern_beaten: 50, session_done: 20, written_graded: 15, chapter_70: 40 }

test('the XP table is exactly the five published actions with the published amounts', () => {
  const block = game.slice(game.indexOf('export const XP_ACTIONS'), game.indexOf('} as const', game.indexOf('export const XP_ACTIONS')))
  const found = Object.fromEntries([...block.matchAll(/(\w+):\s*\{ xp:\s*(\d+)/g)].map(m => [m[1], Number(m[2])]))
  assert.deepEqual(found, TABLE)
  for (const [action, xp] of Object.entries(TABLE)) {
    assert.match(game, new RegExp(`action: '${action}',\\s*xp: ${xp},\\s*line: '`), `${action} is published in XP_RULES with ${xp}`)
  }
  assert.match(game, /Nothing for opening the app, asking questions, or time spent\./)
})

test('there is no back door: no arbitrary-amount grant, no bonus on daily goals', () => {
  assert.doesNotMatch(game, /export function awardXPAmount/)
  const quests = game.slice(game.indexOf('const QUEST_POOL'), game.indexOf(']', game.indexOf('const QUEST_POOL')))
  for (const m of quests.matchAll(/bonus:\s*(\d+)/g)) assert.equal(Number(m[1]), 0)
  for (const m of quests.matchAll(/action:\s*'(\w+)'/g)) assert.ok(m[1] in TABLE, `${m[1]} is a published action`)
})

test('no screen awards XP for asking, opening, planning, generating or battling', () => {
  const retired = ["'chat_answer'", "'flashcard_rev'", "'flashcard_gen'", "'quiz_done'", "'lab_open'", "'topic_plan'", "'exam_plan'", "'note_built'", 'awardXPAmount(']
  const walk = dir => readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)])
  const files = walk(SRC).filter(f => /\.(ts|tsx)$/.test(f))
  const offenders = []
  for (const f of files) {
    const src = readFileSync(f, 'utf-8')
    for (const r of retired) if (src.includes(r)) offenders.push(`${f.slice(SRC.length)}: ${r}`)
  }
  assert.deepEqual(offenders, [])
})

test('the practice results screen shows the same number the table pays', () => {
  assert.equal(xpFor({ retained: 4, written: 1, teach: 1, finished: true }), 20 + 4 * 5 + 15 + 15)
  assert.equal(xpFor({ cards: 50, questions: 20, correct: 20, finished: true }), 20, 'seen and answered are not kept')
})
