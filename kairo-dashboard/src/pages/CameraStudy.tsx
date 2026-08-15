import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import {
  Camera, Upload, X, Sparkles, FileText, BookmarkPlus,
  Lightbulb, RotateCcw, Loader2, CheckCircle2, Scale, FunctionSquare,
} from 'lucide-react'
import { saveRecentChat, makeTitle } from '../lib/recentChats'
import { aiHeaders } from '../lib/devKey'
import { recordMistake, recordFlashcard, listFormulas } from '../lib/twin'
import { formulaSignature } from '../lib/knowledgeHygiene.js'
import { balance } from '../lib/balanceEquation.js'
import { awardXP } from '../lib/game'

const VISION_MODELS = [
  {
    id: 'qwen/qwen3.6-27b',
    label: 'Kyno Vision',
    desc:  'Reads diagrams, handwriting & homework photos, then solves them step-by-step',
  },
]

const MD_RULES = `

Format your response in clean markdown:
- Headings start with "## " (TWO hashes and a SPACE, never "##Heading")
- Use blank lines between paragraphs and sections
- Use **bold** for emphasis, - for bullet lists, 1. for numbered lists
- Use $...$ for inline math, $$...$$ for display math
- No code fences around prose
- No <think> tags`

/**
 * NCERT grounding.
 *
 * Every prompt here used to say "explain simply for a Class 10 student", which
 * produces a technically correct answer in the wrong dialect. CBSE marks
 * against NCERT's own wording and NCERT's own method, so an answer that uses
 * different terminology or a shortcut the book does not teach can be right and
 * still lose marks. That is worse than useless to a student revising for the
 * board — it teaches them to write something an examiner will not reward.
 *
 * These rules go on every content prompt in this file.
 */
const NCERT_RULES = `

Follow the NCERT textbook, not a general or international treatment:
- Use NCERT's own terminology and definitions. If NCERT calls it "displacement reaction", do not call it "single replacement".
- Use the method NCERT teaches for this chapter, even if a faster method exists. If you mention a shortcut, mark it clearly as extra and show the NCERT method first.
- Use SI units and the symbols as printed in NCERT.
- Where NCERT gives a standard worked example for this idea, follow its structure.
- Stay inside the CBSE Class 9-12 syllabus. Do not bring in higher-level material (calculus in a Class 10 answer, orbital hybridisation where NCERT only wants valency) unless the page itself does.
- If you are not sure whether something is in the NCERT syllabus, say so plainly rather than presenting it as required knowledge.`

/**
 * CBSE awards marks per step, not for the final number. A correct answer with
 * no formula line loses the formula mark; the right method with an arithmetic
 * slip keeps most of them. Showing the answer in the shape the examiner marks
 * is the difference between a student who knows the physics and a student who
 * scores for it.
 */
const CBSE_STEP_RULES = `

Write the solution the way it must be written to earn full marks in a CBSE paper:
1. **Given** — list what the question provides, with units.
2. **To find** — state what is being asked.
3. **Formula** — write the formula on its own line before substituting anything.
4. **Substitution** — put the values in, keeping units.
5. **Answer** — final value on its own line, with the correct unit, boxed as **bold**.

Never skip the formula line even if the arithmetic is trivial — it carries a mark on its own.`

const CHECK_PROMPT = `This image contains a student's OWN handwritten working for a problem. Your job is to audit their working line by line and find the EXACT step where it first goes wrong.

Work through it silently first: solve the problem correctly yourself, then compare the student's work against your solution step by step.

Respond in EXACTLY this structure:

## Verdict
One line: either "Correct — your working holds up." or "First error is in Step N."

## Step-by-step check
A markdown table with columns: Step | What you wrote | Status | Comment
- Number the student's steps as they appear in the image (Step 1, Step 2, …).
- Status must be exactly ✅, ⚠️ or ❌ (❌ = wrong, ⚠️ = works but risky/unclear, ✅ = correct).
- Transcribe "What you wrote" faithfully but briefly.
- Keep each Comment to one short sentence.

## The exact slip
Only describe the FIRST ❌ step. Say precisely what went wrong (sign error, wrong formula, dropped term, arithmetic slip, wrong unit…) and why it's wrong. If everything is correct, write: No slip — well done.

## From that step, corrected
Redo the solution from the first wrong step onward, showing correct working to the final answer. If the student was fully correct, restate their final answer and confirm it.

## Right answer
State the correct final answer on its own line, with units.

## Stop this repeating
Two specific checks the student can run on similar problems to catch this class of error.

Be precise and never invent steps the student didn't write. If the handwriting is unreadable in places, say so in the Comment for that step instead of guessing.` + NCERT_RULES + MD_RULES

