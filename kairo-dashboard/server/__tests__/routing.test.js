/**
 * The URL is the router, and a hidden screen is inert.
 *
 * Before this only space ROOTS were routes. Every sub-screen was component
 * state, so a deep link did nothing, a refresh lost your place, browser back
 * jumped out of the space, and the hash could say "#/doubt/report" while
 * Progress was on screen. Hidden screens were not inert either: their timers
 * ran and their buttons stayed in the accessibility tree.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { SPACE_HOME_VIEW, SPACE_VIEW_CHANGED } from '../../src/lib/spaces.core.js'

const ROOT = join(import.meta.dirname, '..', '..')
const read = (...p) => readFileSync(join(ROOT, ...p), 'utf-8')
const dashboard = read('src', 'pages', 'Dashboard.tsx')

test('the hash carries a sub-screen, not just a space', () => {
  const fn = dashboard.slice(dashboard.indexOf('function routeFromHash'), dashboard.indexOf('function pageFromHash'))
  assert.match(fn, /\(\?:/, 'the pattern has an optional second segment')
  assert.match(fn, /m\?\.\[2\]/, 'and an explicit second segment is used')
})

test('a space reports its own moves, and the shell writes them to the URL', () => {
  assert.equal(typeof SPACE_VIEW_CHANGED, 'string')
  for (const f of ['Notes', 'Progress', 'Plan', 'Performance', 'Practice']) {
    assert.match(read('src', 'pages', f + '.tsx'), /publishSpaceView\(/, f + ' must report its screen')
  }
  assert.match(dashboard, /SPACE_VIEW_CHANGED/, 'the shell listens')
  assert.match(dashboard, /activeView \? `#\/\$\{active\}\/\$\{activeView\}` : `#\/\$\{active\}`/, 'and the URL includes it')
})

test('every space has a home screen, so the root URL stays bare', () => {
  for (const id of ['doubt-solving', 'practice', 'performance', 'plan', 'notes', 'progress', 'profile']) {
    assert.equal(typeof SPACE_HOME_VIEW[id], 'string', id + ' needs a home view')
  }
})

test('a hidden page is inert, not merely invisible', () => {
  assert.match(dashboard, /inert: true/, 'hidden slots carry inert')
  assert.match(dashboard, /aria-hidden/, 'and leave the accessibility tree')
  assert.doesNotMatch(dashboard, /className=\{pageClass\} style=\{pageStyle\(/, 'every slot goes through pageProps')
})

test('a hidden space does not run a countdown, and loses no session time', () => {
  const practice = read('src', 'pages', 'Practice.tsx')
  assert.match(practice, /if \(!layout\.visible\) \{ hiddenSince\.current = Date\.now\(\); return \}/)
  assert.match(practice, /now - startedAt - hiddenMs/, 'time spent away is discounted')
  for (const f of ['Plan', 'Progress']) {
    const src = read('src', 'pages', f + '.tsx')
    const ticks = src.split('setInterval').length - 1
    const gated = src.split('if (!vis) return').length - 1
    assert.ok(gated >= 1 && ticks >= 1, f + ' must gate its interval on visibility')
  }
})

test('SpaceFrame tells a space whether it is the one on screen', () => {
  const frame = read('src', 'components', 'SpaceFrame.tsx')
  assert.match(frame, /visible: boolean/)
  assert.match(dashboard, /visible=\{active === /, 'and the shell supplies it')
})
