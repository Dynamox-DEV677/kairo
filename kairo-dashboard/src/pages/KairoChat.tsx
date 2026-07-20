import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, Loader2, Play, Image as ImageIcon, X, Sparkles } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import { recordDoubt, recordMistake, recordFlashcard, recordConcept, getMistakes, getStudentMemory } from '../lib/twin'
import { saveToNotebook } from '../lib/notebook'
import { getRecentChats, saveRecentChat, makeTitle } from '../lib/recentChats'
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
  videoId?: string | null
  slides?:  Slide[]
  mediaBusy?: boolean
  done?:    DoneAction | null
  showVideo?: boolean
  lightbox?:  number | null
}

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
  } catch {  }
  return null
}

function openView(view: string) {
  try { (window as any).__kairoSetActive?.(view) } catch {  }
}

const C = {
  bg:     '#0A0D16',
  text:   '#fafafa',
  dim:    '#9CA3AF',
  cyan:   '#A5B4FC',
  ultra:  '#7C6BF6',
  border: 'rgba(165,180,252,0.16)',
}
const GLASS: React.CSSProperties = {
  background: 'linear-gradient(150deg, rgba(255,255,255,0.055) 0%, rgba(255,255,255,0.018) 100%)',
  backdropFilter: 'blur(16px) saturate(150%)',
  WebkitBackdropFilter: 'blur(16px) saturate(150%)',
}

let _id = 1

// The active conversation is persisted here so Kyno remembers your last chat
// when you come back. Wiped automatically on account switch (App scopeLocalToUser).
const CHAT_KEY = 'kairo:chat:last'
const CHAT_ID_KEY = 'kairo:chat:lastid'

function newChatId() {
  return 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}
function turnsToMessages(turns: Turn[]): { role: 'user' | 'assistant'; content: string; id: string }[] {
  return turns
    .filter(t => (t.text || '').trim())
    .map(t => ({ role: t.role === 'user' ? 'user' : 'assistant', content: t.text, id: String(t.id) }))
}

