/**
 * Image Search Service — pulls educational images from public sources.
 *
 * Primary: Wikimedia Commons (no API key, vast educational corpus, public domain)
 * Optional: Pexels (set PEXELS_API_KEY) — better for stock-photo style imagery
 * Optional: Unsplash (set UNSPLASH_ACCESS_KEY) — same idea
 *
 * Falls through gracefully — if Wikimedia returns nothing for a query, tries
 * Pexels, then Unsplash. Returns the first hit per query.
 */

const WIKIMEDIA_API = 'https://commons.wikimedia.org/w/api.php'
const PEXELS_API    = 'https://api.pexels.com/v1/search'
const UNSPLASH_API  = 'https://api.unsplash.com/search/photos'

const UA = 'KairoEdu/1.0 (https://kairo-daily-edu.vercel.app; contact: support@kairo.app)'

/**
 * Slide shape (JSDoc):
 *   { url, thumb?, caption, source, attribution?, pageUrl? }
 *
 * source ∈ 'wikimedia' | 'pexels' | 'unsplash'
 */

/**
 * Search Wikimedia Commons for one query. Returns the first image as a slide,
 * or null if nothing matched.
 */
export async function searchWikimedia(query) {
  const params = new URLSearchParams({
    action:        'query',
    format:        'json',
    prop:          'imageinfo',
    generator:     'search',
    gsrsearch:     `${query} filetype:bitmap|drawing -filemime:gif`,
    gsrnamespace:  '6',          // File:
    gsrlimit:      '3',
    iiprop:        'url|size|extmetadata',
    iiurlwidth:    '900',
    origin:        '*',
  })

  const r = await fetch(`${WIKIMEDIA_API}?${params}`, { headers: { 'User-Agent': UA } })
  if (!r.ok) return null
  const data = await r.json()
  const pages = data?.query?.pages
  if (!pages) return null

  // Pick the first page that has an imageinfo entry with a usable URL
  for (const page of Object.values(pages)) {
    const info = page.imageinfo?.[0]
    if (!info) continue
    const ext = info.extmetadata || {}
    const url = info.thumburl || info.url
    if (!url) continue
    // Skip tiny / placeholder images
    if (info.width && info.width < 200) continue

    const caption = stripHtml(ext.ImageDescription?.value)
      || stripHtml(ext.ObjectName?.value)
      || page.title?.replace(/^File:/, '').replace(/_/g, ' ')
      || query

    return {
      url,
      thumb:       info.thumburl,
      caption:     truncate(caption, 200),
      source:      'wikimedia',
      attribution: stripHtml(ext.Artist?.value) || 'Wikimedia Commons',
      pageUrl:     `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title)}`,
    }
  }
  return null
}

/** Pexels — only used if PEXELS_API_KEY is set. */
export async function searchPexels(query) {
  const key = process.env.PEXELS_API_KEY
  if (!key) return null
  const params = new URLSearchParams({ query, per_page: '1', orientation: 'landscape' })
  const r = await fetch(`${PEXELS_API}?${params}`, { headers: { Authorization: key } })
  if (!r.ok) return null
  const data = await r.json()
  const photo = data?.photos?.[0]
  if (!photo) return null
  return {
    url:         photo.src?.large || photo.src?.original,
    thumb:       photo.src?.medium,
    caption:     photo.alt || query,
    source:      'pexels',
    attribution: `Photo by ${photo.photographer} on Pexels`,
    pageUrl:     photo.url,
  }
}

/** Unsplash — only used if UNSPLASH_ACCESS_KEY is set. */
export async function searchUnsplash(query) {
  const key = process.env.UNSPLASH_ACCESS_KEY
  if (!key) return null
  const params = new URLSearchParams({ query, per_page: '1', orientation: 'landscape' })
  const r = await fetch(`${UNSPLASH_API}?${params}`, {
    headers: { Authorization: `Client-ID ${key}` },
  })
  if (!r.ok) return null
  const data = await r.json()
  const photo = data?.results?.[0]
  if (!photo) return null
  return {
    url:         photo.urls?.regular,
    thumb:       photo.urls?.small,
    caption:     photo.alt_description || photo.description || query,
    source:      'unsplash',
    attribution: `Photo by ${photo.user?.name} on Unsplash`,
    pageUrl:     photo.links?.html,
  }
}

/**
 * Best-effort: try Wikimedia first (no key, free, encyclopedic), then Pexels,
 * then Unsplash. Returns first non-null result.
 */
export async function searchAny(query) {
  try {
    const wm = await searchWikimedia(query)
    if (wm) return wm
  } catch (e) { /* swallow & continue */ }

  try {
    const px = await searchPexels(query)
    if (px) return px
  } catch (e) { /* swallow */ }

  try {
    const us = await searchUnsplash(query)
    if (us) return us
  } catch (e) { /* swallow */ }

  return null
}

/**
 * Fan out: take an array of queries, run searchAny in parallel, return
 * non-null results in order. De-dupes by URL so the slideshow doesn't repeat.
 */
export async function searchManyParallel(queries) {
  const results = await Promise.all(queries.map(q => searchAny(q).catch(() => null)))
  const seen = new Set()
  const out = []
  for (const r of results) {
    if (!r || !r.url) continue
    if (seen.has(r.url)) continue
    seen.add(r.url)
    out.push(r)
  }
  return out
}

// ─── Helpers ──────────────────────────────────────────────────────────────
function stripHtml(s) {
  if (!s) return ''
  return String(s).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
}
function truncate(s, n) {
  if (!s) return ''
  return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s
}