const ACTIONS = [
  { id: 'check',     label: 'Check my work', icon: CheckCircle2, color: '#4FD8E8',
    hint: 'Photo of YOUR working — finds the exact wrong step',
    prompt: CHECK_PROMPT },
  { id: 'solve',     label: 'Solve',         icon: Sparkles,     color: '#7C5CFF',
    hint: 'Solves it the way CBSE marks it — formula, substitution, units',
    prompt: 'Read the question(s) in this image carefully and solve each one.\n\nName the chapter this question comes from at the top, as "Class <n> <Subject> · <Chapter>". If you are not confident which chapter it is, write "Chapter: not identified" rather than guessing.'
      + CBSE_STEP_RULES + NCERT_RULES + MD_RULES },
  { id: 'explain',   label: 'Explain',       icon: Lightbulb,    color: '#A5B4FC',
    hint: 'Explains it in NCERT’s own words',
    prompt: 'Explain the concept(s) shown in this image to an Indian school student.\n\nStructure:\n## What the book calls it\nThe NCERT definition, in NCERT\'s wording.\n## In plain words\nThe same idea in everyday language, with one analogy.\n## Worked example\nA short example in NCERT\'s style.\n## Common mistake\nThe error students most often make here, and how to avoid it.\n## Quick check\nOne question the student can answer to test themselves.'
      + NCERT_RULES + MD_RULES },
  { id: 'flashcards', label: 'Flashcards',   icon: BookmarkPlus, color: '#A5B4FC',
    hint: 'Board-exam style cards from the page',
    prompt: 'Create 8-10 flashcards from the STUDY CONTENT in this image, in the style of CBSE board questions — definitions, formulas, reasons, differences, and one-mark recall the exam actually asks for.\n\nUse NCERT terminology. Do not ask about page numbers, exercise numbers, or anything that is not subject knowledge.\n\nIf the image is NOT study material (a receipt, a photo, a screenshot, a booking, a form), return exactly: {"notStudyMaterial": true}\n\nOtherwise return ONLY a JSON array: [{"front":"question","back":"answer"}]. No other text, no markdown, no explanation.' },
  /**
   * The model only READS the equation. The balancing is done in code by
   * src/lib/balanceEquation.js, because balancing is linear algebra with one
   * right answer — asking a language model to do arithmetic it could compute
   * exactly is how a student ends up memorising a wrong coefficient.
   */
  { id: 'balance',   label: 'Balance',       icon: Scale,        color: '#4FD8E8',
    hint: 'Photo of an unbalanced equation — balances it with the working',
    prompt: 'Read the chemical equation in this image. Transcribe it EXACTLY as written, including any existing coefficients, using -> for the arrow. Do NOT balance it. Do not solve anything.\n\nReturn ONLY a JSON object: {"equation":"<the equation as written>","readable":true|false}' },
  /**
   * Formula Reader.
   *
   * Matches against the student's OWN formula sheet by symbol signature — the
   * same matcher that collapsed the six Ohm's Law cards, so "V = IR" on the
   * page finds the card they saved as "R = V/I". There is no second formula
   * database: inventing one would mean two sources of truth for the same fact,
   * and the rest of this app has spent a lot of effort removing exactly that.
   *
   * No match is not a failure — it falls through to a real NCERT-grounded
   * explanation rather than guessing at which formula it might be.
   */
  { id: 'formula',   label: 'Formula',       icon: FunctionSquare, color: '#7C5CFF',
    hint: 'Snap a formula — what it means, and where it comes from',
    prompt: 'Read the single most prominent formula or equation in this image.\n\nReturn ONLY a JSON object:\n{"formula":"<the formula exactly as written, plain notation>","name":"<its usual name if you are confident, else null>","readable":true|false}\n\nDo not explain it. Do not solve it. If no formula is visible, set readable to false.' },
  { id: 'summarize', label: 'Summarize',     icon: FileText,     color: '#A5B4FC',
    hint: 'Condenses notes into key points',
    prompt: 'Summarize the STUDY CONTENT in this image into clear bullet points under "## Section Name" headings. Capture every definition, formula, law and labelled diagram part exactly as the book states them — a summary that reworded NCERT would cost the student marks.' + NCERT_RULES + MD_RULES },
]

