/**
 * Study: "Ask this book", the study guide / FAQ / timeline, and the mind map.
 *
 * What these pin: answers and study items come from the student's own pages
 * and point back into them. A page the model makes up is dropped, never shown
 * as a link; "not in this book" is a real answer; the server's stand-in
 * replies are refused; and every request stays inside Groq's free-tier
 * budget however long the chapter.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { chunkPages, buildIndex, search } from '../../src/lib/search.core.js'
import {
  ASK_BUDGET, DIGEST_CHUNK, STUDIO_BUDGET, MAX_RANGE, NOT_IN_BOOK,
  pagesFromIndex, pagesInRange, clampRange, groupPages, tagPages, planStudio,
  pickPassages, askMessages, parseAnswer, digestMessages, joinNotes,
  studioMessages, parseJson, normalizeGuide, normalizeFaq, normalizeTimeline,
  normalizeMindMap, normalizeStudio, studioKey, repairLatex, formulaTex,
} from '../../src/lib/bookStudio.core.js'
import { chatExtras } from '../lib/chatExtras.js'
import katex from 'katex'

const ROOT = join(import.meta.dirname, '..', '..')
const read = (...p) => readFileSync(join(ROOT, ...p), 'utf-8')

/** A three-page stand-in for a chemistry chapter, indexed exactly as the Reader does it. */
const PAGES = [
  { page: 1, text: 'A mixture contains two or more substances that are not chemically combined. Air is a mixture of gases.' },
  { page: 2, text: 'A solution is a homogeneous mixture. The solute dissolves in the solvent. Salt water is a solution of salt in water.' },
  { page: 3, text: 'Concentration of a solution = mass of solute / mass of solution x 100. A saturated solution can dissolve no more solute at that temperature.' },
]
const passages = chunkPages(PAGES)
const INDEX = buildIndex(passages.map((p, i) => ({ id: `b:${i}`, text: p.text, n: i, page: p.page })))

/* ── pages ───────────────────────────────────────────────────────────────── */

test('the index regroups into the book, page by page, in order', () => {
  const pages = pagesFromIndex(INDEX)
  assert.deepEqual(pages.map(p => p.page), [1, 2, 3])
  assert.match(pages[1].text, /homogeneous mixture/)
  assert.deepEqual(pagesFromIndex(null), [])
  assert.deepEqual(pagesInRange(pages, 2, 3).map(p => p.page), [2, 3])
})

test('a page range is whole, inside the book, the right way round, and capped', () => {
  assert.deepEqual(clampRange(1, 22, 22), { from: 1, to: 22 })
  assert.deepEqual(clampRange(9, 3, 22), { from: 3, to: 9 })
  assert.deepEqual(clampRange(-4, 999, 22), { from: 1, to: 22 })
  assert.deepEqual(clampRange(2.7, 5.2, 22), { from: 2, to: 5 })
  assert.deepEqual(clampRange(NaN, NaN, 10), { from: 1, to: 10 })
  const big = clampRange(10, 200, 300)
  assert.equal(big.to - big.from + 1, MAX_RANGE)
})

test('page-groups never pass the budget and keep the book in order', () => {
  const pages = Array.from({ length: 12 }, (_, i) => ({ page: i + 1, text: 'x'.repeat(2500) }))
  const groups = groupPages(pages, DIGEST_CHUNK)
  for (const g of groups) assert.ok(g.reduce((n, p) => n + p.text.length, 0) <= DIGEST_CHUNK)
  assert.deepEqual(groups.flat().map(p => p.page), pages.map(p => p.page))
  // One enormous page is cut down rather than sent whole.
  const [[huge]] = groupPages([{ page: 1, text: 'y'.repeat(DIGEST_CHUNK * 3) }])
  assert.equal(huge.text.length, DIGEST_CHUNK)
})

test('a short chapter goes straight in; a long one is condensed first', () => {
  const short = planStudio(PAGES)
  assert.equal(short.mode, 'direct')
  assert.match(short.material, /--- page 2 ---/)
  const long = planStudio(Array.from({ length: 20 }, (_, i) => ({ page: i + 1, text: 'z'.repeat(3000) })))
  assert.equal(long.mode, 'digest')
  assert.ok(long.groups.length >= 6)
})

