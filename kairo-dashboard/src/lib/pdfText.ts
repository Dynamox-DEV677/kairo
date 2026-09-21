/**
 * PDF -> text, on the device.
 *
 * The app already has a document reader, but it base64-encodes the file and
 * POSTs it to /api/document/read. That is fine for a page of notes and wrong
 * for a textbook: Vercel caps a serverless request body around 4.5MB and a
 * single NCERT chapter is 11MB, the function ceiling is 10s, and it means a
 * student's own book leaves their phone to be read back to them. The reader
 * has to work on the bus with no signal, so extraction happens here.
 *
 * pdf.js is loaded with a DYNAMIC import. It is about a megabyte, and a
 * student who never opens the reader should never download it.
 */

export interface PdfPage {
  page: number
  text: string
}

export interface PdfDoc {
  pages: PdfPage[]
  pageCount: number
  /** From the PDF's own metadata, when it has any. Often missing or junk. */
  title: string | null
}

/** Loaded once and kept -- re-importing per file would re-parse the worker. */
let pdfjsPromise: Promise<any> | null = null

async function getPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const pdfjs = await import('pdfjs-dist')
      /*
       * The worker has to be addressed as a URL Vite can fingerprint, not a
       * bare path. `?url` makes Vite emit the file and hand back its hashed
       * location, which is the only form that survives a production build --
       * a string path works in dev and 404s once the bundle is hashed.
       */
      const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
      pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
      return pdfjs
    })()
  }
  return pdfjsPromise
}

/**
 * Extract the text of a PDF, page by page.
 *
 * `onProgress` exists because this is the slow step a student actually waits
 * on -- a 20-page chapter is a second or two, a 300-page book is much longer,
 * and a progress bar is the difference between "working" and "frozen".
 */
export async function extractPdfText(
  file: File | ArrayBuffer,
  opts: { onProgress?: (done: number, total: number) => void; signal?: AbortSignal } = {},
): Promise<PdfDoc> {
  const pdfjs = await getPdfjs()
  const data = file instanceof ArrayBuffer ? file : await file.arrayBuffer()

  const task = pdfjs.getDocument({
    data,
    // Kyno ships no CMaps or standard fonts, and without these pdf.js tries to
    // fetch them from a CDN -- which fails offline, the one case that matters.
    disableFontFace: true,
    useSystemFonts: false,
    isEvalSupported: false,
  })
  const doc = await task.promise

  let title: string | null = null
  try {
    const meta = await doc.getMetadata()
    const t = (meta?.info as any)?.Title
    if (typeof t === 'string' && t.trim() && !/^untitled/i.test(t)) title = t.trim()
  } catch { /* metadata is optional and frequently malformed */ }

  const pages: PdfPage[] = []
  for (let n = 1; n <= doc.numPages; n++) {
    if (opts.signal?.aborted) throw new Error('cancelled')
    const page = await doc.getPage(n)
    const content = await page.getTextContent()
    pages.push({ page: n, text: joinItems(content.items) })
    page.cleanup()
    opts.onProgress?.(n, doc.numPages)
  }

  const pageCount = doc.numPages
  // destroy() lives on the LOADING TASK, not the document proxy -- the task
  // owns the worker. Calling doc.destroy() throws "is not a function", which
  // only showed up once a real PDF went through this.
  await task.destroy()
  return { pages, pageCount, title }
}

/**
 * pdf.js returns positioned text runs, not paragraphs. Reassembling them is
 * where a naive join ruins the text:
 *
 *   - joining with "" glues the last word of a line to the first of the next
 *     ("theplasma membrane")
 *   - joining with " " turns every line break into a space, so the paragraph
 *     structure the chunker needs is gone
 *
 * pdf.js marks the runs that end a line (`hasEOL`), so a line break becomes a
 * newline and everything else a space. Blank lines survive as paragraph
 * boundaries, which is exactly what chunk() splits on.
 */
function joinItems(items: any[]): string {
  let out = ''
  for (const it of items) {
    if (typeof it?.str !== 'string') continue
    out += it.str
    if (it.hasEOL) out += '\n'
    else if (it.str && !it.str.endsWith(' ')) out += ' '
  }
  return out
}

/**
 * Textbook pages carry furniture that pollutes an index: running headers,
 * page numbers, "Reprint 2024-25" stamps. They repeat on every page, so they
 * would match everything and rank nothing.
 *
 * Lines that appear on more than half the pages are dropped -- which finds
 * headers and footers without needing to know what this particular book puts
 * there.
 */
export function cleanPages(pages: PdfPage[]): PdfPage[] {
  const counts = new Map<string, number>()
  const lines = pages.map(p =>
    p.text.split('\n').map(l => l.trim()).filter(Boolean),
  )
  for (const ls of lines) {
    for (const l of new Set(ls)) counts.set(l, (counts.get(l) || 0) + 1)
  }
  const threshold = Math.max(2, Math.ceil(pages.length * 0.5))
  const isFurniture = (l: string) =>
    (counts.get(l) || 0) >= threshold ||
    /^\d{1,4}$/.test(l) ||                       // a bare page number
    /^reprint\b/i.test(l)

  return pages.map((p, i) => ({
    page: p.page,
    text: lines[i].filter(l => !isFurniture(l)).join('\n'),
  }))
}

/**
 * True when a PDF has no extractable text -- a scan, or photographed pages.
 *
 * Worth detecting explicitly: the pipeline otherwise indexes an empty string
 * and the student gets a book that silently answers nothing. Better to say
 * "this looks like a scan, I can't read it yet" than to pretend.
 */
