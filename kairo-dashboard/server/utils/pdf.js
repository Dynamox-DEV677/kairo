// Zero-dependency PDF text extraction.
//
// PDF content lives in FlateDecode-compressed streams; the visible text is in
// the Tj / TJ operators inside them. node:zlib inflates the streams, then a
// LINEAR scanner pulls the strings out.
//
// The scanner is deliberately not a regex: PDF streams contain binary data,
// and any nested-quantifier regex backtracks effectively forever on it (this
// exact mistake hung a build for minutes before it was rewritten).
//
// Works on normal text PDFs (NCERT chapters, notes, question papers).
// Scanned/photographed PDFs contain images, not text — those yield nothing and
// must go to the vision model instead.
import zlib from 'node:zlib';

const unescapePdf = (s) => s
  .replace(/\\([nrtbf])/g, (_, c) => ({ n: '\n', r: '\r', t: '\t', b: '', f: '' }[c]))
  .replace(/\\(\d{1,3})/g, (_, o) => String.fromCharCode(parseInt(o, 8)))
  .replace(/\\(.)/g, '$1');

export function extractPdfText(buf, { maxChars = 120_000 } = {}) {
  const out = [];
  let total = 0;

  const pushDecoded = (chunk) => {
    if (total >= maxChars) return;
    const s = chunk.toString('latin1');
    if (!s.includes('Tj') && !s.includes('TJ')) return;   // not a text stream
    let i = 0;
    const n = s.length;
    while (i < n && total < maxChars) {
      if (s[i] !== '(') { i++; continue; }
      // read one balanced, escape-aware PDF string literal
      let depth = 1, j = i + 1, lit = '';
      while (j < n && depth > 0) {
        const ch = s[j];
        if (ch === '\\') { lit += ch + (s[j + 1] ?? ''); j += 2; continue; }
        if (ch === '(') depth++;
        else if (ch === ')') { depth--; if (!depth) break; }
        lit += ch;
        j++;
      }
      // keep it only if a text-drawing operator follows
      if (/^\s*(-?[\d.]+\s*)*(\]\s*)?(Tj|TJ|'|")/.test(s.slice(j + 1, j + 24))) {
        const t = unescapePdf(lit);
        out.push(t);
        total += t.length;
      }
      i = j + 1;
    }
  };

  let i = 0;
  while (i < buf.length && total < maxChars) {
    const start = buf.indexOf('stream', i);
    if (start < 0) break;
    let s = start + 6;
    if (buf[s] === 0x0d) s++;
    if (buf[s] === 0x0a) s++;
    const end = buf.indexOf('endstream', s);
    if (end < 0) break;
    const raw = buf.subarray(s, end);
    try { pushDecoded(zlib.inflateSync(raw)); }
    catch {
      try { pushDecoded(zlib.inflateRawSync(raw)); } catch { /* not a text stream */ }
    }
    i = end + 9;
  }

  return out.join(' ').replace(/\s+/g, ' ').trim();
}

/** Rough page count, for telling the student what we actually read. */
export function countPdfPages(buf) {
  const s = buf.toString('latin1');
  const m = s.match(/\/Type\s*\/Page[^s]/g);
  if (m?.length) return m.length;
  const c = s.match(/\/Count\s+(\d+)/);
  return c ? Number(c[1]) : 0;
}