test('condensed notes are fitted into the final prompt evenly', () => {
  const notes = Array.from({ length: 8 }, (_, i) => Array.from({ length: 40 }, (_, j) => `- note ${i}.${j} [p. ${i + 1}]`).join('\n'))
  const out = joinNotes(notes)
  assert.ok(out.length <= STUDIO_BUDGET)
  for (let i = 0; i < 8; i++) assert.match(out, new RegExp(`note ${i}\\.0 `), `group ${i} kept its start`)
  assert.equal(joinNotes(['a', '', 'b']), 'a\n\nb')
  assert.equal(joinNotes([]), '')
})

/* ── asking the book ─────────────────────────────────────────────────────── */

test('passages go in page order and stay inside the ask budget', () => {
  const picked = pickPassages(search(INDEX, 'what is a saturated solution', { limit: 12 }))
  assert.ok(picked.length >= 1)
  assert.deepEqual(picked.map(p => p.page), [...picked.map(p => p.page)].sort((a, b) => a - b))
  const many = Array.from({ length: 30 }, (_, i) => ({ doc: { text: 'w'.repeat(800), page: i + 1 } }))
  const fit = pickPassages(many)
  assert.ok(fit.reduce((n, p) => n + p.text.length, 0) <= ASK_BUDGET)
  // A single passage bigger than the budget is cut, not dropped.
  const [only] = pickPassages([{ doc: { text: 'v'.repeat(ASK_BUDGET * 2), page: 4 } }])
  assert.equal(only.text.length, ASK_BUDGET)
  assert.deepEqual(pickPassages([]), [])
})

test('the question is asked against the pages only, with a way to say "not here"', () => {
  const msgs = askMessages('What is a solution?', PAGES)
  assert.equal(msgs[0].role, 'system')
  assert.match(msgs[0].content, /ONLY the textbook pages/)
  assert.ok(msgs[0].content.includes(NOT_IN_BOOK))
  assert.match(msgs[0].content, /not instructions/)
  assert.match(msgs[1].content, /--- page 3 ---/)
  assert.match(msgs[1].content, /Question: What is a solution\?$/)
})

test('citations to pages that were sent become chips; invented ones vanish', () => {
  const a = parseAnswer('A solution is a homogeneous mixture [p. 2]. Air is a mixture [p.1]. Gases diffuse fast [p. 40].', [1, 2, 3])
  assert.equal(a.notInBook, false)
  assert.deepEqual(a.pages, [2, 1])
  assert.ok(!/40/.test(a.text), 'a page that was never sent is not shown')
  assert.match(a.text, /homogeneous mixture \(p\. 2\)\./)
  assert.match(a.text, /diffuse fast\.$/)

  const range = parseAnswer('Concentration is a ratio [page 2-3].', [2, 3])
  assert.deepEqual(range.pages, [2, 3])
  assert.match(range.text, /\(p\. 2–3\)/)
})

test('"not in this book" is an answer, not an error', () => {
  assert.equal(parseAnswer(NOT_IN_BOOK, [1]).notInBook, true)
  assert.equal(parseAnswer(`  ${NOT_IN_BOOK}.`, [1]).notInBook, true)
  assert.equal(parseAnswer('', [1]).notInBook, true)
})

/* ── study items ─────────────────────────────────────────────────────────── */

test('every study prompt is grounded, asks for JSON, and asks for LaTeX with doubled backslashes', () => {
  for (const kind of ['guide', 'faq', 'timeline', 'mindmap']) {
    const [sys, user] = studioMessages(kind, tagPages(PAGES), { from: 1, to: 3 })
    assert.match(sys.content, /ONLY the material/)
    assert.match(sys.content, /JSON only/)
    assert.match(sys.content, /"l = 2\\\\sqrt\{r\^2 - d\^2\}"/, 'the example shows the JSON-escaped form')
    assert.match(sys.content, /every backslash must be doubled/)
    assert.match(sys.content, /pages 1-3/)
    assert.match(user.content, /JSON shape/)
  }
  assert.throws(() => studioMessages('podcast', '', { from: 1, to: 1 }))
  assert.match(digestMessages(PAGES)[0].content, /\[p\. 12\]/)
})

