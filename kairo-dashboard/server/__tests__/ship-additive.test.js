/**
 * The seven-spaces redesign ships ADDITIVELY until all seven are finished.
 *
 * The live app must look and behave exactly as before for anyone not
 * deliberately looking for the new screens: the 32-item drawer stays, "More"
 * stays, no old route redirects anywhere. The only door is one dull row at the
 * bottom of the drawer that opens #/new. These tests pin that contract, plus
 * the real-device rules the new screens promised (16px inputs, hover only
 * where hover exists, a dark PWA shell).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(import.meta.dirname, '..', '..')
const read = (...p) => readFileSync(join(ROOT, ...p), 'utf-8')

const dashboard = read('src', 'pages', 'Dashboard.tsx')
const drawer = read('src', 'components', 'MobileShell.tsx')

test('the old drawer keeps "More" and gains exactly one dull door to #/new', () => {
  assert.match(drawer, />More</, 'the More button is still in the bottom nav')
  assert.equal(drawer.split('New design (preview)').length - 1, 1, 'one row, not a section')
  assert.match(drawer, /go\('new'\)/, 'the row navigates to the new index')
  assert.match(drawer, /fontSize: 12\.5/, 'deliberately small')
  assert.match(drawer, /#5E5E78/, 'deliberately dull')
})

test('#/new is a registered page and no old route redirects anywhere', () => {
  assert.match(dashboard, /'new':\s+'New design'/)
  assert.doesNotMatch(dashboard, /PAGE_ALIASES/, 'aliases/redirects are for the cutover commit')
  assert.match(dashboard, /doubt:\s+"Kyno's Solver"/, "the old solver route still resolves under its old id")
  for (const id of ['doubt-solving', 'practice', 'performance', 'plan', 'notes']) {
    assert.match(dashboard, new RegExp(`<SpaceFrame active="${id}"`), `${id} renders inside the responsive frame`)
  }
})

test('text inputs on the new screens are at least 16px, or iOS zooms the page on focus', () => {
  for (const f of ['DoubtSolving', 'Practice', 'Performance', 'Plan', 'Notes', 'NewIndex']) {
    const src = read('src', 'pages', `${f}.tsx`)
    const re = /<(input|textarea)\b/g
    let m
    while ((m = re.exec(src))) {
      const block = src.slice(m.index, m.index + 900)
      if (/type="file"|type='file'/.test(block.slice(0, 200))) continue
      const fs = block.match(/fontSize:\s*([\d.]+)/)
      if (fs) assert.ok(parseFloat(fs[1]) >= 16, `${f}.tsx: <${m[1]}> at offset ${m.index} has fontSize ${fs[1]}`)
    }
  }
})

test('hover styles for the new sidebar live inside @media (hover: hover)', () => {
  const css = read('src', 'index.css')
  const block = css.slice(css.indexOf('@media (hover: hover)'))
  assert.match(block, /\.kyno-space-nav:hover/, 'the rule exists, and only inside the guard')
  assert.doesNotMatch(css.slice(0, css.indexOf('@media (hover: hover)')), /kyno-space-nav:hover/)
  const frame = read('src', 'components', 'SpaceFrame.tsx')
  assert.doesNotMatch(frame, /onMouseEnter/, 'no JS hover: it sticks after a tap')
})

test('the PWA shell is dark and named Kyno', () => {
  const manifest = JSON.parse(read('public', 'manifest.webmanifest'))
  assert.equal(manifest.name, 'Kyno')
  assert.equal(manifest.short_name, 'Kyno')
  assert.equal(manifest.display, 'standalone')
  assert.equal(manifest.theme_color, '#0B0B14')
  assert.equal(manifest.background_color, '#0B0B14')
  const sizes = new Set(manifest.icons.map(i => i.sizes))
  assert.ok(sizes.has('192x192') && sizes.has('512x512'))
  assert.match(read('index.html'), /<meta name="theme-color" content="#0B0B14"/)
  // On Vercel ENABLE_PWA=true, so VitePWA GENERATES the manifest from
  // vite.config.ts and overrides public/manifest.webmanifest. Both sources
  // must agree, or the installed app and the status bar disagree.
  const vite = read('vite.config.ts')
  assert.match(vite, /name:\s*'Kyno',/, 'generated manifest name')
  assert.match(vite, /theme_color:\s*'#0B0B14'/, 'generated manifest theme colour')
  assert.match(vite, /background_color:\s*'#0B0B14'/, 'generated manifest background colour')
  const sw = read('public', 'kyno-sw.js')
  assert.match(sw, /manifest\.webmanifest/, 'the one service worker also caches the manifest and icons')
  assert.equal(read('src', 'lib', 'pwa.ts').split('serviceWorker.register(').length - 1, 1, 'still exactly one registration')
})
