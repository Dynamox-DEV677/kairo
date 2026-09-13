/**
 * Every surface that shows maths uses the SAME renderer.
 *
 * The Formula Sheet had a working KaTeX pipeline while Doubt Solving printed
 * its step bodies as raw text, so a formula step reached the student as its
 * own source. One surface being fixed while another is not is exactly the
 * regression this pins.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(import.meta.dirname, '..', '..')
const read = (...p) => readFileSync(join(ROOT, ...p), 'utf-8')

test('Doubt step bodies go through the shared math renderer', () => {
  const src = read('src', 'pages', 'DoubtSolving.tsx')
  // ONE component now, imported. Four screens each carried their own copy and
  // a fix landed on one and missed the rest three times running.
  assert.ok(src.includes("from '../components/MathText'"), 'it imports the shared renderer')
  for (const field of ['step.title', 'step.working', 'step.why']) {
    assert.ok(src.includes('<MathText text={' + field + '}'), field + ' must be rendered, not printed')
  }
  assert.ok(!src.includes('}>{step.working}</pre>'), 'the raw pre body is gone')
  assert.ok(!src.includes('rehypeKatex'), 'and no longer configures KaTeX itself')
})

test('the screens in this bug all share ONE renderer', () => {
  // Four screens each carried their own copy of this and a fix landed on one
  // and missed the rest three times running: raw $$ in a chat bubble,
  // **bold** in a doubt step, a class name matching no CSS.
  //
  // NOT yet unified: ~20 other screens still wire rehypeKatex themselves.
  // They share KATEX_OPTS (pinned by math-unicode.test.js) so the CONFIG
  // cannot drift, but each still owns its markup. That is real remaining work.
  for (const f of ['DoubtSolving', 'Practice', 'Notes', 'Flashcards']) {
    const src = read('src', 'pages', f + '.tsx')
    assert.ok(src.includes("components/MathText'"), f + ' must import the shared renderer')
    assert.ok(!src.includes('rehypeKatex'), f + ' must not configure KaTeX itself')
  }
  const bubble = read('src', 'components', 'MessageBubble.tsx')
  assert.ok(bubble.includes('<MathText text={message.content}'),
    "the student's own bubble renders, or a handed-over message arrives as source")
})

test('the solver is actually asked to emit delimiters', () => {
  // Without this the model writes bare formulas and there is nothing to
  // typeset -- a renderer alone would not have been enough.
  const chat = read('server', 'routes', 'aiChat.js')
  assert.ok(chat.includes('MATHS: write every formula'), 'the prompt names the rule')
  assert.ok(chat.includes('on its own line for a displayed equation'))
})

test('the solver parser does not strip LaTeX backslashes', () => {
  // parseJSON (used by the quiz route) strips lone backslashes, which would
  // turn a fraction command into the word. The solver must not use it.
  const chat = read('server', 'routes', 'aiChat.js')
  const start = chat.indexOf('function parseJsonLoose')
  const body = chat.slice(start, start + 1200)
  assert.ok(start > -1, 'the solver has its own parser')
  assert.ok(!body.includes('bfnrtu'), 'and it does not run the backslash-stripping repair')
  assert.ok(chat.includes('parseJsonLoose(raw)'), 'the solver path uses it')
})

test('a prompt change invalidates the cached answers it would change', () => {
  // The key was question + curriculum, and the database cache never expires,
  // so a question asked before a prompt fix kept its old answer forever --
  // the fix would have looked broken for exactly the questions a student
  // retries first.
  const chat = read('server', 'routes', 'aiChat.js')
  assert.ok(chat.includes('const SOLVER_PROMPT_VERSION'), 'the prompt has a version')
  assert.ok(chat.includes("SOLVER_PROMPT_VERSION + '|' + cacheTag"), 'and the cache key carries it')
})
