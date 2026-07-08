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

const WIKIMEDIA_API   = 'https://commons.wikimedia.org/w/api.php'
const WIKIPEDIA_API   = 'https://en.wikipedia.org/w/api.php'
const WIKIPEDIA_REST  = 'https://en.wikipedia.org/api/rest_v1'
const PEXELS_API      = 'https://api.pexels.com/v1/search'
const UNSPLASH_API    = 'https://api.unsplash.com/search/photos'

const UA = 'KairoEdu/1.0 (https://kairo-daily-edu.vercel.app; contact: support@kairo.app)'

/**
 * Slide shape (JSDoc):
 *   { url, thumb?, caption, source, attribution?, pageUrl? }
 *
 * source ∈ 'wikimedia' | 'pexels' | 'unsplash'
 */

/**
 * Search Wikipedia for an article matching the query, return its lead image.
 * This is FAST and gives high-quality educational visuals — Wikipedia article
 * thumbnails are curated and reliably tied to the topic. No API key needed.
 */
export async function searchWikipediaArticle(query) {
  // 1. Search Wikipedia for the closest article title.
  const searchParams = new URLSearchParams({
    action: 'query', format: 'json', list: 'search',
    srsearch: query, srlimit: '1', origin: '*',
  })
  const sr = await fetch(`${WIKIPEDIA_API}?${searchParams}`, { headers: { 'User-Agent': UA } })
  if (!sr.ok) return null
  const sdata = await sr.json()
  const title = sdata?.query?.search?.[0]?.title
  if (!title) return null

  // 2. Get the article summary (thumbnail + originalimage).
  const summaryUrl = `${WIKIPEDIA_REST}/page/summary/${encodeURIComponent(title)}`
  const summary = await fetch(summaryUrl, { headers: { 'User-Agent': UA } }).then(r => r.ok ? r.json() : null)
  if (!summary) return null

  const img = summary.originalimage || summary.thumbnail
  if (!img?.source) return null

  return {
    url:     img.source,
    thumb:   summary.thumbnail?.source,
    caption: summary.title + (summary.description ? ' — ' + summary.description : ''),
    source:  'wikimedia',
    attribution: 'Wikipedia · ' + summary.title,
    pageUrl: summary.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`,
  }
}

/**
 * Get N images from a Wikipedia article's media list — useful when one topic
 * (like "photosynthesis") should yield a whole storyboard. No API key.
 */
export async function getWikipediaArticleImages(topic, limit = 6) {
  // Find the article first
  const searchParams = new URLSearchParams({
    action: 'query', format: 'json', list: 'search',
    srsearch: topic, srlimit: '1', origin: '*',
  })
  const sr = await fetch(`${WIKIPEDIA_API}?${searchParams}`, { headers: { 'User-Agent': UA } })
  if (!sr.ok) return []
  const sdata = await sr.json()
  const title = sdata?.query?.search?.[0]?.title
  if (!title) return []

  // Get every image from that article via the page-images endpoint
  const params = new URLSearchParams({
    action: 'query', format: 'json',
    titles: title, prop: 'images', imlimit: '20', origin: '*',
  })
  const r = await fetch(`${WIKIPEDIA_API}?${params}`, { headers: { 'User-Agent': UA } })
  if (!r.ok) return []
  const data = await r.json()
  const page = Object.values(data?.query?.pages || {})[0]
  const imageTitles = (page?.images || [])
    .map(i => i.title)
    .filter(t => t && !/\.(svg|webp)$/i.test(t.toLowerCase()) === false || /\.(svg|png|jpg|jpeg)$/i.test(t.toLowerCase()))
    .filter(t => !/(commons-logo|wiki-logo|disambig|edit-icon|stub|wikidata-logo|symbol)/i.test(t))
    .slice(0, limit + 4)   // get a few extra; we'll drop noise

  // Resolve each title to a real image URL
  const slides = await Promise.all(imageTitles.map(async (fileTitle) => {
    const p = new URLSearchParams({
      action: 'query', format: 'json',
      titles: fileTitle, prop: 'imageinfo',
      iiprop: 'url|size|extmetadata', iiurlwidth: '900', origin: '*',
    })
    try {
      const rr = await fetch(`${WIKIMEDIA_API}?${p}`, { headers: { 'User-Agent': UA } })
      if (!rr.ok) return null
      const dd = await rr.json()
      const pp = Object.values(dd?.query?.pages || {})[0]
      const info = pp?.imageinfo?.[0]
      if (!info) return null
      if (info.width && info.width < 200) return null
      const url = info.thumburl || info.url
      if (!url) return null
      const ext = info.extmetadata || {}
      const caption = stripHtml(ext.ImageDescription?.value)
        || fileTitle.replace(/^File:/, '').replace(/_/g, ' ').replace(/\.[^.]+$/, '')
      return {
        url,
        thumb:       info.thumburl,
        caption:     truncate(caption, 200),
        source:      'wikimedia',
        attribution: stripHtml(ext.Artist?.value) || `Wikipedia · ${title}`,
        pageUrl:     `https://commons.wikimedia.org/wiki/${encodeURIComponent(fileTitle)}`,
      }
    } catch { return null }
  }))
  return slides.filter(Boolean).slice(0, limit)
}

