/**
 * The installed app keeps up with deploys.
 *
 * What these pin, from a desktop install still showing July's purple icon in
 * October: the icon URLs change when the icon does (an installed app only
 * re-reads icons whose URLs changed), both manifests agree and point at files
 * that exist, an open window looks for new builds instead of waiting for a
 * relaunch, and an update never reloads the page out from under a student.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(import.meta.dirname, '..', '..')
const read = (...p) => readFileSync(join(ROOT, ...p), 'utf-8')

const vite = read('vite.config.ts')
const viteIcons = [...vite.slice(vite.indexOf('icons: ['), vite.indexOf('workbox:')).matchAll(/src: '([^']+)'/g)].map(m => m[1])
const staticIcons = JSON.parse(read('public', 'manifest.webmanifest')).icons.map(i => i.src)

test('both manifests list the same icons, and every one exists', () => {
  assert.deepEqual(viteIcons, staticIcons)
  for (const src of staticIcons) assert.ok(existsSync(join(ROOT, 'public', src)), `${src} is missing from public/`)
})

test('the icons are under names the July install never saw', () => {
  for (const src of staticIcons) {
    assert.doesNotMatch(src, /kairo_icon_|kairo_logo/, `${src}: an installed app keeps its icon while the URL is unchanged`)
  }
})

test('an open window checks for new builds', () => {
  const pwa = read('src', 'lib', 'pwa.ts')
  assert.match(pwa, /onRegisteredSW\(/)
  assert.match(pwa, /reg\.update\(\)/)
  assert.match(pwa, /setInterval\(check, 30 \* 60 \* 1000\)/)
  assert.match(pwa, /visibilitychange/)
})

test('an update waits for the student instead of reloading mid-session', () => {
  assert.match(vite, /registerType: 'prompt'/, "'autoUpdate' reloads the page the moment a new worker activates")
  const main = read('src', 'main.tsx')
  assert.doesNotMatch(main, /kairo-update-splash/, 'the full-screen splash that trapped students is gone')
  assert.match(main, /!touched && Date\.now\(\) - bootAt < 10_000 && !triedThisSession/,
    'only an update found while the app is still opening applies by itself, once a session')
  assert.match(main, /showUpdateBar\(reload\)/)
})

test('the fallback worker no longer pins the manifest and icons forever', () => {
  const sw = read('public', 'kyno-sw.js')
  assert.doesNotMatch(sw, /kyno-shell-v2|kyno-assets-v2/, 'v2 held the old icon')
  const branch = sw.slice(sw.indexOf('PRECACHE.includes(url.pathname)'), sw.indexOf("url.pathname.startsWith('/assets/')"))
  assert.ok(branch.indexOf('await fetch(') < branch.indexOf('caches.match('), 'network first, cache only offline')
  for (const src of staticIcons) assert.ok(sw.includes(`'${src}'`), `${src} is not in the offline precache`)
})
