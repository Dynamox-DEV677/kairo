// Document reading for Kyno Solver and Camera Study.
//
// Groq only — no other providers.
//
// Strategy, cheapest-first so it works on the free tier with no extra keys:
//   1. Text PDF  -> extract locally with node:zlib (no API, no cost) and answer
//                   through the normal Groq pipeline.
//   2. Scanned PDF (no extractable text) -> Groq's vision model reads images,
//      not PDF containers, so we tell the student to photograph the page.
//   3. Image -> Groq vision.
//   4. Plain text / markdown -> straight to the model.
import express from 'express';
import groqPool from '../services/groqPool.js';
import { aiCall, withSlot } from '../utils/ai.js';
import { extractPdfText, countPdfPages } from '../utils/pdf.js';

const router = express.Router();

const MAX_B64 = 22_000_000;              // ~16 MB file

const MODES = {
  explain: 'Explain this document to a CBSE student in clear, simple language. Cover the key ideas in order.',
  summary: 'Summarise this document as tight bullet points a student can revise from. Keep every number, formula and definition.',
  answer:  'Answer the student\'s question using this document. Quote the relevant line, then explain it simply.',
  notes:   'Turn this into revision notes: headings, short bullets, all formulas and definitions preserved.',
  doubt:   'The student is stuck on something in this document. Identify the hard part and teach it step by step.',
};

/**
 * Read a page image with Groq's vision model (same one Camera Study uses).
 * Used for scanned PDFs and image uploads, where there is no text to extract.
 */
async function visionRead(b64, mime, instruction) {
  const key = groqPool.next();
  if (!key) throw new Error('no live Groq keys');
  const r = await withSlot(() => fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(Number(process.env.AI_TIMEOUT_MS || 8500)),
    body: JSON.stringify({
      model: process.env.GROQ_VISION_MODEL || 'qwen/qwen3.6-27b',
      temperature: 0.3,
      max_tokens: 4000,   // reasoning model: needs room to think AND answer
      messages: [{ role: 'user', content: [
        { type: 'text', text: instruction },
        { type: 'image_url', image_url: { url: `data:${mime};base64,${b64}` } },
      ] }],
    }),
  }));
  if (!r.ok) {
    if (r.status === 429 || r.status >= 500) { try { groqPool.markBad(key, r.status) } catch {} }
    throw new Error(`groq ${r.status}: ${(await r.text()).slice(0, 140)}`);
  }
  const j = await r.json();
  const out = (j?.choices?.[0]?.message?.content || '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .trim();
  return out || null;
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

      // ── 2. scanned PDF ──
      // Groq's vision model accepts images, not PDF containers, so there is
      // nothing useful to try here — say so plainly instead of burning a call.
      console.warn(`[document] no extractable text in ${name} (${pages} pages) — likely scanned`);
      return res.status(422).json({
        error: 'This looks like a scanned PDF (pictures of pages, not text). Photograph the page with Camera Study instead — it reads handwriting and printed pages.',
        pages,
      });
    }

    // ── image: vision ──
    if (isImage) {
      try {
        const md = await visionRead(file, mime, instruction);
        if (md) return res.json({ ok: true, markdown: md, source: 'vision' });
      } catch (e) {
        console.warn('[document] vision image failed:', e.message);
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
