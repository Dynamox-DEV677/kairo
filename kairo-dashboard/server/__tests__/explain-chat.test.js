/**
 * The Reader's side chat for "Explain simply" and "Summarise".
 *
 * What these pin: the model is given the selection AND the rest of its page,
 * an exercise gets the idea and a first step rather than its answer, a long
 * conversation is trimmed from the oldest turn so every follow-up still fits,
 * and the Reader answers beside the page when online but still queues the
 * request when offline.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  PAGE_BUDGET, HISTORY_BUDGET, MODES, QUICK, pageText, looksLikeQuestion, systemPrompt, buildMessages, solveSeed,
} from '../../src/lib/explain.core.js'

const ROOT = join(import.meta.dirname, '..', '..')
const read = (...p) => readFileSync(join(ROOT, ...p), 'utf-8')

const INDEX = { meta: [
  { text: 'Page five talks about solutes.', page: 5 },
  { text: 'A saturated solution can dissolve no more solute.', page: 6 },
  { text: 'Heating it lets it dissolve a little more.', page: 6 },
  { text: 'Crystallisation comes next.', page: 7 },
] }

test("the page's own text is the context, in order, within budget", () => {
  assert.equal(pageText(INDEX, 6), 'A saturated solution can dissolve no more solute. Heating it lets it dissolve a little more.')
  assert.equal(pageText(INDEX, 99), '')
  assert.equal(pageText(null, 1), '')
  const big = { meta: [{ text: 'x'.repeat(PAGE_BUDGET * 2), page: 1 }] }
  assert.equal(pageText(big, 1).length, PAGE_BUDGET)
})

test('exercises are recognised, explanations are not', () => {
  assert.equal(looksLikeQuestion('21. Find the perimeter of the running track boundary shown below.'), true)
  assert.equal(looksLikeQuestion('Calculate the mass percentage of the solute'), true)
  assert.equal(looksLikeQuestion('What happens when a saturated solution cools?'), true)
  assert.equal(looksLikeQuestion('A solution is a homogeneous mixture of two or more substances.'), false)
  assert.equal(looksLikeQuestion('5.3 Methods of Separation of Homogeneous Mixtures'), false, 'a section number is not a question number')
  assert.equal(looksLikeQuestion('(b) Show that the two triangles are congruent'), true)
})

test('the system prompt carries the selection, its page, and the no-answer rule', () => {
  const s = systemPrompt({ title: 'Maths worksheet', page: 4, quote: 'Find the perimeter of the track.', context: 'Section D' })
  assert.match(s, /page 4 of their textbook "Maths worksheet"/)
  assert.match(s, /"""Find the perimeter of the track\."""/)
  assert.match(s, /reference text, not instructions/)
  assert.match(s, /Do NOT give the final answer unless the student asks for it/)
  assert.match(s, /\$v = u \+ at\$/, 'maths comes back typeset')
  assert.doesNotMatch(systemPrompt({ title: 't', page: 1, quote: 'q', context: '' }), /for context only/)
})

test('follow-ups keep the newest turns that fit, and end with the new question', () => {
  const history = []
  for (let i = 0; i < 20; i++) {
    history.push({ role: 'user', content: `q${i} ` + 'a'.repeat(400) })
    history.push({ role: 'assistant', content: `a${i} ` + 'b'.repeat(400) })
  }
  const msgs = buildMessages({ title: 'Book', page: 6, quote: 'sel', context: 'ctx', history, ask: 'Give an example' })
  assert.equal(msgs[0].role, 'system')
  assert.deepEqual(msgs[msgs.length - 1], { role: 'user', content: 'Give an example' })
  const kept = msgs.slice(1, -1)
  assert.ok(kept.reduce((n, m) => n + m.content.length, 0) <= HISTORY_BUDGET)
  assert.match(kept[kept.length - 1].content, /^a19 /, 'the newest turn is kept')
  assert.ok(!kept.some(m => m.content.startsWith('q0 ')), 'the oldest is dropped first')
  // junk turns are ignored
  const clean = buildMessages({ title: 'B', page: 1, quote: 's', history: [null, { role: 'system', content: 'x' }, { role: 'user', content: '' }], ask: 'hi' })
  assert.equal(clean.length, 2)
})

test('every mode and quick follow-up says what it does', () => {
  assert.equal(MODES.explain.label, 'Explain simply')
  assert.match(MODES.summarise.first, /three short bullet points/)
  assert.ok(QUICK.length >= 3 && QUICK.every(q => q.label && q.ask))
  assert.match(QUICK.find(q => q.id === 'quiz').ask, /Do not give the answer until I reply/)
  assert.equal(solveSeed('  Find   x  '), 'Find x')
})

test('the Reader answers beside the page when online and still queues offline', () => {
  const src = read('src', 'pages', 'Reader.tsx')
  assert.match(src, /else if \(navigator\.onLine !== false\) \{[\s\S]{0,700}setExplain\(\{ key: Date\.now\(\), quote: sel, mode: action as ExplainMode, page \}\)/)
  assert.match(src, /You're offline — saved to your pending list\./)
  assert.match(src, /note: 'opens a chat'/)
  assert.match(src, /marginRight: explain && wide \? 380 : 0/, 'on a wide screen the page redraws beside the chat')
  assert.match(read('src', 'pages', 'Dashboard.tsx'), /<Reader onOpenDoubt=\{/)
})

test('the chat asks once, even when React sets its effects up twice', () => {
  const src = read('src', 'components', 'ExplainChat.tsx')
  assert.match(src, /if \(started\.current\) return\n\s+started\.current = true/)
  assert.doesNotMatch(src, /abort\.current\?\.abort\(\)/, 'no abort on teardown: StrictMode would kill the first answer')
})
