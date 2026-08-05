// Document reading for Kyno Solver and Camera Study.
//
// Strategy, cheapest-first so it works on the free tier with no extra keys:
//   1. Text PDF  -> extract locally with node:zlib (no API, no cost) and answer
//                   with the normal Groq pipeline.
//   2. Scanned PDF (no extractable text) -> Gemini if a key is configured,
//      otherwise tell the student to photograph the page instead.
//   3. Plain text / markdown -> straight to the model.
import express from 'express';
import { aiCall } from '../utils/ai.js';
import { extractPdfText, countPdfPages } from '../utils/pdf.js';

const router = express.Router();

const MAX_B64 = 22_000_000;              // ~16 MB file
const geminiKey = () => process.env.GEMINI_CAMERA_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
const GEMINI_URL = (m, k) => `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${k}`;

const MODES = {
  explain: 'Explain this document to a CBSE student in clear, simple language. Cover the key ideas in order.',
  summary: 'Summarise this document as tight bullet points a student can revise from. Keep every number, formula and definition.',
  answer:  'Answer the student\'s question using this document. Quote the relevant line, then explain it simply.',
  notes:   'Turn this into revision notes: headings, short bullets, all formulas and definitions preserved.',
  doubt:   'The student is stuck on something in this document. Identify the hard part and teach it step by step.',
};

/** Ask Gemini to read a document it can see (used for scanned/image PDFs). */
async function geminiRead(b64, mime, instruction) {
  const key = geminiKey();
  if (!key) return null;
  const r = await fetch(GEMINI_URL(process.env.GEMINI_DOC_MODEL || 'gemini-2.5-flash', key), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: instruction }, { inline_data: { mime_type: mime, data: b64 } }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 2048 },
    }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!r.ok) throw new Error(`gemini ${r.status}: ${(await r.text()).slice(0, 140)}`);
  const j = await r.json();
  return (j?.candidates?.[0]?.content?.parts || []).map(p => p.text).filter(Boolean).join('').trim() || null;
}

/**
 * POST /api/document/read
 * { file: base64, mime, name?, mode?, question? }
 * -> { ok, markdown, source: 'text-pdf'|'vision'|'text', chars, pages? }
 */
router.post('/read', async (req, res) => {
  const { file, mime = '', name = 'document', mode = 'explain', question = '' } = req.body || {};

  if (!file || typeof file !== 'string') return res.status(400).json({ error: 'No file received.' });
  if (file.length > MAX_B64) return res.status(413).json({ error: 'That file is too large — keep it under about 16 MB.' });

  const instruction = (MODES[mode] || MODES.explain)
    + (question ? `\n\nThe student asks: ${question}` : '')
    + '\n\nUse KaTeX ($...$) for any maths. Plain markdown, no preamble.';

  try {
    const isPdf = /pdf/i.test(mime) || /\.pdf$/i.test(name);
    const isImage = /^image\//i.test(mime);
    const isText = /^text\/|markdown|json/i.test(mime) || /\.(txt|md|csv)$/i.test(name);

    // ── 1. text PDF: free local extraction ──
    if (isPdf) {
      let buf;
      try { buf = Buffer.from(file, 'base64'); }
      catch { return res.status(400).json({ error: 'That file could not be decoded.' }); }

      const text = extractPdfText(buf);
      const pages = countPdfPages(buf);

      if (text && text.length > 120) {
        const markdown = await aiCall({
          taskType: 'reason',
          messages: [
            { role: 'system', content: 'You are Kyno, a precise CBSE study assistant. Never invent content that is not in the document.' },
            { role: 'user', content: `${instruction}\n\n--- DOCUMENT: ${name} (${pages || '?'} pages) ---\n${text.slice(0, 60_000)}` },
          ],
          temperature: 0.3,
          maxTokens: 1800,
        });
        return res.json({ ok: true, markdown, source: 'text-pdf', chars: text.length, pages });
      }

      // ── 2. scanned PDF: needs eyes ──
      try {
        const md = await geminiRead(file, 'application/pdf', instruction);
        if (md) return res.json({ ok: true, markdown: md, source: 'vision', pages });
      } catch (e) {
        console.warn('[document] gemini pdf failed:', e.message);
      }
      return res.status(422).json({
        error: 'This looks like a scanned PDF (pictures of pages, not text). Photograph the page with Camera Study instead — it reads handwriting and printed pages.',
        pages,
      });
    }

    // ── image: vision ──
    if (isImage) {
      try {
        const md = await geminiRead(file, mime, instruction);
        if (md) return res.json({ ok: true, markdown: md, source: 'vision' });
      } catch (e) {
        console.warn('[document] gemini image failed:', e.message);
      }
      return res.status(422).json({ error: 'Image reading is unavailable right now — try Camera Study for photos of your work.' });
    }

    // ── plain text ──
    if (isText) {
      const text = Buffer.from(file, 'base64').toString('utf8').slice(0, 60_000);
      if (text.trim().length < 20) return res.status(400).json({ error: 'That file looks empty.' });
      const markdown = await aiCall({
        taskType: 'reason',
        messages: [
          { role: 'system', content: 'You are Kyno, a precise CBSE study assistant.' },
          { role: 'user', content: `${instruction}\n\n--- DOCUMENT: ${name} ---\n${text}` },
        ],
        temperature: 0.3,
        maxTokens: 1800,
      });
      return res.json({ ok: true, markdown, source: 'text', chars: text.length });
    }

    return res.status(415).json({ error: 'Unsupported file. Upload a PDF, an image, or a .txt / .md file.' });
  } catch (e) {
    console.error('[document/read]', e.message);
    return res.status(502).json({ error: e.code === 'AI_UNAVAILABLE' ? e.message : 'Could not read that document right now — try again in a moment.' });
  }
});

export default router;
