import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, StopCircle, GraduationCap, Sparkles, Layers, CheckCircle2, AlertTriangle } from 'lucide-react'
import MessageBubble from './MessageBubble'
import { chat, DEFAULT_MODEL } from '../lib/openrouter'
import { post } from '../lib/api'
import { saveRecentChat, getRecentChats, makeTitle } from '../lib/recentChats'

interface Message {
  role: 'user' | 'assistant'
  content: string
  id: string
}

const SUGGESTIONS = [
  { emoji: '🔭', text: 'Explain Newton\'s 3rd Law' },
  { emoji: '🧬', text: 'Mitosis vs Meiosis differences' },
  { emoji: '📐', text: 'Solve: 3x² - 5x + 2 = 0' },
  { emoji: '🌏', text: 'Causes of French Revolution' },
  { emoji: '⚗️', text: 'Balancing chemical equations' },
  { emoji: '📜', text: 'Summarise Chapter 1 History' },
]

const SYSTEM = `You are Kyno, an expert AI tutor for Indian school students (CBSE, ICSE, and state boards, Class 6–12).
Help students understand concepts clearly, solve problems step by step, and prepare for board exams.
Be concise, encouraging, and use markdown for structure.
For math use $...$ for inline and $$...$$ for display equations on their own line.
Keep answers focused and student-friendly.`

interface ChatWindowProps {
  onNewMessage: (q: string) => void
  onNavigate?: (page: string) => void
  model?: string
}

type FlashcardState = 'idle' | 'loading' | 'success' | 'error'