export default function KairoChat() {
  const [turns, setTurns] = useState<Turn[]>(() => {
    try {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(CHAT_KEY) : null
      const arr = raw ? JSON.parse(raw) : []
      if (Array.isArray(arr) && arr.length) {
        _id = Math.max(_id, ...arr.map((t: any) => Number(t?.id) || 0)) + 1
        return arr as Turn[]
      }
    } catch {  }
    return []
  })
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const isMobile = useIsMobile()
  const chatIdRef = useRef<string>('')
  if (!chatIdRef.current) {
    try { chatIdRef.current = localStorage.getItem(CHAT_ID_KEY) || newChatId() }
    catch { chatIdRef.current = newChatId() }
  }

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [turns.length, busy])

  // Persist the live conversation (so it's still here on return) and mirror it
  // into the Recent-chats list the Sidebar shows.
  useEffect(() => {
    try {
      if (turns.length) {
        const slim = turns.slice(-40).map(t => ({ ...t, mediaBusy: false, lightbox: null }))
        localStorage.setItem(CHAT_KEY, JSON.stringify(slim))
        localStorage.setItem(CHAT_ID_KEY, chatIdRef.current)
        const messages = turnsToMessages(turns)
        if (messages.length) {
          const firstUser = turns.find(t => t.role === 'user')
          saveRecentChat({
            id: chatIdRef.current,
            title: makeTitle(firstUser?.text || messages[0].content || 'New chat'),
            messages,
            updated: Date.now(),
          })
        }
      } else {
        localStorage.removeItem(CHAT_KEY)
      }
    } catch {  }
  }, [turns])

  // The Sidebar "New chat" button and Recent list drive us via this event.
  useEffect(() => {
    const onLoad = (e: Event) => {
      const id = (e as CustomEvent).detail?.id
      if (!id) return
      if (id === 'new') {
        chatIdRef.current = newChatId()
        try { localStorage.setItem(CHAT_ID_KEY, chatIdRef.current) } catch {  }
        setTurns([])
        setInput('')
        return
      }
      const chat = getRecentChats().find(c => c.id === id)
      if (!chat) return
      const restored: Turn[] = chat.messages.map(m => ({
        id: _id++,
        role: m.role === 'user' ? 'user' : 'kairo',
        text: m.content,
      }))
      chatIdRef.current = chat.id
      setTurns(restored)
      setInput('')
    }
    window.addEventListener('kairo:load-chat', onLoad)
    return () => window.removeEventListener('kairo:load-chat', onLoad)
  }, [])

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
      const history = turns.slice(-8).map(t => ({
        role: t.role === 'user' ? 'user' : 'kairo',
        text: (t.text || '').slice(0, 500),
      }))
      let student: any = null
      try { student = getStudentMemory() } catch {  }
      let mistakes: any[] = []
      try {
        mistakes = getMistakes().slice(0, 10).map(m => ({ topic: m.topic, count: m.count, severity: m.severity }))
      } catch {  }

      const r = await fetch('/api/ai/solver/text', {
        method: 'POST', headers,
        body: JSON.stringify({ question: q, history, student, mistakes }),
      })
      if (!r.ok) {
        const j = await r.json().catch(() => null)
        throw new Error(j?.error || 'Kyno is busy right now (' + r.status + ') — try again in a few seconds.')
      }
      const text = await r.json()

      const isQuiz = text.questionType === 'quiz'
      const casual = isQuiz || text.questionType === 'casual' ||
        (!text.videoQuery && (!text.imageQueries || text.imageQueries.length === 0))

      if (text.quizCheck) {
        try {
          if (text.quizCheck.correct) awardXP('chat_answer')
          else if (text.quizCheck.topic) recordMistake({ topic: text.quizCheck.topic, detail: 'quiz in Kyno chat' })
        } catch {  }
      }

      let done: DoneAction | null = null
      if (text.action) {
        done = performAction(text.action)
        if (done) {
          try { window.dispatchEvent(new StorageEvent('storage', { key: 'kairo:twin:chat' })) } catch {  }
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

      if (!casual) {
        try {
          recordDoubt({ question: q, answer: kairoTurn.text, topic: text.topicKeyword || undefined, source: 'chat' })
        } catch {  }
        try { awardXP('chat_answer') } catch {  }
      }

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
      backgroundImage: `radial-gradient(at 15% 0%, rgba(124,107,246,0.10) 0%, transparent 38%),
                        radial-gradient(at 85% 100%, rgba(74,47,168,0.10) 0%, transparent 42%)`,
    }}>
      <div ref={scrollRef} style={{
        flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch',
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
            {t.role === 'kairo' && !isMobile ? (
              <div style={{
                width: 34, height: 34, borderRadius: 10, flexShrink: 0, marginTop: 2,
                background: 'linear-gradient(135deg, #7C6BF6, #4A2FA8)',
                display: 'grid', placeItems: 'center',
                boxShadow: '0 6px 18px rgba(124,107,246,0.35)',
              }}>
                <img src="/kairo-mark.svg" alt="" style={{ width: 24, height: 24, objectFit: 'contain' }} />
              </div>
            ) : null}

            <div style={{
              maxWidth: isMobile ? '90%' : 'min(680px, 86%)',
              padding: isMobile ? '10px 13px' : '12px 16px',
              borderRadius: t.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
              ...(t.role === 'user'
                ? { background: 'linear-gradient(135deg, rgba(124,107,246,0.30), rgba(74,47,168,0.24))', border: `1px solid rgba(165,180,252,0.28)` }
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

              {t.role === 'kairo' && t.done && (
                <button
                  onClick={() => openView(t.done!.view)}
                  style={{
                    marginTop: 10, width: '100%', maxWidth: 340,
                    display: 'flex', alignItems: 'center', gap: 11,
                    padding: '10px 12px', borderRadius: 14, cursor: 'pointer',
                    background: 'var(--c-bg-elev2)',
                    border: '1px solid rgba(52,211,153,0.35)',
                    color: 'var(--c-text)', fontFamily: 'inherit', textAlign: 'left',
                    boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
                  }}
                >
                  <span style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0, display: 'grid', placeItems: 'center', background: 'rgba(52,211,153,0.16)', color: 'var(--c-success)', fontWeight: 900, fontSize: 17 }}>✓</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--c-text)' }}>{t.done.label}</span>
                    <span style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--c-success)', marginTop: 1 }}>Tap to open</span>
                  </span>
                  <span style={{ color: 'var(--c-purple-lite)', fontWeight: 800, fontSize: 17, flexShrink: 0 }}>→</span>
                </button>
              )}

              {t.role === 'kairo' && !t.casual && (
                <MediaStrip turn={t} onPatch={patchTurn} />
              )}
            </div>
          </motion.div>
        ))}

        {busy && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {!isMobile && (
              <div style={{
                width: 34, height: 34, borderRadius: 10,
                background: 'linear-gradient(135deg, #7C6BF6, #4A2FA8)',
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

      <div style={{
        padding: isMobile
          ? '8px 10px calc(100px + env(safe-area-inset-bottom, 0px))'
          : '10px clamp(14px, 6vw, 90px) 18px',
        flexShrink: 0,
      }}>
        <div style={{
          ...GLASS, border: '1px solid rgba(124,107,246,0.24)',
          borderRadius: isMobile ? 16 : 18, display: 'flex', alignItems: 'flex-end', gap: 8,
          padding: isMobile ? '6px 6px 6px 14px' : '10px 10px 10px 18px',
          boxShadow: '0 12px 40px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.04)',
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
            className="kyno-send"
            style={{
              width: isMobile ? 38 : 42, height: isMobile ? 38 : 42,
              borderRadius: 12, border: 'none', cursor: input.trim() && !busy ? 'pointer' : 'not-allowed',
              background: input.trim() && !busy ? 'var(--c-purple)' : 'rgba(255,255,255,0.06)',
              color: '#fff', display: 'grid', placeItems: 'center', flexShrink: 0,
              boxShadow: input.trim() && !busy ? '0 6px 20px rgba(124,107,246,0.45)' : 'none',
            }}
          >
            {busy ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}
          </button>
        </div>
        {!isMobile && (
          <div style={{ textAlign: 'center', marginTop: 8, fontSize: 10, color: '#5B616E', letterSpacing: 1.5, textTransform: 'uppercase' }}>
            Kyno · your study companion
          </div>
        )}
      </div>

      <style>{`
        .kc-md p { margin: 0 0 8px; }
        .kc-md p:last-child { margin-bottom: 0; }
        .kc-md h2, .kc-md h3 { font-size: 14px; color: #A5B4FC; margin: 12px 0 6px; letter-spacing: .4px; }
        .kc-md ul, .kc-md ol { margin: 4px 0 8px 18px; }
        .kc-md li { margin-bottom: 3px; }
        .kc-md code { background: rgba(165,180,252,0.10); padding: 1px 5px; border-radius: 4px; font-size: 13px; }
        .kc-md table { border-collapse: collapse; margin: 8px 0; }
        .kc-md th, .kc-md td { border: 1px solid rgba(255,255,255,0.12); padding: 5px 10px; font-size: 13px; }
        .kc-md .katex { font-size: 1.05em; color: #fafafa; }
        .kc-md .katex-display { margin: 8px 0; overflow-x: auto; overflow-y: hidden; padding: 2px 0; }
      `}</style>
    </div>
  )
}

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
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        {hasVideo && (
          <button
            onClick={() => onPatch(turn.id, { showVideo: !turn.showVideo })}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
              padding: '5px 14px 5px 5px', borderRadius: 12,
              background: turn.showVideo ? 'rgba(124,107,246,0.16)' : 'var(--c-bg-elev2)',
              border: `1px solid ${turn.showVideo ? 'rgba(124,107,246,0.5)' : 'var(--c-line)'}`,
              color: '#fafafa', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700,
              boxShadow: '0 4px 14px rgba(0,0,0,0.28)',
            }}
          >
            <span style={{ position: 'relative', width: 72, height: 44, borderRadius: 9, overflow: 'hidden', flexShrink: 0 }}>
              <img
                src={`https://i.ytimg.com/vi/${turn.videoId}/mqdefault.jpg`}
                alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
              <span style={{
                position: 'absolute', inset: 0, display: 'grid', placeItems: 'center',
                background: 'rgba(0,0,0,0.32)',
              }}>
                <span style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--c-purple)', display: 'grid', placeItems: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.4)' }}>
                  <Play size={12} fill="#fff" color="#fff" />
                </span>
              </span>
            </span>
            {turn.showVideo ? 'Hide video' : 'Watch lesson'}
          </button>
        )}

        {slides.slice(0, 4).map((s, i) => (
          <button key={i}
            onClick={() => onPatch(turn.id, { lightbox: i })}
            title={s.caption}
            style={{
              width: 48, height: 40, borderRadius: 10, overflow: 'hidden', padding: 0,
              border: '1px solid var(--c-line)', cursor: 'pointer',
              background: 'var(--c-bg-elev2)',
            }}
          >
            <img src={s.url} alt="" loading="lazy"
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              onError={e => { e.currentTarget.parentElement!.style.display = 'none' }}
            />
          </button>
        ))}
        {slides.length > 4 && (
          <button
            onClick={() => onPatch(turn.id, { lightbox: 4 })}
            style={{
              width: 48, height: 40, borderRadius: 10, cursor: 'pointer',
              background: 'rgba(124,107,246,0.12)', border: '1px solid rgba(124,107,246,0.30)',
              color: 'var(--c-purple-lite)', fontSize: 12, fontWeight: 800, fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            +{slides.length - 4}
          </button>
        )}
      </div>

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
              border: '1px solid rgba(165,180,252,0.25)', aspectRatio: '16 / 9',
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
            <div style={{ display: 'flex', gap: 8 }} onClick={e => e.stopPropagation()}>
              {slides.map((_, i) => (
                <button key={i}
                  onClick={() => onPatch(turn.id, { lightbox: i })}
                  style={{
                    width: 9, height: 9, borderRadius: '50%', border: 'none', cursor: 'pointer',
                    background: i === turn.lightbox ? '#A5B4FC' : 'rgba(255,255,255,0.25)',
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
        background: 'linear-gradient(135deg, #7C6BF6, #4A2FA8)',
        display: 'grid', placeItems: 'center',
        boxShadow: '0 16px 48px rgba(124,107,246,0.4)',
      }}>
        <img src="/kairo-mark.svg" alt="" style={{ width: isMobile ? 44 : 54, height: isMobile ? 44 : 54, objectFit: 'contain' }} />
      </div>
      <div style={{
        fontSize: isMobile ? 21 : 26, fontWeight: 700, color: '#fafafa',
        fontFamily: "'Space Grotesk', system-ui, sans-serif",
        textShadow: '0 0 24px rgba(124,107,246,0.4)',
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
              ...GLASS, border: '1px solid rgba(165,180,252,0.2)',
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