test('a reply wrapped in a fence or a sentence still parses; junk does not', () => {
  assert.deepEqual(parseJson('```json\n{"a": 1}\n```'), { a: 1 })
  assert.deepEqual(parseJson('Here you go: {"a": {"b": 2}} hope that helps'), { a: { b: 2 } })
  assert.equal(parseJson('no json here'), null)
  assert.equal(parseJson('{"a": '), null)
})

const R = { from: 1, to: 3 }

/* ── formulas ────────────────────────────────────────────────────────────── */

test('LaTeX that lost its backslashes in JSON is put back', () => {
  // What JSON.parse makes of "\frac" and "\times" written without doubling.
  const parsed = JSON.parse('{"f": "\\frac{a}{b} \\times c", "t": "angle $\\theta$ and\\nnext line"}')
  assert.equal(parsed.f, '\frac{a}{b} \times c', 'control characters, not backslashes')
  assert.equal(repairLatex(parsed.f), '\\frac{a}{b} \\times c')
  const g = normalizeGuide({
    formulas: [{ formula: parsed.f, page: 1 }],
    keyConcepts: [{ term: 'Angle', explanation: parsed.t, page: 1 }],
  }, R)
  assert.equal(g.formulas[0].formula, '\\frac{a}{b} \\times c')
  assert.equal(g.keyConcepts[0].explanation, 'angle $\\theta$ and next line', 'a real line break outside the maths stays a break')
  assert.equal(repairLatex('\nu', { newlines: true }), '\\nu')
})

test('plain-text formulas become typeset maths that KaTeX can draw', () => {
  const cases = {
    'chord length = 2*sqrt(r^2 - d^2)': '\\text{chord length} = 2 \\cdot \\sqrt{r^{2} - d^{2}}',
    'chord length = 2*r*sin(theta/2)': '\\text{chord length} = 2 \\cdot r \\cdot \\sin(\\theta/2)',
    'central angle = 2*inscribed angle': '\\text{central angle} = 2 \\cdot \\text{inscribed angle}',
    'v = u + at': 'v = u + at',
    'F = ma': 'F = ma',
    'a^(n+1) = sqrt(sqrt(x)+1)': 'a^{n+1} = \\sqrt{\\sqrt{x}+1}',
    'Mass % = (mass of solute / mass of solution) x 100':
      '\\text{Mass} \\% = (\\text{mass of solute} / \\text{mass of solution}) \\times 100',
    'Delta x = v*t': '\\Delta x = v \\cdot t',
  }
  for (const [plain, tex] of Object.entries(cases)) {
    assert.equal(formulaTex(plain), tex, plain)
    assert.doesNotThrow(() => katex.renderToString(tex, { throwOnError: true, strict: false }), plain)
  }
  // Already LaTeX, or wrapped in $: passed through, never converted twice.
  assert.equal(formulaTex('l = 2\\sqrt{r^2 - d^2}'), 'l = 2\\sqrt{r^2 - d^2}')
  assert.equal(formulaTex('$F = ma$'), 'F = ma')
  assert.equal(formulaTex('sqrt(x'), 'sqrt(x', 'an unbalanced bracket is left alone')
})

test('the study guide keeps real pages, drops invented ones, and caps its lists', () => {
  const g = normalizeGuide({
    title: 'Mixtures',
    overview: 'All about mixtures.',
    keyConcepts: [
      ...Array.from({ length: 14 }, (_, i) => ({ term: `T${i}`, explanation: 'E', page: 2 })),
      { term: '', explanation: 'no term' },
    ],
    formulas: [{ formula: 'C = m/M x 100', meaning: 'concentration', page: 3 }, { formula: 'x', page: 99 }],
    examQuestions: [{ question: 'Define a solution.', page: '2' }, { question: '' }],
  }, R)
  assert.equal(g.keyConcepts.length, 10)
  assert.equal(g.formulas[0].page, 3)
  assert.equal(g.formulas[1].page, null, 'page 99 is outside 1-3')
  assert.deepEqual(g.examQuestions, [{ question: 'Define a solution.', page: 2 }])
  assert.equal(normalizeGuide({ title: 'empty' }, R), null)
  assert.equal(normalizeGuide(null, R), null)
})