export default function ChatWindow({ onNewMessage, onNavigate, model = DEFAULT_MODEL }: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [chatId, setChatId] = useState<string>(() => `chat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`)
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [streamContent, setStreamContent] = useState('')
  const [, setError] = useState('')
  const [fcState, setFcState] = useState<FlashcardState>('idle')
  const [fcMsg, setFcMsg] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const stopRef = useRef(false)
  const abortRef = useRef<AbortController | null>(null)
  const accRef = useRef('')

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamContent])

  useEffect(() => {
    function onLoad(e: Event) {
      const id = (e as CustomEvent).detail?.id
      if (!id) return
      if (id === 'new') {
        setMessages([])
        setChatId(`chat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`)
        return
      }
      const c = getRecentChats().find(c => c.id === id)
      if (c) {
        setMessages(c.messages as Message[])
        setChatId(c.id)
      }
    }
    window.addEventListener('kairo:load-chat', onLoad)
    return () => window.removeEventListener('kairo:load-chat', onLoad)
  }, [])

  useEffect(() => {
    if (messages.length === 0) return
    const firstUser = messages.find(m => m.role === 'user')
    if (!firstUser) return
    saveRecentChat({
      id: chatId,
      title: makeTitle(firstUser.content),
      messages: messages.map(m => ({ id: m.id, role: m.role, content: m.content })),
      updated: Date.now(),
    })
  }, [messages, chatId])

  async function send(text?: string) {
    const q = (text ?? input).trim()
    if (!q || streaming) return

    const userMsg: Message = { role: 'user', content: q, id: Date.now().toString() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setError('')
    onNewMessage(q)

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }

    stopRef.current = false
    accRef.current = ''
    setStreaming(true)
    setStreamContent('')

    const abortCtrl = new AbortController()
    abortRef.current = abortCtrl

    let memoryContext = ''
    try {
      const r = await fetch('/api/memory/context', {
        headers: { Authorization: `Bearer ${localStorage.getItem('kairo_token') || ''}` },
      })
      if (r.ok) memoryContext = (await r.json()).context || ''
    } catch {  }

    try {
      await chat({
        model,
        messages: [
          { role: 'system', content: SYSTEM + memoryContext },
          ...messages.map(m => ({ role: m.role as 'user' | 'assistant' | 'system', content: m.content })),
          { role: 'user', content: q },
        ],
        onChunk: (_, full) => {
          if (stopRef.current) return
          accRef.current = full
          setStreamContent(full)
        },
        signal: abortCtrl.signal,
      })
    } catch (e: any) {
      if (!stopRef.current && e?.name !== 'AbortError') {
        const msg = e?.message || 'Something went wrong'
        accRef.current = `⚠️ ${msg}`
        setStreamContent(accRef.current)
        setError(msg)
      }
    } finally {
      const finalContent = accRef.current
      setStreaming(false)
      setStreamContent('')
      if (finalContent) {
        setMessages(prev => [...prev, { role: 'assistant', content: finalContent, id: Date.now().toString() }])
      }
    }
  }

  function stop() {
    stopRef.current = true
    abortRef.current?.abort()
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  async function handleChipAction(action: string, _content: string) {
    if (action === 'flashcards') {
      if (fcState === 'loading') return

      const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')
      const topic = lastUserMsg?.content?.slice(0, 150) || 'Key concepts from this response'

      setFcState('loading')
      setFcMsg('Creating flashcards…')

      try {
        const result = await post('/flashcards/generate', {
          topic,
          subject: 'General',
          count: 8,
        })
        setFcState('success')
        setFcMsg(`✓ ${result.count} flashcards created! Taking you there…`)
        setTimeout(() => {
          setFcState('idle')
          setFcMsg('')
          onNavigate?.('flashcards')
        }, 1200)
      } catch (e: any) {
        setFcState('error')
        setFcMsg(`⚠️ ${e.message || 'Could not create flashcards'}`)
        setTimeout(() => { setFcState('idle'); setFcMsg('') }, 3500)
      }
      return
    }

    const prompts: Record<string, string> = {
      simpler:    'Explain that in even simpler terms for a Class 8 student.',
      notes:      'Summarise the above in concise bullet-point notes.',
      exam:       'Give me 3 board exam questions on this topic with expected marks.',
      regenerate: 'Give me a fresh explanation of this topic with a different example.',
    }
    if (prompts[action]) send(prompts[action])
  }

  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 140) + 'px'
  }

  const isEmpty = messages.length === 0 && !streaming

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div className="cw-scroll" style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>

        <AnimatePresence>
          {isEmpty && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.4 }}
              style={{ textAlign: 'center', paddingTop: 60 }}
            >
              <div className="animate-float" style={{ marginBottom: 24, display: 'inline-block' }}>
                <div className="animate-pulse-orb" style={{
                  width: 70, height: 70, borderRadius: 20,
                  background: '#000',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto',
                  boxShadow: '0 0 40px rgba(124, 107, 246, 0.04), 0 0 80px rgba(124, 107, 246, 0.02)',
                  border: '1px solid #27272a',
                }}>
                  <img src="/kairo_logo.png" alt="Kyno" style={{ width: 48, height: 48, objectFit: 'contain' }} />
                </div>
              </div>

              <h2 className="gradient-text" style={{
                fontSize: 26, fontWeight: 800, letterSpacing: '-0.5px',
                marginBottom: 8,
              }}>
                Ask anything. Learn everything.
              </h2>
              <p style={{ fontSize: 14, color: '#6B7280', marginBottom: 32, lineHeight: 1.6 }}>
                Your AI tutor for CBSE · ICSE · State boards · Class 6–12
              </p>

              <div style={{
                display: 'flex', flexWrap: 'wrap', gap: 8,
                justifyContent: 'center', maxWidth: 580, margin: '0 auto',
              }}>
                {SUGGESTIONS.map((s, i) => (
                  <motion.button
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.06 + 0.2 }}
                    whileHover={{ scale: 1.04, y: -2 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => send(s.text)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 7,
                      padding: '9px 16px', borderRadius: 24,
                      background: '#0E1117', border: '1px solid #1f2532',
                      cursor: 'pointer', fontFamily: 'inherit',
                      fontSize: 13, color: '#9CA3AF',
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLButtonElement).style.borderColor = '#4B5563'
                      ;(e.currentTarget as HTMLButtonElement).style.color = '#fafafa'
                      ;(e.currentTarget as HTMLButtonElement).style.background = '#151922'
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLButtonElement).style.borderColor = '#1f2532'
                      ;(e.currentTarget as HTMLButtonElement).style.color = '#9CA3AF'
                      ;(e.currentTarget as HTMLButtonElement).style.background = '#0E1117'
                    }}
                  >
                    <span>{s.emoji}</span>
                    {s.text}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {messages.map((msg, i) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            isLast={i === messages.length - 1}
            isStreaming={false}
            onChipAction={handleChipAction}
          />
        ))}

        {streaming && streamContent && (
          <MessageBubble
            message={{ role: 'assistant', content: streamContent, id: 'streaming' }}
            isLast
            isStreaming
            onChipAction={handleChipAction}
          />
        )}

        {streaming && !streamContent && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '14px 18px',
              background: '#0E1117', border: '1px solid #1f2532',
              borderRadius: '4px 16px 16px 16px',
              width: 'fit-content', marginBottom: 24,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#7C6BF6', animation: 'dot-bounce 1.2s ease-in-out infinite' }} />
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#7C6BF6', animation: 'dot-bounce 1.2s ease-in-out 0.2s infinite' }} />
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#7C6BF6', animation: 'dot-bounce 1.2s ease-in-out 0.4s infinite' }} />
            </div>
            <span style={{ fontSize: 12, color: '#6B7280' }}>Kyno is thinking…</span>
          </motion.div>
        )}

        <div ref={bottomRef} />
      </div>

      <AnimatePresence>
        {fcState !== 'idle' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.2 }}
            style={{
              margin: '0 20px 8px',
              padding: '10px 16px',
              borderRadius: 10,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              fontSize: 13,
              background: fcState === 'success' ? 'rgba(16,185,129,0.1)'
                        : fcState === 'error'   ? 'rgba(239,68,68,0.1)'
                        : 'rgba(124, 107, 246, 0.1)',
              border: `1px solid ${
                fcState === 'success' ? 'rgba(16,185,129,0.3)'
                : fcState === 'error' ? 'rgba(239,68,68,0.3)'
                : 'rgba(124, 107, 246, 0.3)'
              }`,
              color: fcState === 'success' ? '#34d399'
                   : fcState === 'error'   ? '#f87171'
                   : '#A5B4FC',
            }}
          >
            {fcState === 'loading' && (
              <Layers size={15} style={{ flexShrink: 0, animation: 'spin 1s linear infinite' }} />
            )}
            {fcState === 'success' && <CheckCircle2 size={15} style={{ flexShrink: 0 }} />}
            {fcState === 'error'   && <AlertTriangle size={15} style={{ flexShrink: 0 }} />}
            {fcMsg}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="cw-input-bar" style={{
        padding: '14px 20px 18px',
        borderTop: '1px solid #1a1f2e',
        background: 'rgba(10,10,10,0.9)',
        backdropFilter: 'blur(8px)',
        flexShrink: 0,
      }}>
        <div style={{
          display: 'flex', gap: 10, alignItems: 'flex-end',
          background: '#0E1117', border: '1px solid #1f2532',
          borderRadius: 14, padding: '10px 10px 10px 16px',
          transition: 'border-color 0.15s, box-shadow 0.15s',
        }}
          onFocusCapture={e => {
            (e.currentTarget as HTMLDivElement).style.borderColor = '#4B5563'
            ;(e.currentTarget as HTMLDivElement).style.boxShadow = '0 0 0 3px rgba(124, 107, 246, 0.01)'
          }}
          onBlurCapture={e => {
            (e.currentTarget as HTMLDivElement).style.borderColor = '#1f2532'
            ;(e.currentTarget as HTMLDivElement).style.boxShadow = 'none'
          }}
        >
          <Sparkles size={14} color="#4B5563" style={{ marginBottom: 10, flexShrink: 0 }} />
          <textarea
            ref={textareaRef}
            rows={1}
            placeholder="Ask a doubt, solve a problem, explain a concept…"
            value={input}
            onChange={handleInput}
            onKeyDown={onKeyDown}
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              color: '#fafafa', fontSize: 14, fontFamily: 'inherit',
              resize: 'none', lineHeight: 1.6, maxHeight: 140,
              paddingTop: 2,
            }}
          />
          {streaming ? (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={stop}
              style={{
                width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                background: '#1a1f2e', border: '1px solid rgba(255,255,255,0.08)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <StopCircle size={16} color="#9CA3AF" />
            </motion.button>
          ) : (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => send()}
              disabled={!input.trim()}
              style={{
                width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                background: input.trim()
                  ? 'linear-gradient(135deg, #7C6BF6, #7C6BF6)'
                  : '#1a1f2e',
                border: 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: input.trim() ? 'pointer' : 'not-allowed',
                boxShadow: input.trim() ? '0 0 16px rgba(124, 107, 246, 0.14)' : 'none',
                transition: 'all 0.2s',
              }}
            >
              <Send size={15} color={input.trim() ? '#fff' : '#4B5563'} />
            </motion.button>
          )}
        </div>
        <p style={{ fontSize: 10, color: '#27272a', textAlign: 'center', marginTop: 8 }}>
          Enter to send · Shift+Enter for new line · AI can make mistakes — verify important facts
        </p>
      </div>
    </div>
  )
}
