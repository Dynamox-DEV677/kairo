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
export function stripPageFurniture(pages: PdfPage[]): string {
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

  return lines
    .map(ls => ls.filter(l => !isFurniture(l)).join('\n'))
    .join('\n\n')
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
