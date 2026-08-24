
const WIKIMEDIA_API   = 'https://commons.wikimedia.org/w/api.php'
const WIKIPEDIA_API   = 'https://en.wikipedia.org/w/api.php'
const WIKIPEDIA_REST  = 'https://en.wikipedia.org/api/rest_v1'
const PEXELS_API      = 'https://api.pexels.com/v1/search'
const UNSPLASH_API    = 'https://api.unsplash.com/search/photos'

const UA = 'KairoEdu/1.0 (https://kairo-daily-edu.vercel.app; contact: kairoindustries.cor@gmail.com)'

export async function searchWikipediaArticle(query) {
  const searchParams = new URLSearchParams({
    action: 'query', format: 'json', list: 'search',
    srsearch: query, srlimit: '1', origin: '*',
  })
  const sr = await fetch(`${WIKIPEDIA_API}?${searchParams}`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
  if (!sr.ok) return null
  const sdata = await sr.json()
  const title = sdata?.query?.search?.[0]?.title
  if (!title) return null

  const summaryUrl = `${WIKIPEDIA_REST}/page/summary/${encodeURIComponent(title)}`
  const summary = await fetch(summaryUrl, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) }).then(r => r.ok ? r.json() : null)
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

export async function getWikipediaArticleImages(topic, limit = 6) {
  const searchParams = new URLSearchParams({
    action: 'query', format: 'json', list: 'search',
    srsearch: topic, srlimit: '1', origin: '*',
  })
  const sr = await fetch(`${WIKIPEDIA_API}?${searchParams}`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
  if (!sr.ok) return []
  const sdata = await sr.json()
  const title = sdata?.query?.search?.[0]?.title
  if (!title) return []

  const params = new URLSearchParams({
    action: 'query', format: 'json',
    titles: title, prop: 'images', imlimit: '20', origin: '*',
  })
  const r = await fetch(`${WIKIPEDIA_API}?${params}`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
  if (!r.ok) return []
  const data = await r.json()
  const page = Object.values(data?.query?.pages || {})[0]
  const imageTitles = (page?.images || [])
    .map(i => i.title)
    .filter(t => t && !/\.(svg|webp)$/i.test(t.toLowerCase()) === false || /\.(svg|png|jpg|jpeg)$/i.test(t.toLowerCase()))
    .filter(t => !/(commons-logo|wiki-logo|disambig|edit-icon|stub|wikidata-logo|symbol)/i.test(t))
    .slice(0, limit + 4)

  const slides = await Promise.all(imageTitles.map(async (fileTitle) => {
    const p = new URLSearchParams({
      action: 'query', format: 'json',
      titles: fileTitle, prop: 'imageinfo',
      iiprop: 'url|size|extmetadata', iiurlwidth: '900', origin: '*',
    })
    try {
      const rr = await fetch(`${WIKIMEDIA_API}?${p}`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
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

export async function searchWikimedia(query) {
  const params = new URLSearchParams({
    action:        'query',
    format:        'json',
    prop:          'imageinfo',
    generator:     'search',
    gsrsearch:     query,
    gsrnamespace:  '6',
    gsrlimit:      '5',
    iiprop:        'url|size|extmetadata',
    iiurlwidth:    '900',
    origin:        '*',
  })

  const r = await fetch(`${WIKIMEDIA_API}?${params}`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
  if (!r.ok) return null
  const data = await r.json()
  const pages = data?.query?.pages
  if (!pages) return null

  for (const page of Object.values(pages)) {
    const info = page.imageinfo?.[0]
    if (!info) continue
    const ext = info.extmetadata || {}
    const url = info.thumburl || info.url
    if (!url) continue
    if (info.width && info.width < 200) continue
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

export async function searchPexels(query) {
  const key = process.env.PEXELS_API_KEY
  if (!key) return null
  const params = new URLSearchParams({ query, per_page: '1', orientation: 'landscape' })
  const r = await fetch(`${PEXELS_API}?${params}`, { headers: { Authorization: key }, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
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

export async function searchUnsplash(query) {
  const key = process.env.UNSPLASH_ACCESS_KEY
  if (!key) return null
  const params = new URLSearchParams({ query, per_page: '1', orientation: 'landscape' })
  const r = await fetch(`${UNSPLASH_API}?${params}`, {
    headers: { Authorization: `Client-ID ${key}` },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
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

export async function searchAny(query) {
  try {
    const wp = await searchWikipediaArticle(query)
    if (wp) return wp
  } catch (e) {  }

  try {
    const wm = await searchWikimedia(query)
    if (wm) return wm
  } catch (e) {  }

  try {
    const px = await searchPexels(query)
    if (px) return px
  } catch (e) {  }

  try {
    const us = await searchUnsplash(query)
    if (us) return us
  } catch (e) {  }

  return null
}

/* ── generation (audit task 4) ────────────────────────────────────────────────
   pollinations.ai is a free public endpoint with no SLA and no content
   controls, in a path serving minors. The audit's prescription — a paid
   provider with a contract — conflicts with the project's hard $0 rule, so
   the honest remediation is:
     1. licensed, attributed sources (Wikipedia/Wikimedia/Pexels/Unsplash)
        now come FIRST — generated images only top up the remainder;
     2. a generated URL is server-side VERIFIED (it actually returns an
        image, with a hard timeout) before a student ever sees it, so a dead
        endpoint means fewer slides, never broken ones;
     3. verified results are cached per instance;
     4. zero slides is a clean state the client already renders.
   If a contracted provider ever fits the budget, makeGeneratedSlide is the
   one seam to swap. */

const POLLINATIONS = 'https://image.pollinations.ai/prompt/'
const GEN_STYLE = ', clean educational textbook illustration, labeled diagram, vibrant colors, white background, high detail, no watermark'
const FETCH_TIMEOUT_MS = 4000
const VERIFY_TIMEOUT_MS = 3500

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
    attribution: 'AI-generated illustration',
  }
}

// url -> boolean, capped LRU-ish; per serverless instance, which is fine —
// the point is not re-verifying within a burst.
const verifyCache = new Map()
const VERIFY_CACHE_MAX = 300

/** Does this URL actually serve an image right now? */
export async function verifyImageUrl(url) {
  if (verifyCache.has(url)) return verifyCache.get(url)
  let ok = false
  try {
    const r = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(VERIFY_TIMEOUT_MS) })
    ok = r.ok && /^image\//i.test(r.headers.get('content-type') || '')
    // Some CDNs reject HEAD; one GET attempt before giving up.
    if (!ok && (r.status === 405 || r.status === 403)) {
      const g = await fetch(url, { signal: AbortSignal.timeout(VERIFY_TIMEOUT_MS) })
      ok = g.ok && /^image\//i.test(g.headers.get('content-type') || '')
      try { g.body?.cancel?.() } catch {}
    }
  } catch { ok = false }
  verifyCache.set(url, ok)
  if (verifyCache.size > VERIFY_CACHE_MAX) verifyCache.delete(verifyCache.keys().next().value)
  return ok
}

export async function searchManyParallel(queries, topic) {
  const tasks = []
  for (const q of queries) tasks.push(searchAny(q).catch(() => null))
  const fallbackTopic = topic || queries[0] || ''
  if (fallbackTopic) {
    tasks.push(getWikipediaArticleImages(fallbackTopic, 6).catch(() => []))
  }

  const results = await Promise.all(tasks)
  const flat = []
  for (const r of results) {
    if (Array.isArray(r)) flat.push(...r)
    else if (r) flat.push(r)
  }

  // Licensed, attributed sources lead. Generation only tops up what's
  // missing, at most 3, and only after each URL is verified to actually load.
  const seen = new Set()
  const out = []
  for (const r of flat) {
    if (!r?.url || seen.has(r.url)) continue
    seen.add(r.url)
    out.push(r)
    if (out.length >= 10) break
  }

  const missing = Math.max(0, 6 - out.length)
  if (missing > 0) {
    const candidates = (queries || []).slice(0, Math.min(3, missing)).map(q => makeGeneratedSlide(q))
    const checks = await Promise.all(candidates.map(c => verifyImageUrl(c.url).catch(() => false)))
    for (let i = 0; i < candidates.length; i++) {
      if (checks[i] && !seen.has(candidates[i].url)) {
        seen.add(candidates[i].url)
        out.push(candidates[i])
      }
    }
  }
  return out
}

function stripHtml(s) {
  if (!s) return ''
  return String(s).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
}
function truncate(s, n) {
  if (!s) return ''
  return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s
}