test('FAQ, timeline and mind map are cleaned the same way', () => {
  const faq = normalizeFaq({ items: [{ q: 'Q?', a: 'A.', page: 1 }, { q: 'no answer' }] }, R)
  assert.deepEqual(faq, { items: [{ q: 'Q?', a: 'A.', page: 1 }] })
  assert.equal(normalizeFaq({ items: [] }, R), null)

  const tl = normalizeTimeline({ kind: 'dates', items: Array.from({ length: 20 }, (_, i) => ({ when: `${1900 + i}`, what: 'x', page: 1 })) }, R)
  assert.equal(tl.kind, 'dates')
  assert.equal(tl.items.length, 14)
  assert.deepEqual(normalizeTimeline({ kind: 'none', items: [] }, R), { kind: 'none', items: [] })
  assert.equal(normalizeTimeline({ kind: 'sideways', items: [{ when: 'Step 1', what: 'Heat', page: 2 }] }, R).kind, 'steps')

  const map = normalizeMindMap({
    root: 'Mixtures',
    branches: Array.from({ length: 9 }, (_, i) => ({
      label: `B${i}`, page: i,
      children: Array.from({ length: 8 }, (_, j) => ({ label: `C${j}`, page: 2 })),
    })),
  }, R)
  assert.equal(map.branches.length, 7)
  assert.equal(map.branches[0].page, null, 'page 0 does not exist')
  assert.equal(map.branches[1].page, 1)
  assert.equal(map.branches[0].children.length, 5)
  assert.equal(normalizeMindMap({ root: '', branches: [] }, R), null)

  assert.equal(normalizeStudio('podcast', {}, R), null)
  assert.equal(studioKey('book.pdf:123', 'faq', R), 'book.pdf:123|faq|1-3')
})

/* ── the AI route ────────────────────────────────────────────────────────── */

test('JSON mode and reasoning effort go only to models that accept them', () => {
  assert.deepEqual(chatExtras('openai/gpt-oss-120b', { json: true, effort: 'low' }), {
    response_format: { type: 'json_object' }, reasoning_effort: 'low',
  })
  // llama takes JSON mode but has no reasoning_effort: sending it is a 400.
  assert.deepEqual(chatExtras('llama-3.3-70b-versatile', { json: true, effort: 'low' }), {
    response_format: { type: 'json_object' },
  })
  assert.deepEqual(chatExtras('groq/compound-mini', { json: true, effort: 'low' }), {})
  assert.deepEqual(chatExtras('openai/gpt-oss-20b', { effort: 'extreme' }), {})
  assert.deepEqual(chatExtras('openai/gpt-oss-20b', { json: 'yes' }), {})
  assert.deepEqual(chatExtras('openai/gpt-oss-20b'), {})
})

test('/chat passes the extras through to Groq', () => {
  const src = read('server', 'routes', 'aiChat.js')
  assert.match(src, /const \{ messages, model, stream = false, json = false, effort \} = req\.body/)
  assert.match(src, /max_tokens: 2048, \.\.\.chatExtras\(m, \{ json, effort \}\)/)
})

test('strict chat refuses the server\'s stand-in replies', () => {
  const src = read('src', 'lib', 'openrouter.ts')
  assert.match(src, /extras\.strict && data\?\._fallback/)
})

test('every Study request is strict, so no stand-in reply ever looks like the book', () => {
  const src = read('src', 'components', 'BookStudio.tsx')
  const calls = src.match(/await chat\(\{[^}]*\}\)/g) || []
  assert.ok(calls.length >= 3, 'ask, digest and make all call the model')
  for (const c of calls) assert.match(c, /strict: true/, c)
})

test('queued explain / summarise reads the chat reply it actually gets', () => {
  const src = read('src', 'pages', 'Reader.tsx')
  assert.ok(!/r\?\.reply \|\| r\?\.content/.test(src), 'the old shape never matched /ai/chat')
  assert.match(src, /await chat\(\{ messages: \[\{ role: 'user', content: ask \}\]/)
  // ...and keeps the answer on screen when the pending list refreshes.
  assert.match(src, /h\.status === 'done' && !items\.some\(i => i\.id === h\.id\)/)
})