export function looksScanned(doc: PdfDoc): boolean {
  const chars = doc.pages.reduce((n, p) => n + p.text.replace(/\s/g, '').length, 0)
  return doc.pageCount > 0 && chars / doc.pageCount < 80
}

/* ── rendering the actual page ────────────────────────────────────────────── */

/**
 * Showing extracted TEXT was wrong, and a real chemistry chapter proved it:
 *
 *   "Volume by volume percentage Volume of solution Volume of solute 100 ="
 *
 * That is a formula whose LAYOUT carried all of its meaning, flattened into a
 * word order that means nothing. Figures disappear entirely. In a science
 * textbook the equations and diagrams ARE the content.
 *
 * So the reader draws the real page and lays an invisible, selectable text
 * layer over it: the student reads the actual book, and selection still
 * yields clean text for the index and the cards.
 */

/** Open a stored PDF for rendering. The caller destroys it when finished. */
export async function openPdf(data: ArrayBuffer): Promise<any> {
  const pdfjs = await getPdfjs()
  return pdfjs.getDocument({
    data,
    disableFontFace: false,   // unlike extraction, real pages need real fonts
    isEvalSupported: false,
  }).promise
}

export interface PageRender {
  /** Resolves when the page is on the canvas. Rejects if cancelled. */
  done: Promise<{ page: any; viewport: any }>
  /** Stop the draw. Safe at any point, including before it has begun. */
  cancel: () => void
}

/**
 * Draw one page to a canvas at the device's true pixel density.
 *
 * Returns a HANDLE rather than a bare promise, because a render in flight has
 * to be cancellable. pdf.js refuses to run two renders against one canvas, and
 * a second one starts more easily than it looks: tapping Next twice, the
 * scrollbar appearing, a phone rotating, the keyboard opening. Without a
 * cancel, the NEW draw is the one that gets rejected -- so the page the
 * student asked for is exactly the page they never see, and the canvas sits
 * blank with nothing in the console.
 *
 * Without the devicePixelRatio multiplier a textbook page is visibly soft on
 * a phone, which defeats the point of showing the real page at all.
 */
export function renderPage(
  doc: any,
  pageNumber: number,
  canvas: HTMLCanvasElement,
  cssWidth: number,
): PageRender {
  let task: any = null
  let cancelled = false

  const done = (async () => {
    const page = await doc.getPage(pageNumber)
    if (cancelled) throw cancelledError()

    const base = page.getViewport({ scale: 1 })
    const scale = cssWidth / base.width
    const dpr = Math.min(3, Math.max(1, window.devicePixelRatio || 1))
    const draw = page.getViewport({ scale: scale * dpr })

    canvas.width = Math.floor(draw.width)
    canvas.height = Math.floor(draw.height)
    canvas.style.width = Math.floor(draw.width / dpr) + 'px'
    canvas.style.height = Math.floor(draw.height / dpr) + 'px'

    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('no 2d context')

    task = page.render({ canvasContext: ctx, viewport: draw, background: '#FFFFFF' })
    await task.promise

    // The TEXT layer uses the viewport WITHOUT the dpr multiplier. With it,
    // every span lands at the wrong coordinates and the selection is offset
    // from the words being dragged over.
    return { page, viewport: page.getViewport({ scale }) }
  })()

  return {
    done,
    cancel() {
      cancelled = true
      try { task?.cancel() } catch { /* already finished */ }
    },
  }
}

function cancelledError(): Error {
  const e = new Error('render cancelled')
  e.name = 'RenderingCancelledException'
  return e
}

/**
 * Was this rejection just a cancelled draw?
 *
 * Cancelling is normal -- it happens on every page turn -- so it must never
 * reach the student as an error message.
 */
export function isRenderCancelled(e: any): boolean {
  return e?.name === 'RenderingCancelledException'
}

/**
 * The invisible, selectable text layer that sits exactly over a page.
 *
 * This is what makes the real page still work like text: the student drags
 * across the printed words and gets a clean string back for a flashcard.
 */
export async function paintTextLayer(
  page: any,
  container: HTMLElement,
  viewport: any,
): Promise<void> {
  const pdfjs = await getPdfjs()
  container.replaceChildren()

  // pdf.js sizes the layer and every span from this variable. Without it the
  // width/height calc() is invalid, the layer collapses, and selection lands
  // nowhere. It must be the CSS scale -- the one without devicePixelRatio.
  container.style.setProperty('--total-scale-factor', String(viewport.scale))

  const layer = new pdfjs.TextLayer({
    textContentSource: await page.getTextContent(),
    container,
    viewport,
  })
  await layer.render()

  /*
   * Promote each span's font to !important.
   *
   * `.kairo-mobile *` sets font-family with !important -- the same universal
   * rule that once replaced KaTeX's glyphs with the app font and printed tofu
   * in every formula on a phone. Here it would beat pdf.js's INLINE
   * font-family (author !important outranks a plain inline declaration) and
   * every invisible span would be measured in the wrong typeface.
   *
   * Nothing would look wrong -- the spans are transparent. The selection would
   * simply drift a little further from the words with each line, which is the
   * worst kind of bug to ship. An inline !important is the one thing that
   * outranks an author !important, so pdf.js's own value is re-set as one.
   */
  for (const el of container.querySelectorAll<HTMLElement>('span')) {
    const f = el.style.fontFamily
    if (f) el.style.setProperty('font-family', f, 'important')
  }
}
