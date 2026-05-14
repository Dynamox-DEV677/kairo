import { useState } from 'react'
import { motion } from 'framer-motion'
import { BookMarked, ChevronLeft, ChevronRight, Sparkles, RotateCcw } from 'lucide-react'
import { chat } from '../lib/openrouter'
import { usePageGeneration } from '../lib/generationContext'
import { saveToNotebook } from '../lib/notebook'
import { recordFlashcard } from '../lib/twin'

const SYSTEM = `You are Kairo, an expert tutor for Indian school students.
When given a chapter or topic, generate exactly 8-12 flashcards in this JSON format:
[{"front": "Question or term", "back": "Answer or definition"}]
Return ONLY the JSON array, no other text. Make cards concise, accurate, and useful for board exam revision.`

interface Card { front: string; back: string }

export default function Flashcards() {
  const [topic, setTopic] = useState('')
  const [cards, setCards] = useState<Card[]>([])
  const [current, setCurrent] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { startGenerating, stopGenerating } = usePageGeneration('flashcards')

  async function generate() {
    if (!topic.trim()) return
    setLoading(true); setError(''); setCards([]); setCurrent(0); setFlipped(false)
    startGenerating()
    try {
      const result = await chat({
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: `Generate flashcards for: ${topic}` },
        ],
      })

      // Strip thinking blocks (reasoning models output <think>...</think>)
      let clean = result
        .replace(/<think>[\s\S]*?<\/think>/gi, '')
        .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
        // Strip markdown code fences
        .replace(/```(?:json)?\s*/gi, '')
        .replace(/```/g, '')
        .trim()

      // Try direct parse first
      let parsed: Card[] | null = null
      try {
        const direct = JSON.parse(clean)
        if (Array.isArray(direct)) parsed = direct
      } catch { /* fall through */ }

      // Fallback: greedy match for the outermost JSON array
      if (!parsed) {
        const start = clean.indexOf('[')
        const end   = clean.lastIndexOf(']')
        if (start === -1 || end === -1 || end <= start) {
          console.error('[Flashcards] Raw AI response:', result)
          throw new Error('AI response had no JSON array. Check console and try again.')
        }
        try {
          parsed = JSON.parse(clean.slice(start, end + 1))
        } catch (parseErr: any) {
          console.error('[Flashcards] Parse failed. Raw:', result, '\nCleaned:', clean)
          throw new Error('Could not parse the JSON the AI returned. Try again.')
        }
      }

      // Validate shape
      const valid = (parsed || []).filter(c => c && typeof c.front === 'string' && typeof c.back === 'string')
      if (valid.length === 0) {
        console.error('[Flashcards] Parsed but empty/invalid:', parsed)
        throw new Error('AI returned 0 valid cards. Try a more specific topic.')
      }

      setCards(valid)

      // ── Persist every card into the unified memory engine (twin) ────────
      // This lets Notebook's "Auto-collected" strip + future Kairo OS deck
      // viewer see every card across every generation. Each card gets its
      // own SRS row (initial ease 2.5, dueAt = now).
      try {
        for (const c of valid) {
          recordFlashcard({
            front:   c.front,
            back:    c.back,
            topic:   topic,
            source:  'auto-from-doubt',
          })
        }
      } catch { /* ignore */ }

      // Auto-save to notebook (best-effort, fire-and-forget)
      saveToNotebook({
        kind: 'flashcards',
        title: `Flashcards · ${topic}`,
        content: valid.map((c, i) => `**${i + 1}. ${c.front}**\n\n${c.back}`).join('\n\n---\n\n'),
        subject: null,
        tags: [topic.split(' ')[0]],
        source: 'flashcards-page',
      })
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false); stopGenerating() }
  }

  function prev() { setCurrent(c => Math.max(0, c - 1)); setFlipped(false) }
  function next() { setCurrent(c => Math.min(cards.length - 1, c + 1)); setFlipped(false) }

  const card = cards[current]

  return (
    <div style={{ padding: '28px 36px', maxWidth: 820, margin: '0 auto', height: '100%', overflowY: 'auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#fafafa', margin: 0, letterSpacing: '-0.4px' }}>Flashcard Generator</h1>
        <p style={{ fontSize: 13, color: '#52525b', marginTop: 4 }}>Enter a chapter or topic — get instant revision cards</p>
      </div>

      {/* Input */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 28 }}>
        <input
          style={{
            flex: 1, background: '#111', border: '1px solid #1e1e1e', borderRadius: 10,
            padding: '10px 14px', fontSize: 14, color: '#fafafa', outline: 'none',
            fontFamily: 'inherit', transition: 'border-color 0.15s',
          }}
          placeholder="e.g. NCERT Class 10 Chapter 6 — Life Processes"
          value={topic}
          onChange={e => setTopic(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && generate()}
          onFocus={e => (e.target as HTMLInputElement).style.borderColor = '#a78bfa'}
          onBlur={e => (e.target as HTMLInputElement).style.borderColor = '#1e1e1e'}
        />
        <motion.button
          whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
          onClick={generate}
          disabled={loading || !topic.trim()}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '10px 20px', borderRadius: 10, border: 'none',
            background: topic.trim() ? 'linear-gradient(135deg, #7c3aed, #5b21b6)' : '#1c1c1c',
            color: topic.trim() ? '#fff' : '#52525b',
            fontFamily: 'inherit', fontSize: 14, fontWeight: 600,
            cursor: topic.trim() ? 'pointer' : 'not-allowed',
            boxShadow: topic.trim() ? '0 0 20px rgba(124,58,237,0.45)' : 'none',
            flexShrink: 0, transition: 'all 0.2s',
          }}
        >
          <Sparkles size={14} />
          {loading ? 'Generating…' : 'Generate'}
        </motion.button>
      </div>

      {error && <p style={{ fontSize: 13, color: '#f87171', marginBottom: 20 }}>{error}</p>}

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 16 }}>
            {[0,1,2].map(i => (
              <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: '#6366f1', animation: `dot-bounce 1.2s ease-in-out ${i * 0.2}s infinite` }} />
            ))}
          </div>
          <p style={{ fontSize: 13, color: '#52525b' }}>Generating flashcards…</p>
        </div>
      )}

      {/* Empty state */}
      {!loading && cards.length === 0 && !error && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} style={{ textAlign: 'center', padding: '60px 0' }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: '#111', border: '1px solid #1e1e1e', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <BookMarked size={22} color="#6366f1" />
          </div>
          <p style={{ fontSize: 14, color: '#52525b' }}>Enter a chapter or topic above to generate flashcards</p>
        </motion.div>
      )}

      {/* Cards */}
      {cards.length > 0 && !loading && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          {/* Progress */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
            <div style={{ flex: 1, height: 4, background: '#1e1e1e', borderRadius: 2, overflow: 'hidden' }}>
              <motion.div
                animate={{ width: `${((current + 1) / cards.length) * 100}%` }}
                style={{ height: '100%', background: 'linear-gradient(90deg, #6366f1, #818cf8)', borderRadius: 2 }}
              />
            </div>
            <span style={{ fontSize: 12, color: '#52525b', flexShrink: 0 }}>{current + 1} / {cards.length}</span>
          </div>

          {/* Flip card */}
          <div
            onClick={() => setFlipped(f => !f)}
            style={{ width: '100%', height: 260, perspective: 1200, cursor: 'pointer', marginBottom: 20 }}
          >
            <motion.div
              animate={{ rotateY: flipped ? 180 : 0 }}
              transition={{ duration: 0.5, ease: [0.45, 0.05, 0.55, 0.95] }}
              style={{ width: '100%', height: '100%', position: 'relative', transformStyle: 'preserve-3d' }}
            >
              {/* Front */}
              <div style={{
                position: 'absolute', inset: 0, backfaceVisibility: 'hidden',
                background: '#111', border: '1px solid #1e1e1e', borderRadius: 18,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40,
              }}>
                <span style={{ position: 'absolute', top: 16, left: 20, fontSize: 10, fontWeight: 700, color: '#3f3f46', textTransform: 'uppercase', letterSpacing: 1.5 }}>Question</span>
                <p style={{ fontSize: 19, fontWeight: 600, color: '#fafafa', margin: 0, lineHeight: 1.5, textAlign: 'center', letterSpacing: '-0.3px' }}>{card?.front}</p>
                <span style={{ position: 'absolute', bottom: 16, fontSize: 11, color: '#3f3f46' }}>Click to reveal answer</span>
              </div>
              {/* Back */}
              <div style={{
                position: 'absolute', inset: 0, backfaceVisibility: 'hidden',
                background: '#0f0f1e', border: '1px solid #2d2b55', borderRadius: 18,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40,
                transform: 'rotateY(180deg)',
              }}>
                <span style={{ position: 'absolute', top: 16, left: 20, fontSize: 10, fontWeight: 700, color: '#6366f1', textTransform: 'uppercase', letterSpacing: 1.5 }}>Answer</span>
                <p style={{ fontSize: 16, fontWeight: 500, color: '#c7d2fe', margin: 0, lineHeight: 1.65, textAlign: 'center' }}>{card?.back}</p>
                <span style={{ position: 'absolute', bottom: 16, fontSize: 11, color: '#4338ca' }}>Click to see question</span>
              </div>
            </motion.div>
          </div>

          {/* Controls */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 36 }}>
            <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={prev} disabled={current === 0}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 8, border: '1px solid #1e1e1e', background: '#111', color: current === 0 ? '#3f3f46' : '#a1a1aa', cursor: current === 0 ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontSize: 13 }}>
              <ChevronLeft size={15} /> Prev
            </motion.button>

            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              {cards.map((_, i) => (
                <motion.button key={i} onClick={() => { setCurrent(i); setFlipped(false) }}
                  animate={{ width: i === current ? 20 : 6 }}
                  style={{ height: 6, borderRadius: 3, background: i === current ? '#6366f1' : '#27272a', border: 'none', cursor: 'pointer', padding: 0 }}
                />
              ))}
            </div>

            <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={next} disabled={current === cards.length - 1}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 8, border: '1px solid #1e1e1e', background: '#111', color: current === cards.length - 1 ? '#3f3f46' : '#a1a1aa', cursor: current === cards.length - 1 ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontSize: 13 }}>
              Next <ChevronRight size={15} />
            </motion.button>
          </div>

          {/* All cards list */}
          <div style={{ borderTop: '1px solid #1a1a1a', paddingTop: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#3f3f46', textTransform: 'uppercase', letterSpacing: 1 }}>All {cards.length} cards</p>
              <motion.button whileHover={{ scale: 1.02 }} onClick={() => { setCards([]); setTopic('') }}
                style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#52525b', background: 'none', border: '1px solid #1e1e1e', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontFamily: 'inherit' }}>
                <RotateCcw size={11} /> Reset
              </motion.button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {cards.map((c, i) => (
                <motion.div key={i} whileHover={{ x: 2 }} onClick={() => { setCurrent(i); setFlipped(false) }}
                  style={{ background: current === i ? '#1c1c1c' : 'transparent', border: `1px solid ${current === i ? '#27272a' : '#1a1a1a'}`, borderRadius: 8, padding: '9px 14px', cursor: 'pointer', display: 'flex', gap: 12, alignItems: 'flex-start', transition: 'border-color 0.1s' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: current === i ? '#6366f1' : '#3f3f46', paddingTop: 2, minWidth: 18, textAlign: 'right' }}>{i + 1}</span>
                  <span style={{ fontSize: 13, color: current === i ? '#d4d4d8' : '#71717a', lineHeight: 1.4 }}>{c.front}</span>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  )
}
