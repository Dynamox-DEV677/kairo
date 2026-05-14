/**
 * Flashcards — two modes:
 *   1. Generate — AI builds a fresh deck from a topic
 *   2. Review   — Anki-style flip through every card saved in the unified
 *                 memory engine (twin.listFlashcards()). Each card was
 *                 either AI-generated here or auto-saved from another page.
 *
 * Strict monochrome palette: black + deep purple + white only.
 */
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BookMarked, ChevronLeft, ChevronRight, Sparkles, RotateCcw,
  Library, Check, X,
} from 'lucide-react'
import { chat } from '../lib/openrouter'
import { usePageGeneration } from '../lib/generationContext'
import { saveToNotebook } from '../lib/notebook'
import { recordFlashcard, listFlashcards, type Flashcard as TwinCard } from '../lib/twin'

interface Card { front: string; back: string }

const SYSTEM = `You are Kairo, an expert tutor for Indian school students.
When given a chapter or topic, generate exactly 8-12 flashcards in this JSON format:
[{"front": "Question or term", "back": "Answer or definition"}]
Return ONLY the JSON array, no other text. Make cards concise, accurate, and useful for board exam revision.`

export default function Flashcards() {
  const [mode, setMode] = useState<'generate' | 'review'>('generate')
  const [topic, setTopic] = useState('')
  const [cards, setCards] = useState<Card[]>([])
  const [current, setCurrent] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { startGenerating, stopGenerating } = usePageGeneration('flashcards')

  // SRS deck (reloaded each time the review tab is opened)
  const [deck, setDeck] = useState<TwinCard[]>([])
  function reloadDeck() { setDeck(listFlashcards().slice(0, 200)) }
  useEffect(() => { if (mode === 'review') reloadDeck() }, [mode])

  async function generate() {
    if (!topic.trim()) return
    setLoading(true); setError(''); setCards([]); setCurrent(0); setFlipped(false)
    startGenerating()
    try {
      const result = await chat({
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user',   content: `Generate flashcards for: ${topic}` },
        ],
      })
      let parsed: Card[] = []
      try { parsed = JSON.parse(result) } catch {
        const m = result.match(/\[[\s\S]*\]/)
        if (m) try { parsed = JSON.parse(m[0]) } catch {}
      }
      const valid = (parsed || []).filter(c => c && typeof c.front === 'string' && typeof c.back === 'string')
      if (valid.length === 0) throw new Error('AI returned 0 valid cards. Try a more specific topic.')
      setCards(valid)
      try {
        for (const c of valid) {
          recordFlashcard({ front: c.front, back: c.back, topic, source: 'auto-from-doubt' })
        }
      } catch { /* ignore */ }
      saveToNotebook({
        kind: 'flashcards',
        title: `Flashcards · ${topic}`,
        content: valid.map((c, i) => `**${i + 1}. ${c.front}**\n\n${c.back}`).join('\n\n---\n\n'),
        subject: null,
        tags: [topic.split(' ')[0]],
        source: 'flashcards-page',
      })
    } catch (e: any) { setError(e.message || 'Failed') }
    finally { setLoading(false); stopGenerating() }
  }

  function prev() { setCurrent(c => Math.max(0, c - 1)); setFlipped(false) }
  function next() { setCurrent(c => Math.min(cards.length - 1, c + 1)); setFlipped(false) }
  const card = cards[current]

  return (
    <div style={{ padding: '28px 36px', maxWidth: 820, margin: '0 auto', height: '100%', overflowY: 'auto' }}>
      {/* Header + mode switch */}
      <div style={{ marginBottom: 22, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{
            width: 42, height: 42, borderRadius: 12,
            background: 'linear-gradient(135deg, #7c3aed, #5b21b6)',
            display: 'grid', placeItems: 'center',
            boxShadow: '0 10px 28px rgba(124,58,237,0.45)',
          }}>
            <BookMarked size={20} color="#fff" />
          </div>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: '#fafafa', margin: 0, letterSpacing: -0.4 }}>Flashcards</h1>
            <p style={{ fontSize: 13, color: '#71717a', marginTop: 4 }}>
              {mode === 'generate'
                ? 'Enter a chapter or topic — get instant revision cards'
                : 'Flip through every card you have ever generated'}
            </p>
          </div>
        </div>
        <div style={{
          display: 'inline-flex', padding: 3, borderRadius: 10,
          background: 'rgba(124,58,237,0.06)',
          border: '1px solid rgba(167,139,250,0.22)',
        }}>
          <ModeBtn active={mode === 'generate'} onClick={() => setMode('generate')}>
            <Sparkles size={12} /> Generate
          </ModeBtn>
          <ModeBtn active={mode === 'review'} onClick={() => setMode('review')}>
            <Library size={12} /> Review ({listFlashcards().length})
          </ModeBtn>
        </div>
      </div>

      {mode === 'generate' ? (
        <>
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
              }}>
              <Sparkles size={14} />
              {loading ? 'Generating…' : 'Generate'}
            </motion.button>
          </div>

          {error && <p style={{ fontSize: 13, color: '#f87171', marginBottom: 20 }}>{error}</p>}

          {/* Loading */}
          {loading && (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#71717a' }}>
              <RotateCcw size={20} style={{ animation: 'kr-spin 0.8s linear infinite', display: 'inline-block' }} />
              <p style={{ marginTop: 10, fontSize: 13 }}>Generating your deck…</p>
              <style>{`@keyframes kr-spin { to { transform: rotate(360deg) } }`}</style>
            </div>
          )}

          {/* Generated cards viewer */}
          {!loading && cards.length > 0 && card && (
            <div>
              <div style={{ fontSize: 11, color: '#71717a', letterSpacing: 1.4, textTransform: 'uppercase', fontWeight: 600, marginBottom: 12 }}>
                Card {current + 1} of {cards.length}  ·  {topic}
              </div>
              <FlipCard front={card.front} back={card.back} flipped={flipped} onFlip={() => setFlipped(f => !f)} />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14 }}>
                <button onClick={prev} disabled={current === 0} style={{ ...navBtn, opacity: current === 0 ? 0.4 : 1 }}>
                  <ChevronLeft size={14} /> Previous
                </button>
                <button onClick={next} disabled={current >= cards.length - 1} style={{ ...navBtn, opacity: current >= cards.length - 1 ? 0.4 : 1 }}>
                  Next <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        <ReviewDeck deck={deck} onReload={reloadDeck} />
      )}
    </div>
  )
}

