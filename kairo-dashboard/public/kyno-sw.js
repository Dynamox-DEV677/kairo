/**
 * C26 — offline / low-data mode.
 *
 * Hand-rolled on purpose: no build-plugin dependency, ~60 lines, and the
 * strategy fits how this app actually stores things. The student's own content
 * (formulas, flashcards, reels, twin, notes) already lives in localStorage and
 * works offline for free — what breaks offline is the APP SHELL. So this
 * caches the shell and the hashed assets, and refuses to touch API calls.
 *
 * Strategies:
 * - /assets/*  cache-first. Vite content-hashes these, so a hit is immutable.
 * - navigation network-first, cache fallback. A deploy is picked up when
 *              online; the last good shell serves when offline.
 * - /api/*     network only, never cached. Serving a stale AI answer or sync
 *              state as if fresh is the kind of lie this app doesn't tell.
 */
const SHELL = 'kyno-shell-v1'
const ASSETS = 'kyno-assets-v1'

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then(c => c.add('/')).catch(() => {}))
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keep = new Set([SHELL, ASSETS])
    for (const k of await caches.keys()) if (!keep.has(k)) await caches.delete(k)
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url)
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api/')) return // never cache API traffic

  // Hashed assets: cache-first, fill on first fetch.
  if (url.pathname.startsWith('/assets/')) {
    e.respondWith((async () => {
      const hit = await caches.match(e.request)
      if (hit) return hit
      const res = await fetch(e.request)
      if (res.ok) (await caches.open(ASSETS)).put(e.request, res.clone())
      return res
    })())
    return
  }

  // The shell: network-first so deploys land, cache fallback so offline opens.
  if (e.request.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const res = await fetch(e.request)
        if (res.ok) (await caches.open(SHELL)).put('/', res.clone())
        return res
      } catch {
        return (await caches.match('/')) || Response.error()
      }
    })())
  }
})
