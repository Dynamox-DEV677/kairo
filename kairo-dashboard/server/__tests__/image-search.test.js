/**
 * Audit task 4 — the visuals pipeline serving minors. Contract pinned here:
 *  - licensed, attributed sources come FIRST;
 *  - generated (pollinations) images appear ONLY as top-ups, at most 3, and
 *    ONLY after the URL verifiably serves an image;
 *  - a dead generation endpoint means fewer slides, never broken ones;
 *  - every upstream fetch carries a timeout, so "finding visuals…" always
 *    resolves.
 * Network is stubbed via global fetch.
 */
import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { searchManyParallel, verifyImageUrl, makeGeneratedSlide } from '../services/imageSearch.js'

const realFetch = global.fetch
let pollinationsUp = true
let fetchLog = []

function stubFetch() {
  global.fetch = async (url, opts = {}) => {
    fetchLog.push({ url: String(url), hasSignal: !!opts.signal })
    const u = String(url)
    if (u.includes('pollinations')) {
      if (!pollinationsUp) throw new Error('ECONNREFUSED')
      return new Response('', { status: 200, headers: { 'content-type': 'image/jpeg' } })
    }
    if (u.includes('en.wikipedia.org/w/api.php') && u.includes('list=search')) {
      return Response.json({ query: { search: [{ title: 'Photosynthesis' }] } })
    }
    if (u.includes('rest_v1/page/summary')) {
      return Response.json({
        title: 'Photosynthesis', description: 'process',
        originalimage: { source: 'https://upload.wikimedia.org/photo.jpg' },
        thumbnail: { source: 'https://upload.wikimedia.org/thumb.jpg' },
        content_urls: { desktop: { page: 'https://en.wikipedia.org/wiki/Photosynthesis' } },
      })
    }
    // wikimedia generator/search, article images, pexels/unsplash (no keys): empty
    return Response.json({ query: {} })
  }
}

beforeEach(() => { stubFetch(); fetchLog = []; pollinationsUp = true })
afterEach(() => { global.fetch = realFetch })

test('licensed sources lead; generated only tops up and is verified first', async () => {
  const out = await searchManyParallel(['photosynthesis diagram'], 'photosynthesis')
  assert.ok(out.length >= 1)
  assert.equal(out[0].source, 'wikimedia', 'attributed source first, never generated first')
  const gen = out.filter(s => s.source === 'kairo-ai')
  assert.ok(gen.length <= 3, 'generation is a top-up, not the product')
  // every generated slide that made it through was verified with a request
  assert.ok(fetchLog.some(f => f.url.includes('pollinations')), 'verification actually happened')
})

test('DONE WHEN: a dead generation endpoint yields fewer slides, never broken ones', async () => {
  pollinationsUp = false
  // fresh query on purpose: the verify cache may legitimately hold results
  // for URLs checked while the endpoint was up
  const out = await searchManyParallel(['mitochondria structure diagram'], 'mitochondria')
  assert.equal(out.filter(s => s.source === 'kairo-ai').length, 0, 'no unverified generated URLs served')
  assert.ok(out.every(s => !String(s.url).includes('pollinations')))
})

test('verification caches and every upstream fetch carries a timeout signal', async () => {
  const u = makeGeneratedSlide('x').url
  await verifyImageUrl(u)
  const callsAfterFirst = fetchLog.filter(f => f.url === u).length
  await verifyImageUrl(u)
  assert.equal(fetchLog.filter(f => f.url === u).length, callsAfterFirst, 'second check served from cache')
  assert.ok(fetchLog.every(f => f.hasSignal), 'no fetch without a timeout signal')
})
