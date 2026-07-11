/**
 * Kyno Chat — the AI companion conversation.
 *
 * A normal ChatGPT-style multi-turn chat: you talk, Kyno answers in a
 * bubble. Media is OPT-IN — each study answer gets small chips under it
 * (▶ video thumbnail, 🖼 image thumbs). Click a chip and the video/image
 * expands inline. Casual small-talk gets a plain note with no chips.
 *
 * Reuses the Solver's endpoints:
 *   POST /api/ai/solver/text    → answer + imageQueries + videoQuery
 *   POST /api/ai/solver/images  → storyboard slides (async, attaches late)
 *   POST /api/ai/solver/video   → one YouTube lesson id (async)
 *
 * The classic full-visual Solver still exists — the Dashboard offers a
 * Chat ↔ Classic toggle on the same sidebar entry.
 */
import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, Loader2, Play, Image as ImageIcon, X, Sparkles } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import { recordDoubt, recordMistake, recordFlashcard, recordConcept, getMistakes } from '../lib/twin'
import { saveToNotebook } from '../lib/notebook'
import { awardXP } from '../lib/game'
import { useIsMobile } from '../hooks/useViewport'

interface Slide { url: string; caption: string; source: string }
interface DoneAction { label: string; view: string }
interface Turn {
  id:       number
  role:     'user' | 'kairo'
  text:     string
  casual?:  boolean
  topic?:   string
  // media (kairo turns only — attaches asynchronously)
  videoId?: string | null
  slides?:  Slide[]
  mediaBusy?: boolean
  // artifact the AI created for this turn (flashcards / note / concept)
  done?:    DoneAction | null
  // UI expansion state
  showVideo?: boolean
  lightbox?:  number | null   // index into slides
}

// Execute an AI-requested artifact creation in the student's tools.
// Returns a chip descriptor for the bubble, or null if nothing was made.
function performAction(a: any): DoneAction | null {
  try {
    if (a.tool === 'flashcards' && a.cards?.length) {
      a.cards.forEach((c: any) =>
        recordFlashcard({ front: c.front, back: c.back, topic: a.topic || undefined, source: 'manual' }))
      return { label: `Created ${a.cards.length} flashcards`, view: 'flashcards' }
    }
    if (a.tool === 'notebook' && (a.content || a.title)) {
      saveToNotebook({
        kind: 'note', title: a.title || a.topic || 'Kyno note',
        content: a.content || '', tags: a.topic ? [a.topic] : [], source: 'kyno-chat',
      })
      return { label: 'Saved a note to your AI Notebook', view: 'notebook' }
    }
    if (a.tool === 'concept-map' && a.topic) {
      recordConcept({ name: a.topic, related: a.related?.length ? a.related : undefined })
      return { label: `Added “${a.topic}” to your Concept Map`, view: 'concept-map' }
    }
  } catch { /* never break the chat over an artifact */ }
  return null
}

function openView(view: string) {
  try { (window as any).__kairoSetActive?.(view) } catch { /* not mounted */ }
}

const C = {
  bg:     '#050505',
  text:   '#fafafa',
  dim:    '#9CA3AF',
  cyan:   '#66D9FF',
  ultra:  '#4F7CFF',
  border: 'rgba(102,217,255,0.16)',
}
const GLASS: React.CSSProperties = {
  background: 'linear-gradient(150deg, rgba(255,255,255,0.055) 0%, rgba(255,255,255,0.018) 100%)',
  backdropFilter: 'blur(16px) saturate(150%)',
  WebkitBackdropFilter: 'blur(16px) saturate(150%)',
}

let _id = 1