// ─── Mode switch button ────────────────────────────────────────────────────
function ModeBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '7px 12px', borderRadius: 8,
      background: active ? 'linear-gradient(135deg, #7c3aed, #5b21b6)' : 'transparent',
      border: 'none',
      color: active ? '#fff' : '#a1a1aa',
      fontFamily: 'inherit', fontSize: 11.5, fontWeight: 600,
      cursor: 'pointer',
    }}>{children}</button>
  )
}

// ─── Flip card UI ──────────────────────────────────────────────────────────
function FlipCard({ front, back, flipped, onFlip }: { front: string; back: string; flipped: boolean; onFlip: () => void }) {
  return (
    <div onClick={onFlip} style={{
      height: 260, borderRadius: 16, cursor: 'pointer', position: 'relative',
      background: flipped
        ? 'linear-gradient(135deg, #2a1052 0%, #0c0418 100%)'
        : 'linear-gradient(135deg, #1a0c2e 0%, #07060d 100%)',
      border: '1px solid rgba(167,139,250,0.35)',
      padding: '36px 28px',
      display: 'grid', placeItems: 'center', textAlign: 'center',
      boxShadow: '0 20px 50px rgba(124,58,237,0.18)',
      transition: 'background .35s ease',
    }}>
      <div style={{
        position: 'absolute', top: 14, left: 18,
        fontSize: 10, fontWeight: 700, color: '#c4b5fd',
        letterSpacing: 1.6, textTransform: 'uppercase',
      }}>
        {flipped ? 'Answer' : 'Question'}
      </div>
      <AnimatePresence mode="wait">
        <motion.p
          key={flipped ? 'b' : 'f'}
          initial={{ opacity: 0, y: 8, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.97 }}
          transition={{ duration: 0.25 }}
          style={{ margin: 0, fontSize: 18, fontWeight: 600, color: '#fafafa', lineHeight: 1.45, maxWidth: 600 }}>
          {flipped ? back : front}
        </motion.p>
      </AnimatePresence>
      <div style={{
        position: 'absolute', bottom: 12, right: 18,
        fontSize: 10, color: '#52525b', letterSpacing: 1.2, textTransform: 'uppercase', fontWeight: 600,
      }}>
        Click to flip
      </div>
    </div>
  )
}

// ─── Review deck — pulls every saved card from the twin ────────────────────
function ReviewDeck({ deck, onReload }: { deck: TwinCard[]; onReload: () => void }) {
  const [idx, setIdx]         = useState(0)
  const [flipped, setFlipped] = useState(false)
  if (deck.length === 0) {
    return (
      <div style={{
        padding: '60px 24px', textAlign: 'center',
        background: '#111', border: '1px dashed #1e1e1e', borderRadius: 14,
      }}>
        <Library size={32} color="#a78bfa" style={{ opacity: 0.55 }} />
        <h3 style={{ margin: '14px 0 4px', fontSize: 16, fontWeight: 700, color: '#fafafa' }}>
          No saved cards yet
        </h3>
        <p style={{ margin: 0, fontSize: 13, color: '#71717a', maxWidth: 420, marginInline: 'auto' }}>
          Switch to "Generate" and create your first deck — every card auto-saves here for spaced review.
        </p>
      </div>
    )
  }
  const c = deck[idx % deck.length]
  function go(n: number) { setFlipped(false); setIdx(i => (i + n + deck.length) % deck.length) }
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: '#71717a', letterSpacing: 1.4, textTransform: 'uppercase', fontWeight: 600 }}>
          Card {idx + 1} / {deck.length}{c.topic ? `  ·  ${c.topic}` : ''}
        </div>
        <button onClick={onReload} title="Reload deck" style={{
          padding: 6, borderRadius: 8, background: 'transparent',
          border: '1px solid #22222e', color: '#a1a1aa', cursor: 'pointer',
        }}>
          <RotateCcw size={12} />
        </button>
      </div>
      <FlipCard front={c.front} back={c.back} flipped={flipped} onFlip={() => setFlipped(f => !f)} />
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
        <button onClick={() => go(-1)} style={navBtn}><ChevronLeft size={14} /> Previous</button>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => go(1)} style={{ ...navBtn, borderColor: '#5b21b6', color: '#c4b5fd' }}>
            <X size={13} /> Forgot
          </button>
          <button onClick={() => go(1)} style={{ ...navBtn, borderColor: 'rgba(167,139,250,0.55)', color: '#c4b5fd' }}>
            <Check size={13} /> Got it
          </button>
        </div>
        <button onClick={() => go(1)} style={navBtn}>Next <ChevronRight size={14} /></button>
      </div>
    </div>
  )
}

const navBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '8px 14px', borderRadius: 9,
  background: 'transparent', border: '1px solid #22222e',
  color: '#a1a1aa', fontFamily: 'inherit', fontSize: 12, fontWeight: 600,
  cursor: 'pointer',
}