/**
 * Search Wikimedia Commons for one query. Returns the first image as a slide,
 * or null if nothing matched. Less restrictive than before — no filetype filter.
 */
export async function searchWikimedia(query) {
  const params = new URLSearchParams({
    action:        'query',
    format:        'json',
    prop:          'imageinfo',
    generator:     'search',
    gsrsearch:     query,
    gsrnamespace:  '6',          // File:
    gsrlimit:      '5',
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
    if (info.width && info.width < 200) continue
    // Skip obvious icons/logos that polluted results
    if (/(logo|icon|symbol|disambig|stub)/i.test(page.title || '')) continue

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
 * Try every source in order. Wikipedia article match first (most reliable for
 * educational topics), then Wikimedia Commons full-text, then Pexels/Unsplash
 * if keys exist. Returns first non-null hit.
 */
export async function searchAny(query) {
  try {
    const wp = await searchWikipediaArticle(query)
    if (wp) return wp
  } catch (e) { /* swallow */ }

  try {
    const wm = await searchWikimedia(query)
    if (wm) return wm
  } catch (e) { /* swallow */ }

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
 * Fan out: try every query in parallel + ALSO grab the article-level images
 * for the broader topic so we always have something. De-duped by URL.
 *
 *   queries  array of specific search phrases (from the AI plan)
 *   topic    optional fallback term (the user's original question)
 */
// ─── AI image generation (Pollinations — free, no API key) ────────────────
// NotebookLM-style: instead of only *searching* for images (which can miss),
// we *generate* an educational illustration for every storyboard query.
// The URL itself is the image — Pollinations renders it on first fetch and
// CDN-caches it, so repeat views are instant.
const POLLINATIONS = 'https://image.pollinations.ai/prompt/'
const GEN_STYLE = ', clean educational textbook illustration, labeled diagram, vibrant colors, white background, high detail, no watermark'

// Stable seed per query — the same prompt renders the same image across
// reloads, so the storyboard feels intentional (and caches well).
function stableSeed(s) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) % 100000
}

export function makeGeneratedSlide(query) {
  const prompt = encodeURIComponent(query + GEN_STYLE)
  return {
    url: `${POLLINATIONS}${prompt}?width=960&height=600&nologo=true&seed=${stableSeed(query)}`,
    caption: query,
    source: 'kairo-ai',
    attribution: 'Generated by Kyno AI',
  }
}

export async function searchManyParallel(queries, topic) {
  const tasks = []
  for (const q of queries) tasks.push(searchAny(q).catch(() => null))
  // ALWAYS grab the topic article's media list as a fallback batch — fast,
  // single API call, and reliably yields a sequential storyboard.
  const fallbackTopic = topic || queries[0] || ''
  if (fallbackTopic) {
    tasks.push(getWikipediaArticleImages(fallbackTopic, 6).catch(() => []))
  }

  const results = await Promise.all(tasks)
  // Flatten — searchAny returns one slide, getWikipediaArticleImages returns N
  const flat = []
  for (const r of results) {
    if (Array.isArray(r)) flat.push(...r)
    else if (r) flat.push(r)
  }

  // AI-generated storyboard leads the deck — one image per query, always
  // present, always on-prompt (NotebookLM behaviour). Searched real photos
  // follow as supporting material.
  const generated = (queries || []).slice(0, 5).map(q => makeGeneratedSlide(q))

  // De-dupe by URL: generated first, then searched. Cap at 10.
  const seen = new Set()
  const out = []
  for (const r of [...generated, ...flat]) {
    if (!r?.url || seen.has(r.url)) continue
    seen.add(r.url)
    out.push(r)
    if (out.length >= 10) break
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