export default function KairoChat() {
  const [turns, setTurns] = useState<Turn[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const isMobile = useIsMobile()

  // Auto-scroll to the newest message.
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [turns.length, busy])

  const patchTurn = useCallback((id: number, patch: Partial<Turn>) => {
    setTurns(prev => prev.map(t => (t.id === id ? { ...t, ...patch } : t)))
  }, [])

  async function send() {
    const q = input.trim()
    if (!q || busy) return
    setInput('')
    setBusy(true)
    const userTurn: Turn = { id: _id++, role: 'user', text: q }
    setTurns(prev => [...prev, userTurn])

    const headers = { 'Content-Type': 'application/json' }
    try {
      // Conversation memory + who the student is + their mistake profile ride
      // along with every message — this is what makes Kyno a coach, not a
      // one-shot answer machine.
      const history = turns.slice(-8).map(t => ({
        role: t.role === 'user' ? 'user' : 'kairo',
        text: (t.text || '').slice(0, 500),
      }))
      let student: any = null
      try {
        const p = JSON.parse(localStorage.getItem('kairo_profile') || '{}')
        student = { name: p.name, cls: p.cls, board: p.board }
      } catch { /* fresh device */ }
      let mistakes: any[] = []
      try {
        mistakes = getMistakes().slice(0, 10).map(m => ({ topic: m.topic, count: m.count, severity: m.severity }))
      } catch { /* no twin data yet */ }

      const r = await fetch('/api/ai/solver/text', {
        method: 'POST', headers,
        body: JSON.stringify({ question: q, history, student, mistakes }),
      })
      if (!r.ok) {
        // Prefer the server's own message ("question too long", rate-limit
        // hints, …) over a generic busy line.
        const j = await r.json().catch(() => null)
        throw new Error(j?.error || 'Kyno is busy right now (' + r.status + ') — try again in a few seconds.')
      }
      const text = await r.json()

      const isQuiz = text.questionType === 'quiz'
      const casual = isQuiz || text.questionType === 'casual' ||
        (!text.videoQuery && (!text.imageQueries || text.imageQueries.length === 0))

      // The AI graded the student's previous quiz answer — feed the result
      // into the twin so Mistake Analysis sees it.
      if (text.quizCheck) {
        try {
          if (text.quizCheck.correct) awardXP('chat_answer')
          else if (text.quizCheck.topic) recordMistake({ topic: text.quizCheck.topic, detail: 'quiz in Kyno chat' })
        } catch { /* non-fatal */ }
      }

      // The AI created an artifact (flashcards / note / concept) — do it for
      // real, then auto-open the tool so the student sees it.
      let done: DoneAction | null = null
      if (text.action) {
        done = performAction(text.action)
        if (done) {
          try { window.dispatchEvent(new StorageEvent('storage', { key: 'kairo:twin:chat' })) } catch { /* older browsers */ }
          const view = done.view
          setTimeout(() => openView(view), 1200)
        }
      }

      const kairoTurn: Turn = {
        id: _id++, role: 'kairo',
        text: text.textExplanation || '…',
        casual,
        topic: text.topicKeyword || undefined,
        videoId: null,
        slides: [],
        mediaBusy: !casual,
        done,
        showVideo: false,
        lightbox: null,
      }
      setTurns(prev => [...prev, kairoTurn])
      setBusy(false)

      // Memory engine + XP — study turns only (quiz has its own XP path).
      if (!casual) {
        try {
          recordDoubt({ question: q, answer: kairoTurn.text, topic: text.topicKeyword || undefined, source: 'chat' })
        } catch { /* non-fatal */ }
        try { awardXP('chat_answer') } catch { /* non-fatal */ }
      }

      // Media attaches late as chips — the chat never blocks on it.
      if (!casual) {
        const vidP = fetch('/api/ai/solver/video', {
          method: 'POST', headers,
          body: JSON.stringify({ query: text.videoQuery || text.topicKeyword || q, topicKeyword: text.topicKeyword }),
        }).then(r => (r.ok ? r.json() : { videoId: null })).catch(() => ({ videoId: null }))

        const imgP = (text.imageQueries?.length
          ? fetch('/api/ai/solver/images', {
              method: 'POST', headers,
              body: JSON.stringify({ queries: text.imageQueries, topicKeyword: text.topicKeyword }),
            }).then(r => (r.ok ? r.json() : { imageSlides: [] })).catch(() => ({ imageSlides: [] }))
          : Promise.resolve({ imageSlides: [] }))

        Promise.all([vidP, imgP]).then(([v, im]) => {
          patchTurn(kairoTurn.id, {
            videoId: v?.videoId || null,
            slides: (im?.imageSlides || []).slice(0, 8),
            mediaBusy: false,
          })
        })
      }
    } catch (e: any) {
      setTurns(prev => [...prev, {
        id: _id++, role: 'kairo', casual: true,
        text: e?.message || 'Something went wrong — try again.',
      }])
      setBusy(false)
    }
  }

  return (
    <div style={{
      width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
      background: C.bg, position: 'relative',
      backgroundImage: `radial-gradient(at 15% 0%, rgba(79,124,255,0.10) 0%, transparent 38%),
                        radial-gradient(at 85% 100%, rgba(32,70,194,0.10) 0%, transparent 42%)`,
    }}>
      {/* ── Thread ─────────────────────────────────────────────────── */}
      <div ref={scrollRef} style={{
        flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch',
        // Mobile: tight gutters + room at the top for the mode-toggle pill.
        padding: isMobile ? '50px 12px 10px' : '26px clamp(14px, 6vw, 90px) 20px',
        display: 'flex', flexDirection: 'column', gap: isMobile ? 13 : 18,
      }}>
        {turns.length === 0 && <EmptyHero isMobile={isMobile} />}

        {turns.map(t => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28 }}
            style={{
              display: 'flex', gap: 10,
              flexDirection: t.role === 'user' ? 'row-reverse' : 'row',
              alignItems: 'flex-start',
            }}
          >
            {/* Avatar */}
            {t.role === 'kairo' && !isMobile ? (
              <div style={{
                width: 34, height: 34, borderRadius: 10, flexShrink: 0, marginTop: 2,
                background: 'linear-gradient(135deg, #4F7CFF, #2046C2)',
                display: 'grid', placeItems: 'center',
                boxShadow: '0 6px 18px rgba(79,124,255,0.35)',
              }}>
                <img src="/kairo-mark.svg" alt="" style={{ width: 24, height: 24, objectFit: 'contain' }} />
              </div>
            ) : null}

            {/* Bubble */}
            <div style={{
              maxWidth: isMobile ? '90%' : 'min(680px, 86%)',
              padding: isMobile ? '10px 13px' : '12px 16px',
              borderRadius: t.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
              ...(t.role === 'user'
                ? { background: 'linear-gradient(135deg, rgba(79,124,255,0.30), rgba(32,70,194,0.24))', border: `1px solid rgba(102,217,255,0.28)` }
                : { ...GLASS, border: `1px solid ${C.border}` }),
              color: C.text, fontSize: isMobile ? 14 : 14.5, lineHeight: 1.6,
              overflowWrap: 'anywhere',
            }}>
              {t.role === 'kairo' ? (
                <div className="kc-md">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm, remarkMath]}
                    rehypePlugins={[rehypeKatex]}
                  >
                    {t.text}
                  </ReactMarkdown>
                </div>
              ) : t.text}

              {/* ── Created-artifact chip (flashcards / note / concept) ── */}
              {t.role === 'kairo' && t.done && (
                <button
                  onClick={() => openView(t.done!.view)}
                  style={{
                    marginTop: 10, display: 'flex', alignItems: 'center', gap: 7,
                    padding: '8px 13px', borderRadius: 10, cursor: 'pointer',
                    background: 'rgba(74, 222, 128, 0.12)',
                    border: '1px solid rgba(74, 222, 128, 0.4)',
                    color: '#4ade80', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700,
                  }}
                >
                  ✓ {t.done.label} — open →
                </button>
              )}

              {/* ── Media chips (kairo study turns) ─────────────────── */}
              {t.role === 'kairo' && !t.casual && (
                <MediaStrip turn={t} onPatch={patchTurn} />
              )}
            </div>
          </motion.div>
        ))}

        {/* typing indicator */}
        {busy && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {!isMobile && (
              <div style={{
                width: 34, height: 34, borderRadius: 10,
                background: 'linear-gradient(135deg, #4F7CFF, #2046C2)',
                display: 'grid', placeItems: 'center',
              }}>
                <img src="/kairo-mark.svg" alt="" style={{ width: 24, height: 24 }} />
              </div>
            )}
            <div style={{ ...GLASS, border: `1px solid ${C.border}`, borderRadius: 16, padding: isMobile ? '10px 14px' : '12px 18px', display: 'flex', gap: 5 }}>
              {[0, 1, 2].map(i => (
                <motion.span key={i}
                  animate={{ opacity: [0.25, 1, 0.25] }}
                  transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.22 }}
                  style={{ width: 7, height: 7, borderRadius: '50%', background: C.cyan, display: 'block' }}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Composer ───────────────────────────────────────────────── */}
      {/* Mobile bottom padding clears the floating bottom-nav dock (~96px +
          safe-area) so the input sits above it instead of hiding behind it. */}
      <div style={{
        padding: isMobile
          ? '8px 10px calc(100px + env(safe-area-inset-bottom, 0px))'
          : '10px clamp(14px, 6vw, 90px) 18px',
        flexShrink: 0,
      }}>
        <div style={{
          ...GLASS, border: `1px solid ${C.border}`,
          borderRadius: isMobile ? 16 : 18, display: 'flex', alignItems: 'flex-end', gap: 8,
          padding: isMobile ? '6px 6px 6px 14px' : '10px 10px 10px 18px',
          boxShadow: '0 12px 40px rgba(0,0,0,0.45)',
        }}>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
            }}
            placeholder={isMobile ? 'Ask anything…' : 'Talk to Kyno — ask anything…'}
            rows={1}
            style={{
              flex: 1, resize: 'none', background: 'transparent', border: 'none',
              // 16px on mobile — anything smaller makes iOS zoom the page on focus.
              outline: 'none', color: C.text, fontSize: isMobile ? 16 : 14.5, fontFamily: 'inherit',
              lineHeight: 1.5, maxHeight: isMobile ? 100 : 130, padding: '6px 0',
            }}
            onInput={e => {
              const el = e.currentTarget
              el.style.height = 'auto'
              el.style.height = Math.min(isMobile ? 100 : 130, el.scrollHeight) + 'px'
            }}
          />
          <button
            onClick={send}
            disabled={busy || !input.trim()}
            style={{
              width: isMobile ? 38 : 42, height: isMobile ? 38 : 42,
              borderRadius: 12, border: 'none', cursor: 'pointer',
              background: input.trim() && !busy
                ? 'linear-gradient(135deg, #4F7CFF, #66D9FF)'
                : 'rgba(255,255,255,0.06)',
              color: '#fff', display: 'grid', placeItems: 'center', flexShrink: 0,
              boxShadow: input.trim() && !busy ? '0 6px 20px rgba(79,124,255,0.4)' : 'none',
              transition: 'all .2s',
            }}
          >
            {busy ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}
          </button>
        </div>
        {/* Footer tagline is desktop-only — the mobile shell already brands the page */}
        {!isMobile && (
          <div style={{ textAlign: 'center', marginTop: 8, fontSize: 10, color: '#5B616E', letterSpacing: 1.5, textTransform: 'uppercase' }}>
            Kyno · your study companion
          </div>
        )}
      </div>

      {/* markdown styling scoped to chat bubbles */}
      <style>{`
        .kc-md p { margin: 0 0 8px; }
        .kc-md p:last-child { margin-bottom: 0; }
        .kc-md h2, .kc-md h3 { font-size: 14px; color: #66D9FF; margin: 12px 0 6px; letter-spacing: .4px; }
        .kc-md ul, .kc-md ol { margin: 4px 0 8px 18px; }
        .kc-md li { margin-bottom: 3px; }
        .kc-md code { background: rgba(102,217,255,0.10); padding: 1px 5px; border-radius: 4px; font-size: 13px; }
        .kc-md table { border-collapse: collapse; margin: 8px 0; }
        .kc-md th, .kc-md td { border: 1px solid rgba(255,255,255,0.12); padding: 5px 10px; font-size: 13px; }
        .kc-md .katex { font-size: 1.05em; color: #fafafa; }
        .kc-md .katex-display { margin: 8px 0; overflow-x: auto; overflow-y: hidden; padding: 2px 0; }
      `}</style>
    </div>
  )
}