interface VisionMsg {
  role: 'user' | 'assistant' | 'system'
  content: string | Array<
    | { type: 'text'; text: string }
    | { type: 'image_url'; image_url: { url: string } }
  >
}

export default function CameraStudy() {
  const [imageData, setImageData] = useState<string | null>(null)
  const [model, setModel]         = useState(VISION_MODELS[0].id)
  const [busy, setBusy]           = useState(false)
  const [activeAction, setActiveAction] = useState<string | null>(null)
  const [result, setResult]       = useState('')
  // Parsed flashcards, rendered as cards rather than dumped as JSON.
  const [cards, setCards]         = useState<{ front: string; back: string }[]>([])
  const [savedNote, setSavedNote] = useState('')
  const [err, setErr]             = useState('')
  const [docBusy, setDocBusy]     = useState(false)
  const [docResult, setDocResult] = useState('')
  const [docMeta, setDocMeta]     = useState('')
  const [showCamera, setShowCamera] = useState(false)
  const [streamRef, setStreamRef] = useState<MediaStream | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoRef     = useRef<HTMLVideoElement>(null)
  const canvasRef    = useRef<HTMLCanvasElement>(null)

  useEffect(() => () => stopCamera(), [streamRef])

  function stopCamera() {
    if (streamRef) {
      streamRef.getTracks().forEach(t => t.stop())
      setStreamRef(null)
    }
    setShowCamera(false)
  }

  async function openCamera() {
    setErr('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1440 } },
      })
      setStreamRef(stream)
      setShowCamera(true)
      requestAnimationFrame(() => {
        if (videoRef.current) videoRef.current.srcObject = stream
      })
    } catch (e: any) {
      setErr('Camera unavailable: ' + (e.message || 'permission denied'))
    }
  }

  function downscaleImage(dataUrl: string, maxDim = 1024, quality = 0.8): Promise<string> {
    return new Promise((resolve) => {
      const img = new Image()
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
        if (scale >= 1) { resolve(dataUrl); return }
        const c = document.createElement('canvas')
        c.width = Math.round(img.width * scale)
        c.height = Math.round(img.height * scale)
        const ctx = c.getContext('2d')
        if (!ctx) { resolve(dataUrl); return }
        ctx.drawImage(img, 0, 0, c.width, c.height)
        resolve(c.toDataURL('image/jpeg', quality))
      }
      img.onerror = () => resolve(dataUrl)
      img.src = dataUrl
    })
  }

  function snap() {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return
    const MAX = 1024
    const s = Math.min(1, MAX / Math.max(video.videoWidth, video.videoHeight))
    canvas.width  = Math.round(video.videoWidth * s)
    canvas.height = Math.round(video.videoHeight * s)
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    setImageData(canvas.toDataURL('image/jpeg', 0.8))
    stopCamera()
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }

  /** PDFs / text files go to the document reader, not the vision pipeline. */
  async function handleDocument(file: File) {
    setErr('')
    setDocBusy(true)
    setDocResult('')
    try {
      const b64 = await new Promise<string>((resolve, reject) => {
        const fr = new FileReader()
        fr.onerror = () => reject(new Error('read failed'))
        fr.onloadend = () => resolve(String(fr.result).split(',')[1] || '')
        fr.readAsDataURL(file)
      })
      const r = await fetch('/api/document/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...aiHeaders() },
        body: JSON.stringify({
          file: b64,
          mime: file.type || 'application/pdf',
          name: file.name,
          mode: 'explain',
        }),
      })
      const j = await r.json().catch(() => null)
      if (!r.ok || !j?.markdown) {
        setErr(j?.error || `Could not read that document (${r.status}).`)
        return
      }
      setDocResult(j.markdown)
      setDocMeta(
        j.source === 'text-pdf' ? `Read ${j.pages || '?'} pages of text directly from the PDF`
        : j.source === 'vision' ? 'Read the pages visually'
        : 'Read the file'
      )
    } catch (e: any) {
      setErr(`Could not read that document. ${String(e?.message || '').slice(0, 80)}`)
    } finally {
      setDocBusy(false)
    }
  }

  function handleFile(file: File) {
    const isDoc = /pdf|text\/|markdown/i.test(file.type) || /\.(pdf|txt|md)$/i.test(file.name)
    if (isDoc) { handleDocument(file); return }
    if (!file.type.startsWith('image/')) {
      setErr('Upload a photo, a PDF, or a .txt / .md file.')
      return
    }
    // Do NOT reject on the raw file size: every image is downscaled to 1024px
    // (a few hundred KB) before it is sent, so a normal 8-12 MB phone photo is
    // perfectly fine. Only guard against something absurd that would stall the
    // reader on a low-end device.
    if (file.size > 40 * 1024 * 1024) {
      setErr('That file is unusually large (over 40 MB). Try a photo instead.')
      return
    }
    setErr('')
    const reader = new FileReader()
    reader.onerror = () => setErr('Could not read that file. Try another photo.')
    reader.onload = async ev => {
      try {
        const small = await downscaleImage(ev.target?.result as string)
        setImageData(small)
        setErr('')
      } catch {
        setErr('Could not process that image. Try another photo.')
      }
    }
    reader.readAsDataURL(file)
  }

  const run = useCallback(async (action: typeof ACTIONS[0]) => {
    if (!imageData) return
    setBusy(true); setActiveAction(action.id); setErr(''); setResult('')
    setCards([]); setSavedNote('')
    try {
      const messages: VisionMsg[] = [
        {
          role: 'user',
          content: [
            { type: 'text',      text: action.prompt },
            { type: 'image_url', image_url: { url: imageData } },
          ],
        },
      ]
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...aiHeaders() },
        body: JSON.stringify({ model, messages }),
      })
      const raw = await res.text()
      if (!res.ok) throw new Error((raw || `HTTP ${res.status}`).slice(0, 160))
      let data: any
      try { data = JSON.parse(raw) }
      catch { throw new Error('The vision service returned an unexpected response (it may be overloaded or the photo too large). Try again or pick another model.') }
      if (data?._fallback) throw new Error('Vision AI is busy or not enabled right now — try again in a moment, or switch models.')
      const text = data?.choices?.[0]?.message?.content
      if (!text) throw new Error('Empty response — try a different model.')
      setResult(typeof text === 'string' ? text : JSON.stringify(text))

      saveRecentChat({
        id: `cam_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        title: makeTitle(`📷 ${action.label}: ${typeof text === 'string' ? text.slice(0, 80) : ''}`),
        messages: [
          { id: '1', role: 'user', content: `[Camera Study · ${action.label}]` },
          { id: '2', role: 'assistant', content: typeof text === 'string' ? text : '' },
        ],
        updated: Date.now(),
      })

      if (action.id === 'formula') {
        const md = typeof text === 'string' ? text : ''
        const obj = md.match(/\{[\s\S]*\}/)
        let read: { formula?: string; name?: string | null } = {}
        try { read = obj ? JSON.parse(obj[0]) : {} }
        catch (e) { console.warn('[camera] formula JSON did not parse:', e) }

        const expr = (read.formula || '').trim()
        if (!expr) {
          setResult('')
          setErr("Couldn't find a formula in that photo. Try a closer shot of just the formula.")
        } else {
          // Signature match against the student's own sheet: V = IR finds the
          // card they saved as R = V/I, because both relate {I, R, V}.
          const sig = formulaSignature(expr)
          const match = sig
            ? listFormulas().find(f => formulaSignature(f.expr) === sig)
            : undefined

          if (match) {
            const variants = (match.variants || []).filter(Boolean)
            setResult(
              `## ${match.name || 'From your formula sheet'}\n\n**${match.expr}**\n\n` +
              (variants.length ? `Also written as: ${variants.map(v => `\`${v}\``).join(', ')}\n\n` : '') +
              (match.topic ? `**Topic:** ${match.topic}\n\n` : '') +
              (match.subject ? `**Subject:** ${match.subject}\n\n` : '') +
              `## Read from your page\n\n\`${expr}\`\n\n` +
              `You already have this one saved — it matched a formula on your sheet.`,
            )
          } else {
            // Honest fallback: say it is not on the sheet, then explain it for
            // real rather than guessing at which formula it resembles.
            setResult(
              `## Read from your page\n\n\`${expr}\`` +
              (read.name ? `\n\nThis looks like **${read.name}**.` : '') +
              `\n\nNot on your formula sheet yet. Tap **Explain** for a full NCERT breakdown, or **Solve** if it came with a question.`,
            )
          }
        }
      }

      if (action.id === 'balance') {
        const md = typeof text === 'string' ? text : ''
        const obj = md.match(/\{[\s\S]*\}/)
        let eqText = ''
        try { eqText = obj ? (JSON.parse(obj[0]).equation || '') : '' }
        catch (e) { console.warn('[camera] balance JSON did not parse:', e) }

        if (!eqText) {
          setResult('')
          setErr("Couldn't read an equation in that photo. Try a closer, sharper shot of just the equation.")
        } else {
          const r = balance(eqText)
          if (r.ok) {
            // Rendered as markdown so the existing renderer handles it; the
            // CONTENT is computed, not generated.
            setResult(
              `## Balanced\n\n**${r.balanced}**\n\n## Read from your page\n\n\`${eqText}\`\n\n## How it balances\n\n` +
              r.steps.map(s => `- ${s}`).join('\n'),
            )
          } else {
            // Honest failure rather than a plausible-looking wrong balance.
            setResult(`## Read from your page\n\n\`${eqText}\`\n\n## Couldn't balance it\n\n${r.reason}`)
          }
        }
      }

      if (action.id === 'flashcards') {
        /**
         * Three bugs lived here.
         *
         * 1. The raw JSON array was passed to setResult() and rendered as
         *    markdown, so the student saw a code block instead of cards.
         * 2. The parsed cards were written to 'kairo_camera_flashcards' — a key
         *    written in this one place and read nowhere. That is why chat could
         *    say "created 10 flashcards" and the Flashcards screen stayed empty.
         *    They now go through recordFlashcard(), the real store, which also
         *    canonicalises the topic and skips same-hour duplicates.
         * 3. A parse failure was swallowed by `catch {}`, so a malformed
         *    response looked identical to success.
         */
        const md = typeof text === 'string' ? text : ''

        // Refuses non-study images. It previously made cards from a hotel
        // booking — "What is the check-out date?" is not revision, and filing
        // it into Flashcards pollutes the deck the student actually revises.
        if (/"notStudyMaterial"\s*:\s*true/.test(md)) {
          setCards([])
          setResult('')
          setErr("That doesn't look like study material. Photograph a textbook page, your notes, or a question.")
          setBusy(false)
          setActiveAction(null)
          return
        }

        const match = md.match(/\[[\s\S]*\]/)
        let parsed: { front: string; back: string }[] = []
        try {
          if (match) parsed = JSON.parse(match[0])
        } catch (e) {
          console.warn('[camera] flashcard JSON did not parse:', e)
        }

        const good = (Array.isArray(parsed) ? parsed : []).filter(
          c => c && typeof c.front === 'string' && typeof c.back === 'string' && c.front.trim() && c.back.trim(),
        )

        if (good.length) {
          let saved = 0
          for (const c of good) {
            try {
              // No topic passed: this screen does not detect one, and
              // canonicalTopic() rejects a guess anyway. Better untagged than
              // filed under something invented.
              recordFlashcard({
                front: c.front.trim(),
                back: c.back.trim(),
                source: 'camera' as any,
              })
              saved++
            } catch (e) {
              console.warn('[camera] could not save a card:', e)
            }
          }
          setCards(good)
          // Replaces the JSON dump. The cards below ARE the result.
          setResult('')
          setSavedNote(
            saved === good.length
              ? `${saved} card${saved === 1 ? '' : 's'} saved to Flashcards.`
              : `${saved} of ${good.length} cards saved — the rest could not be stored.`,
          )
        } else {
          // Honest failure instead of a code block the student cannot use.
          setCards([])
          setResult('')
          setErr("Kyno couldn't turn that image into flashcards. Try a clearer photo of a textbook or notes page.")
        }
      }

      // "Check my work" feeds the twin: a real slip becomes a tracked mistake so it
      // shows up in Mistake Analysis / weak spots; a clean check just earns XP.
      if (action.id === 'check') {
        try {
          const md = typeof text === 'string' ? text : ''
          const verdict = (md.match(/##\s*Verdict\s*\n+([^\n]+)/i)?.[1] || '').trim()
          const slip    = (md.match(/##\s*The exact slip\s*\n+([\s\S]*?)(?=\n##\s|$)/i)?.[1] || '').trim()
          const wrong   = /step\s*\d+/i.test(verdict) || /❌/.test(md)
          if (wrong && !/^no slip/i.test(slip)) {
            const topic = (md.match(/##\s*Right answer\s*\n+([^\n]+)/i)?.[1] || 'Camera Study problem').trim().slice(0, 60)
            recordMistake({
              topic,
              detail: (verdict + ' — ' + slip).replace(/\s+/g, ' ').slice(0, 300),
            })
          } else {
            try { awardXP('chat_answer') } catch {  }
          }
        } catch {  }
      }
    } catch (e: any) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }, [imageData, model])

  const reset = () => {
    setImageData(null); setResult(''); setActiveAction(null); setErr('')
    setCards([]); setSavedNote('')
  }

  return (
    <div style={{ padding: '28px 36px', maxWidth: 1100, margin: '0 auto', height: '100%', overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 22 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 11,
          background: 'linear-gradient(135deg, #7C5CFF, #7C5CFF)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 18px rgba(124, 92, 255, 0.04)', flexShrink: 0,
        }}>
          <Camera size={22} color="#fff" />
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#fafafa', margin: 0 }}>Camera Study Mode</h1>
          <p style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>
            Snap your own working and Kyno finds the exact step you got wrong — or photograph a
            textbook page to solve, explain, or turn it into flashcards.
          </p>
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 1.5, display: 'block', marginBottom: 8 }}>
          Vision Model
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {VISION_MODELS.map(m => (
            <button key={m.id} onClick={() => setModel(m.id)} style={{
              padding: '10px 14px', borderRadius: 9,
              border: `1.5px solid ${model === m.id ? '#7C5CFF' : '#1f2532'}`,
              background: model === m.id ? 'rgba(124, 92, 255, 0.20)' : '#141A2A',
              cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
              transition: 'all 0.15s',
              boxShadow: model === m.id ? '0 2px 12px rgba(124, 92, 255,0.28)' : 'none',
            }}>
              <div style={{
                fontSize: 12, fontWeight: model === m.id ? 800 : 700,
                color: model === m.id ? '#fff' : '#d4d4d8', marginBottom: 3,
              }}>
                {m.label}
              </div>
              <div style={{ fontSize: 10.5, color: '#6B7280', lineHeight: 1.4 }}>{m.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {!imageData && !showCamera && (
        <div
          onDrop={onDrop}
          onDragOver={e => e.preventDefault()}
          style={{
            border: '2px dashed #2d2d4d', borderRadius: 14, padding: '46px 24px',
            background: '#141A2A', textAlign: 'center', marginBottom: 14,
          }}>
          <div style={{
            width: 60, height: 60, borderRadius: 16, margin: '0 auto 14px',
            background: 'rgba(124, 92, 255, 0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Upload size={26} color="#A5B4FC" />
          </div>
          <p style={{ fontSize: 14, color: '#fafafa', fontWeight: 600, margin: '0 0 6px' }}>
            Drag a photo here, or pick a source
          </p>
          <p style={{ fontSize: 12, color: '#6B7280', margin: '0 0 18px' }}>
            Photo (JPG / PNG / HEIC) or a PDF · works best with clear, in-focus shots
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button onClick={() => fileInputRef.current?.click()} className="kyno-chunky" style={{
              padding: '11px 18px', fontSize: 13,
              display: 'flex', alignItems: 'center', gap: 7,
            }}>
              <Upload size={13} /> Upload Image or PDF
            </button>
            <button onClick={openCamera} className="kyno-ghost" style={{
              padding: '11px 18px', fontSize: 13,
              display: 'flex', alignItems: 'center', gap: 7,
            }}>
              <Camera size={13} /> Use Camera
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf,.pdf,.txt,.md"
            style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
          />
        </div>
      )}

      {/* ── document reading (PDF / txt) ── */}
      {docBusy && (
        <div style={{
          margin: '0 auto 18px', maxWidth: 720, padding: '14px 16px',
          border: '1px solid rgba(165,180,252,0.18)', borderRadius: 14,
          background: 'rgba(124,92,255,0.06)', color: '#c7d2fe', fontSize: 13,
        }}>
          Reading your document…
        </div>
      )}

      {docResult && !docBusy && (
        <div style={{
          margin: '0 auto 18px', maxWidth: 720, padding: '18px 20px',
          border: '1px solid rgba(165,180,252,0.18)', borderRadius: 16,
          background: 'rgba(255,255,255,0.03)',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: 10, marginBottom: 10,
          }}>
            <span style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#8b8b93' }}>
              {docMeta || 'Document'}
            </span>
            <button
              onClick={() => { setDocResult(''); setDocMeta('') }}
              className="kyno-ghost"
              style={{ padding: '5px 12px', fontSize: 12 }}
            >
              Clear
            </button>
          </div>
          <div style={{ fontSize: 14, lineHeight: 1.75, color: '#e7e9ee', whiteSpace: 'pre-wrap' }}>
            {docResult}
          </div>
        </div>
      )}

      <AnimatePresence>
        {showCamera && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{
              border: '1px solid #2d2d4d', borderRadius: 14, padding: 12,
              background: '#000', textAlign: 'center', marginBottom: 14,
            }}>
            <video ref={videoRef} autoPlay playsInline
              style={{ width: '100%', maxHeight: 400, borderRadius: 8, objectFit: 'cover' }} />
            <canvas ref={canvasRef} style={{ display: 'none' }} />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 10 }}>
              <button onClick={snap} style={{
                padding: '11px 22px', borderRadius: 9, border: 'none',
                background: 'linear-gradient(135deg,#7C5CFF,#7C5CFF)', color: '#fff',
                fontFamily: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 7,
              }}>
                <Camera size={14} /> Capture
              </button>
              <button onClick={stopCamera} style={{
                padding: '11px 18px', borderRadius: 9, border: '1px solid #1f2532',
                background: '#1C2233', color: '#B1B5BA',
                fontFamily: 'inherit', fontSize: 13, cursor: 'pointer',
              }}>Cancel</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {imageData && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
          className="mob-stack" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div style={{
            background: '#141A2A', border: '1px solid #1f2532', borderRadius: 14, padding: 12,
            position: 'relative',
          }}>
            <img src={imageData} alt="Captured"
              style={{ width: '100%', borderRadius: 8, display: 'block', maxHeight: 400, objectFit: 'contain', background: '#000' }} />
            <button onClick={reset} title="Remove" style={{
              position: 'absolute', top: 18, right: 18, width: 28, height: 28, borderRadius: 7,
              background: 'rgba(0,0,0,0.6)', border: '1px solid #2d2d4d', color: '#fff',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <X size={13} />
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {ACTIONS.map(a => {
              const isActive = activeAction === a.id && busy
              return (
                <motion.button key={a.id}
                  whileHover={{ y: busy ? 0 : -2 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => run(a)}
                  disabled={busy}
                  style={{
                    padding: 16, borderRadius: 12,
                    border: `1px solid ${isActive ? a.color : '#1f2532'}`,
                    background: isActive ? `${a.color}10` : '#141A2A',
                    cursor: busy ? 'not-allowed' : 'pointer',
                    fontFamily: 'inherit', textAlign: 'left',
                    display: 'flex', flexDirection: 'column', gap: 8,
                    transition: 'all 0.15s',
                    opacity: busy && !isActive ? 0.5 : 1,
                  }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 8,
                    background: `${a.color}18`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {isActive
                      ? <Loader2 size={15} color={a.color} style={{ animation: 'spin 0.8s linear infinite' }} />
                      : <a.icon size={15} color={a.color} />}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#fafafa' }}>
                    {isActive ? `${a.label}…` : a.label}
                  </div>
                  {a.hint && (
                    <div style={{ fontSize: 11, color: '#6B7280', lineHeight: 1.4, marginTop: -2 }}>
                      {a.hint}
                    </div>
                  )}
                </motion.button>
              )
            })}
          </div>
        </motion.div>
      )}

      {err && (
        <div style={{ marginBottom: 14, padding: '10px 14px', background: 'rgba(165, 180, 252, 0.08)', border: '1px solid rgba(165, 180, 252, 0.25)', borderRadius: 8, fontSize: 12, color: '#A5B4FC' }}>
          {err}
        </div>
      )}

      <AnimatePresence>
        {(result || cards.length > 0) && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{
              background: '#141A2A', border: '1px solid #2d2b55', borderRadius: 14,
              padding: 22,
            }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <CheckCircle2 size={15} color="#A5B4FC" />
              <span style={{ fontSize: 12, fontWeight: 700, color: '#A5B4FC', textTransform: 'uppercase', letterSpacing: 1.5 }}>
                AI Result
              </span>
              <span style={{ marginLeft: 'auto', fontSize: 11, color: '#6B7280' }}>
                Saved to recent chats
              </span>
            </div>
            {/* Flashcards render AS cards. The JSON array used to go straight
                into the markdown renderer, so the student got a code block
                they could not revise from. */}
            {cards.length > 0 ? (
              <div style={{ display: 'grid', gap: 10 }}>
                {savedNote && (
                  <div style={{ fontSize: 12, color: '#4FD8E8', marginBottom: 2 }}>
                    {savedNote}
                  </div>
                )}
                {cards.map((c, i) => (
                  <div key={i} style={{
                    background: '#1C2233', border: '1px solid #2d2b55',
                    borderRadius: 10, padding: '12px 14px',
                  }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: '#fafafa', lineHeight: 1.5 }}>
                      {c.front}
                    </div>
                    <div style={{
                      fontSize: 13, color: '#B1B5BA', marginTop: 7, paddingTop: 7,
                      borderTop: '1px solid #2d2b55', lineHeight: 1.55,
                    }}>
                      {c.back}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="prose-ai" style={{ fontSize: 14, color: '#e4e4e7', lineHeight: 1.7 }}>
                <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                  {cleanMarkdown(result)}
                </ReactMarkdown>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button onClick={() => navigator.clipboard.writeText(result)} style={{
                padding: '6px 12px', borderRadius: 7, border: '1px solid #1f2532',
                background: '#1C2233', color: '#B1B5BA', cursor: 'pointer',
                fontFamily: 'inherit', fontSize: 11, display: 'flex', alignItems: 'center', gap: 5,
              }}>
                Copy
              </button>
              <button onClick={reset} style={{
                padding: '6px 12px', borderRadius: 7, border: '1px solid #1f2532',
                background: '#1C2233', color: '#B1B5BA', cursor: 'pointer',
                fontFamily: 'inherit', fontSize: 11, display: 'flex', alignItems: 'center', gap: 5,
              }}>
                <RotateCcw size={11} /> Try another image
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function cleanMarkdown(s: string): string {
  return s
    .replace(/<\/?think(?:ing)?>[\s\S]*?<\/?think(?:ing)?>/gi, '')
    .replace(/^(\s*#{1,6})([^\s#])/gm, '$1 $2')
    .replace(/^\s*```\s*$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
