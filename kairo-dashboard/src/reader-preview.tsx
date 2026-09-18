/**
 * Harness for the reader ingest pipeline.
 *
 * PDF in -> text -> furniture stripped -> chunked -> indexed -> searchable,
 * entirely in the browser. This exists so the pipeline can be driven against a
 * REAL textbook before any of it is wired into a space; the bugs that matter
 * here (a worker that 404s after bundling, lines glued together, headers
 * polluting the index) are all invisible until a real PDF goes through it.
 */
import React, { useState, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import { extractPdfText, stripPageFurniture, looksScanned } from './lib/pdfText'
import { chunk, buildIndex, search, isConfident, snippet } from './lib/search.core.js'

const C = {
  bg: '#08080B', surface: '#14141B', border: '#26262F',
  text: '#F4F4F6', dim: '#9A9AA6', hero: '#7C5CFF', good: '#4ADE80', bad: '#FF6B6B',
}

function Reader() {
  const [status, setStatus] = useState('Choose a PDF to begin.')
  const [stats, setStats] = useState<any>(null)
  const [index, setIndex] = useState<any>(null)
  const [q, setQ] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [confident, setConfident] = useState<boolean | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function onFile(file: File) {
    setIndex(null); setResults([]); setStats(null); setConfident(null)
    const t0 = performance.now()
    try {
      setStatus(`Reading ${file.name}…`)
      const doc = await extractPdfText(file, {
        onProgress: (d, t) => setStatus(`Reading page ${d} of ${t}…`),
      })
      const tExtract = performance.now() - t0

      if (looksScanned(doc)) {
        setStatus(`"${file.name}" looks like a scan — there is no text layer to read.`)
        return
      }

      const raw = doc.pages.map(p => p.text).join('\n\n')
      const cleaned = stripPageFurniture(doc.pages)
      const passages = chunk(cleaned)
      const t1 = performance.now()
      const ix = buildIndex(passages.map((text, i) => ({
        id: `${file.name}:${i}`, text, book: file.name, n: i,
      })))
      const tIndex = performance.now() - t1

      setIndex(ix)
      setStats({
        name: file.name,
        mb: (file.size / 1e6).toFixed(1),
        pages: doc.pageCount,
        rawChars: raw.length,
        cleanChars: cleaned.length,
        stripped: raw.length - cleaned.length,
        passages: passages.length,
        terms: Object.keys(ix.postings).length,
        tExtract: Math.round(tExtract),
        tIndex: Math.round(tIndex),
        title: doc.title,
      })
      setStatus(`Ready — ask it something.`)
    } catch (e: any) {
      setStatus(`Failed: ${e?.message || e}`)
    }
  }

  function run(query: string) {
    setQ(query)
    if (!index || !query.trim()) { setResults([]); setConfident(null); return }
    const r = search(index, query, { limit: 5 })
    setResults(r)
    setConfident(isConfident(r))
  }

  const box: React.CSSProperties = {
    background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: 16,
  }

  return (
    <div style={{
      minHeight: '100vh', background: C.bg, color: C.text, padding: 28,
      fontFamily: 'system-ui, sans-serif', maxWidth: 940, margin: '0 auto',
    }}>
      <h1 style={{ fontSize: 26, margin: '0 0 6px' }}>Reader ingest — harness</h1>
      <div style={{ color: C.dim, fontSize: 14, marginBottom: 20 }}>
        PDF → text → chunks → index → search. All on-device, no network.
      </div>

      <div style={{ ...box, marginBottom: 16 }}>
        <input
          ref={fileRef} type="file" accept="application/pdf"
          onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f) }}
          style={{ color: C.text }}
        />
        <div style={{ marginTop: 10, color: C.dim, fontSize: 14 }} data-testid="status">{status}</div>
      </div>

      {stats && (
        <div style={{ ...box, marginBottom: 16, fontSize: 13.5 }} data-testid="stats">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            <Stat label="pages" value={stats.pages} />
            <Stat label="passages" value={stats.passages} />
            <Stat label="unique terms" value={stats.terms} />
            <Stat label="file" value={`${stats.mb} MB`} />
            <Stat label="extract" value={`${stats.tExtract} ms`} />
            <Stat label="index" value={`${stats.tIndex} ms`} />
            <Stat label="text" value={`${(stats.cleanChars / 1000).toFixed(1)}k chars`} />
            <Stat label="furniture removed" value={`${stats.stripped.toLocaleString()} chars`} />
          </div>
        </div>
      )}

      {index && (
        <>
          <input
            value={q} onChange={e => run(e.target.value)}
            placeholder="Ask the book something…"
            data-testid="query"
            style={{
              width: '100%', padding: '14px 16px', borderRadius: 12, fontSize: 16,
              background: C.surface, border: `1px solid ${C.border}`, color: C.text,
              marginBottom: 12,
            }}
          />
          {q.trim() !== '' && (
            <div
              data-testid="verdict"
              style={{
                fontSize: 13, fontWeight: 700, marginBottom: 12,
                color: confident ? C.good : C.bad,
              }}
            >
              {confident
                ? `ANSWERED · ${results.length} passage${results.length === 1 ? '' : 's'}`
                : 'REFUSED · not confident enough to answer from this book'}
            </div>
          )}
          <div style={{ display: 'grid', gap: 10 }}>
            {results.map((r, i) => {
              const sn = snippet(r.doc.text, r.terms, { width: 300 })
              return (
                <div key={i} style={box} data-testid="result">
                  <div style={{ fontSize: 11.5, color: C.dim, marginBottom: 8 }}>
                    score {r.score.toFixed(2)} · coverage {(r.coverage * 100).toFixed(0)}% · passage {r.doc.n}
                  </div>
                  <div style={{ fontSize: 14.5, lineHeight: 1.6 }}>
                    {sn.truncatedStart && '… '}
                    {sn.parts.map((p: any, j: number) => (
                      <span key={j} style={p.hit
                        ? { background: 'rgba(124,92,255,0.32)', borderRadius: 3, padding: '1px 2px' }
                        : undefined}>{p.text}</span>
                    ))}
                    {sn.truncatedEnd && ' …'}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

const Stat: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div>
    <div style={{ color: C.dim, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6 }}>{label}</div>
    <div style={{ fontSize: 17, fontWeight: 700, marginTop: 2 }}>{value}</div>
  </div>
)

createRoot(document.getElementById('root')!).render(<Reader />)