// ── Media strip: chips → inline expansion ───────────────────────────────
function MediaStrip({ turn, onPatch }: { turn: Turn; onPatch: (id: number, p: Partial<Turn>) => void }) {
  const hasVideo = !!turn.videoId
  const slides = turn.slides || []

  if (turn.mediaBusy) {
    return (
      <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 7, fontSize: 11, color: '#5B616E' }}>
        <Loader2 size={11} className="animate-spin" /> finding visuals…
      </div>
    )
  }
  if (!hasVideo && slides.length === 0) return null

  return (
    <div style={{ marginTop: 12, borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 10 }}>
      {/* chips row */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        {hasVideo && (
          <button
            onClick={() => onPatch(turn.id, { showVideo: !turn.showVideo })}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
              padding: 4, paddingRight: 12, borderRadius: 10,
              background: turn.showVideo ? 'rgba(102,217,255,0.14)' : 'rgba(255,255,255,0.05)',
              border: `1px solid ${turn.showVideo ? 'rgba(102,217,255,0.5)' : 'rgba(255,255,255,0.10)'}`,
              color: '#fafafa', fontFamily: 'inherit', fontSize: 12, fontWeight: 600,
            }}
          >
            <span style={{ position: 'relative', width: 58, height: 34, borderRadius: 7, overflow: 'hidden', flexShrink: 0 }}>
              <img
                src={`https://i.ytimg.com/vi/${turn.videoId}/mqdefault.jpg`}
                alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
              <span style={{
                position: 'absolute', inset: 0, display: 'grid', placeItems: 'center',
                background: 'rgba(0,0,0,0.35)',
              }}><Play size={13} fill="#fff" color="#fff" /></span>
            </span>
            {turn.showVideo ? 'Hide video' : 'Watch lesson'}
          </button>
        )}

        {slides.slice(0, 4).map((s, i) => (
          <button key={i}
            onClick={() => onPatch(turn.id, { lightbox: i })}
            title={s.caption}
            style={{
              width: 46, height: 34, borderRadius: 8, overflow: 'hidden', padding: 0,
              border: '1px solid rgba(255,255,255,0.12)', cursor: 'pointer',
              background: 'rgba(255,255,255,0.04)',
            }}
          >
            <img src={s.url} alt="" loading="lazy"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={e => { e.currentTarget.parentElement!.style.display = 'none' }}
            />
          </button>
        ))}
        {slides.length > 4 && (
          <button
            onClick={() => onPatch(turn.id, { lightbox: 4 })}
            style={{
              height: 34, padding: '0 10px', borderRadius: 8, cursor: 'pointer',
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)',
              color: '#9CA3AF', fontSize: 11, fontWeight: 700, fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            <ImageIcon size={11} /> +{slides.length - 4}
          </button>
        )}
      </div>

      {/* inline video expansion */}
      <AnimatePresence>
        {turn.showVideo && turn.videoId && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{
              marginTop: 10, borderRadius: 12, overflow: 'hidden',
              border: '1px solid rgba(102,217,255,0.25)', aspectRatio: '16 / 9',
            }}>
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${turn.videoId}?autoplay=1&modestbranding=1&rel=0&playsinline=1`}
                title="Lesson video"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                style={{ width: '100%', height: '100%', border: 'none' }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* image lightbox */}
      <AnimatePresence>
        {turn.lightbox != null && slides[turn.lightbox] && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => onPatch(turn.id, { lightbox: null })}
            style={{
              position: 'fixed', inset: 0, zIndex: 999,
              background: 'rgba(4,4,6,0.88)', backdropFilter: 'blur(10px)',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 12,
              cursor: 'zoom-out', padding: 24,
            }}
          >
            <img
              src={slides[turn.lightbox].url}
              alt={slides[turn.lightbox].caption}
              style={{ maxWidth: '92%', maxHeight: '78%', objectFit: 'contain', borderRadius: 12 }}
            />
            <div style={{ color: '#fafafa', fontSize: 13, textAlign: 'center', maxWidth: 640 }}>
              {slides[turn.lightbox].caption}
            </div>
            {/* prev / next */}
            <div style={{ display: 'flex', gap: 8 }} onClick={e => e.stopPropagation()}>
              {slides.map((_, i) => (
                <button key={i}
                  onClick={() => onPatch(turn.id, { lightbox: i })}
                  style={{
                    width: 9, height: 9, borderRadius: '50%', border: 'none', cursor: 'pointer',
                    background: i === turn.lightbox ? '#66D9FF' : 'rgba(255,255,255,0.25)',
                  }}
                />
              ))}
            </div>
            <button
              onClick={() => onPatch(turn.id, { lightbox: null })}
              style={{
                position: 'absolute', top: 18, right: 18,
                width: 38, height: 38, borderRadius: 12, border: '1px solid rgba(255,255,255,0.2)',
                background: 'rgba(255,255,255,0.07)', color: '#fff', cursor: 'pointer',
                display: 'grid', placeItems: 'center',
              }}
            ><X size={17} /></button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── First-open hero ──────────────────────────────────────────────────────
function EmptyHero({ isMobile = false }: { isMobile?: boolean }) {
  const suggestions = [
    'Quiz me on my weak topics',
    'What should I study today?',
    'Make flashcards on photosynthesis',
    'Explain quadratic equations',
  ]
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: isMobile ? 11 : 14,
      minHeight: isMobile ? 220 : 300,
    }}>
      <div style={{
        width: isMobile ? 60 : 74, height: isMobile ? 60 : 74, borderRadius: isMobile ? 17 : 20,
        background: 'linear-gradient(135deg, #4F7CFF, #2046C2)',
        display: 'grid', placeItems: 'center',
        boxShadow: '0 16px 48px rgba(79,124,255,0.4)',
      }}>
        <img src="/kairo-mark.svg" alt="" style={{ width: isMobile ? 44 : 54, height: isMobile ? 44 : 54, objectFit: 'contain' }} />
      </div>
      <div style={{
        fontSize: isMobile ? 21 : 26, fontWeight: 700, color: '#fafafa',
        fontFamily: "'Space Grotesk', system-ui, sans-serif",
        textShadow: '0 0 24px rgba(79,124,255,0.4)',
      }}>
        Welcome to Kyno!
      </div>
      <div style={{ fontSize: isMobile ? 12.5 : 13.5, color: '#9CA3AF', textAlign: 'center', maxWidth: 460, lineHeight: 1.6, padding: '0 8px' }}>
        I'm your AI learning companion. Whether you're studying for exams,
        exploring new ideas, or mastering difficult concepts, I'm here to help
        you accelerate your learning.
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', maxWidth: 560, marginTop: 6 }}>
        {suggestions.map(s => (
          <button key={s}
            onClick={() => {
              // Prefill via a custom event the composer listens to? Simpler:
              // dispatch an input event by focusing… keep it dead simple:
              const ta = document.querySelector('textarea')
              if (ta) {
                const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set
                setter?.call(ta, s)
                ta.dispatchEvent(new Event('input', { bubbles: true }))
                ;(ta as HTMLTextAreaElement).focus()
              }
            }}
            style={{
              padding: '9px 16px', borderRadius: 999, cursor: 'pointer',
              ...GLASS, border: '1px solid rgba(102,217,255,0.2)',
              color: '#A5B4FC', fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <Sparkles size={11} /> {s}
          </button>
        ))}
      </div>
    </div>
  )
}
