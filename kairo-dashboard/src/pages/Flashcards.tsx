/**
 * Flashcards — premium revision deck experience.
 *
 * Layout:
 *   - Hero header with stats (total, today, mastery, due)
 *   - "Suggested decks" pulled from the user's actual weak topics (twin.getMistakes())
 *   - Quick-start chips from common board topics
 *   - Topic input + generate → opens a deck viewer with 3D flip cards
 *   - Review tab — Anki-style SRS over every saved card
 *
 * Strict monochrome palette: black + deep purple + white only.
 */
import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BookMarked, ChevronLeft, ChevronRight, Sparkles, RotateCcw,
  Library, Check, X, Layers, Zap, Target, Brain, Plus,
  TrendingDown, Flame, ChevronsRight,
} from 'lucide-react'
import { chat } from '../lib/openrouter'
import { usePageGeneration } from '../lib/generationContext'
import { saveToNotebook } from '../lib/notebook'
import {
  recordFlashcard, listFlashcards, getMistakes,
  type Flashcard as TwinCard,
} from '../lib/twin'

// ════════════════════════════════════════════════════════════════════════════
// TOKENS — strict monochrome
// ════════════════════════════════════════════════════════════════════════════
const C = {
  bg:        '#050505',
  panel:     '#0E1117',
  panel2:    '#151922',
  border:    'rgba(255,255,255,0.08)',
  borderSoft:'rgba(255,255,255,0.06)',
  text:      '#fafafa',
  textDim:   '#B1B5BA',
  textFaint: '#9CA3AF',
  textGhost: '#6B7280',
  purple:    '#66D9FF',
  purpleHi:  '#4F7CFF',
  purpleDeep:'#2046C2',
  purpleLite:'#A5B4FC',
  purpleSoft:'#DBE7FF',
  purpleDark:'#0B1530',
}

const GRAD = {
  pill:      'linear-gradient(135deg, #A5B4FC 0%, #4F7CFF 60%, #0B1530 100%)',
  pillSoft:  'linear-gradient(135deg, #4F7CFF 0%, #2046C2 100%)',
  text:      'linear-gradient(90deg, #A5B4FC 0%, #66D9FF 50%, #4F7CFF 100%)',
}

interface Card { front: string; back: string }

const SYSTEM = `You are Kyno, an expert tutor for Indian school students.
When given a chapter or topic, generate exactly 10 flashcards in this JSON format:
[{"front": "Question or term", "back": "Concise but complete answer or definition"}]
Return ONLY the JSON array, no other text. Make cards exam-realistic.`

const QUICK_CHIPS = [
  'Newton\'s Laws',          'Quadratic Equations',
  'Periodic Table',          'Photosynthesis',
  'Vectors',                 'Tenses & Modals',
  'Indian Constitution',     'Trigonometry',
]

// ════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ════════════════════════════════════════════════════════════════════════════
export default function Flashcards() {
  const [mode, setMode]       = useState<'generate' | 'review'>('generate')
  const [topic, setTopic]     = useState('')
  const [cards, setCards]     = useState<Card[]>([])
  const [current, setCurrent] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const { startGenerating, stopGenerating } = usePageGeneration('flashcards')

  const [deck, setDeck] = useState<TwinCard[]>([])
  function reloadDeck() { setDeck(listFlashcards().slice(0, 200)) }
  useEffect(() => { reloadDeck() }, [])
  useEffect(() => { if (mode === 'review') reloadDeck() }, [mode])

  // Stats — pulled from the twin
  const stats = useMemo(() => {
    const all = listFlashcards()
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const todayCount = all.filter(c => c.ts >= today.getTime()).length
    const mastered = all.filter(c => c.reviews >= 3).length
    const due = all.filter(c => c.dueAt <= Date.now()).length
    return { total: all.length, today: todayCount, mastered, due }
  }, [deck])

  // Suggested decks — derived from the twin's weak topics
  const suggestions = useMemo(() => {
    const mistakes = getMistakes()
    if (mistakes.length === 0) return []
    return mistakes.slice(0, 4).map(m => ({
      title:    titleCase(m.topic),
      subject:  m.subject,
      severity: m.severity,
      count:    m.count,
    }))
  }, [deck])

  async function generate(seedTopic?: string) {
    const useTopic = (seedTopic ?? topic).trim()
    if (!useTopic) return
    setTopic(useTopic)
    setLoading(true); setError(''); setCards([]); setCurrent(0); setFlipped(false)
    startGenerating()
    try {
      const result = await chat({
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user',   content: `Generate flashcards for: ${useTopic}` },
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
      try { const { awardXP } = await import('../lib/game'); awardXP('flashcard_gen') } catch { /* non-fatal */ }
      try {
        for (const c of valid) {
          recordFlashcard({ front: c.front, back: c.back, topic: useTopic, source: 'auto-from-doubt' })
        }
        reloadDeck()
      } catch { /* ignore */ }
      saveToNotebook({
        kind: 'flashcards',
        title: `Flashcards · ${useTopic}`,
        content: valid.map((c, i) => `**${i + 1}. ${c.front}**\n\n${c.back}`).join('\n\n---\n\n'),
        subject: null,
        tags: [useTopic.split(' ')[0]],
        source: 'flashcards-page',
      })
    } catch (e: any) { setError(e.message || 'Failed') }
    finally { setLoading(false); stopGenerating() }
  }

  function prev() { setCurrent(c => Math.max(0, c - 1)); setFlipped(false) }
  function next() {
    // Advancing past a flipped card counts as one review (XP).
    if (flipped) { import('../lib/game').then(g => g.awardXP('flashcard_rev')).catch(() => {}) }
    setCurrent(c => Math.min(cards.length - 1, c + 1)); setFlipped(false)
  }

  return (
    <div style={{
      width: '100%', height: '100%', overflowY: 'auto',
      background: C.bg,
      backgroundImage:
        `radial-gradient(at 12% 0%, rgba(79, 124, 255, 0.10) 0%, transparent 36%),
         radial-gradient(at 88% 100%, rgba(32, 70, 194, 0.10) 0%, transparent 42%)`,
      padding: 'clamp(14px, 4vw, 24px) clamp(14px, 4vw, 32px) 60px',
    }}>
      <style>{`
        @keyframes fc-spin { to { transform: rotate(360deg) } }
        @keyframes fc-pulse { 0%,100% { opacity: 0.55 } 50% { opacity: 1 } }
        @keyframes fc-glow { 0%,100% { opacity: 0.4 } 50% { opacity: 0.9 } }
        .fc-spin { animation: fc-spin .8s linear infinite }
      `}</style>

      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        {/* ───── HERO ───── */}
        <Header mode={mode} setMode={setMode} stats={stats} />

        {mode === 'generate' ? (
          <>
            {/* Stats row */}
            <StatsRow stats={stats} />

            {/* Generator surface */}
            <div style={{
              marginTop: 20, padding: 22, borderRadius: 18,
              background: `linear-gradient(180deg, ${C.panel} 0%, ${C.bg} 100%)`,
              border: `1px solid ${C.border}`, position: 'relative', overflow: 'hidden',
            }}>
              <div style={{
                position: 'absolute', top: -40, right: -40,
                width: 220, height: 220, borderRadius: '50%',
                background: 'radial-gradient(closest-side, rgba(79, 124, 255, 0.32), transparent 70%)',
                filter: 'blur(40px)', animation: 'fc-glow 6s ease-in-out infinite',
                pointerEvents: 'none',
              }} />
              <div style={{ position: 'relative' }}>
                <div style={{ fontSize: 11, color: C.purple, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.6, marginBottom: 8 }}>
                  Generate a deck
                </div>
                <div className="mob-stack-flex" style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                  <input
                    style={{
                      flex: 1, minWidth: 0, background: C.panel2, border: `1px solid ${C.borderSoft}`, borderRadius: 12,
                      padding: '13px 18px', fontSize: 15, color: C.text, outline: 'none',
                      fontFamily: 'inherit', transition: 'border-color 0.2s, box-shadow 0.2s',
                    }}
                    placeholder="Chapter, topic, or a question…"
                    value={topic}
                    onChange={e => setTopic(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && generate()}
                    onFocus={e => { (e.target as HTMLInputElement).style.borderColor = C.purple; (e.target as HTMLInputElement).style.boxShadow = `0 0 0 3px rgba(102, 217, 255, 0.01)` }}
                    onBlur={e =>  { (e.target as HTMLInputElement).style.borderColor = C.borderSoft; (e.target as HTMLInputElement).style.boxShadow = 'none' }}
                  />
                  <motion.button
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                    onClick={() => generate()}
                    disabled={loading || !topic.trim()}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '13px 22px', borderRadius: 12, border: 'none',
                      background: topic.trim() ? GRAD.pill : C.panel2,
                      color: topic.trim() ? '#000' : C.textGhost,
                      fontFamily: 'inherit', fontSize: 14, fontWeight: 800,
                      cursor: topic.trim() ? 'pointer' : 'not-allowed',
                      boxShadow: topic.trim() ? '0 8px 24px rgba(79, 124, 255, 0.32)' : 'none',
                      flexShrink: 0, transition: 'all 0.2s', letterSpacing: 0.2,
                    }}>
                    {loading ? <RotateCcw size={15} className="fc-spin" /> : <Sparkles size={15} />}
                    {loading ? 'Generating…' : 'Generate 10 cards'}
                  </motion.button>
                </div>

                {/* Quick chips */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  <span style={{ fontSize: 10, color: C.textFaint, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.2, marginRight: 4, alignSelf: 'center' }}>Try:</span>
                  {QUICK_CHIPS.map(chip => (
                    <motion.button key={chip}
                      whileHover={{ y: -2, borderColor: 'rgba(102, 217, 255, 0.18)' }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => generate(chip)}
                      style={{
                        padding: '6px 12px', borderRadius: 999,
                        background: 'rgba(102, 217, 255, 0.05)',
                        border: `1px solid rgba(102, 217, 255, 0.18)`,
                        color: C.purpleLite, fontSize: 11.5, fontWeight: 600,
                        fontFamily: 'inherit', cursor: 'pointer',
                      }}>
                      {chip}
                    </motion.button>
                  ))}
                </div>
              </div>
            </div>

            {/* Suggested decks (auto-built from weak topics) */}
            {suggestions.length > 0 && (
              <Section title="Built for you" subtitle="Decks Kyno recommends from your weakest topics" icon={<Target size={13} />}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
                  {suggestions.map(s => (
                    <SuggestedDeckCard key={s.title} title={s.title} subject={s.subject} severity={s.severity} count={s.count}
                      onClick={() => generate(s.title)} />
                  ))}
                </div>
              </Section>
            )}

            {error && (
              <div style={{
                marginTop: 16, padding: '12px 14px', borderRadius: 10,
                background: 'rgba(102, 217, 255, 0.05)', border: '1px solid rgba(102, 217, 255, 0.3)',
                color: C.purpleLite, fontSize: 13,
              }}>
                {error}
              </div>
            )}

            {/* Generated cards viewer */}
            {!loading && cards.length > 0 && (
              <Section title="Your fresh deck" subtitle={`${cards.length} cards · ${topic}`} icon={<Sparkles size={13} />}>
                <DeckViewer cards={cards} idx={current} flipped={flipped}
                  onFlip={() => setFlipped(f => !f)}
                  onPrev={prev} onNext={next} />
              </Section>
            )}

            {/* Recent decks (everything in the unified deck) */}
            {deck.length > 0 && (
              <Section title="Your library" subtitle={`${deck.length} card${deck.length === 1 ? '' : 's'} saved on this device`} icon={<Library size={13} />}>
                <RecentDecks deck={deck} />
              </Section>
            )}
          </>
        ) : (
          <ReviewDeck deck={deck} onReload={reloadDeck} />
        )}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// HEADER
// ════════════════════════════════════════════════════════════════════════════
function Header({ mode, setMode, stats }: { mode: 'generate' | 'review'; setMode: (m: 'generate' | 'review') => void; stats: { total: number } }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
        <div style={{
          width: 52, height: 52, borderRadius: 14,
          background: GRAD.pill, display: 'grid', placeItems: 'center',
          boxShadow: '0 14px 38px rgba(79, 124, 255, 0.03)',
        }}>
          <BookMarked size={24} color="#000" />
        </div>
        <div>
          <div style={{
            fontSize: 11, fontWeight: 700, letterSpacing: 2.2, textTransform: 'uppercase',
            background: GRAD.text, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
          }}>
            Flashcards  ·  SRS
          </div>
          <h1 style={{ margin: '2px 0 0', fontSize: 26, fontWeight: 800, color: C.text, letterSpacing: -0.5 }}>
            Lock it in.
          </h1>
          <div style={{ fontSize: 12, color: C.textFaint, marginTop: 3 }}>
            {mode === 'generate'
              ? 'Build a fresh deck on any topic. Every card auto-saves to your device.'
              : 'Anki-style flip review with spaced repetition.'}
          </div>
        </div>
      </div>
      <div style={{
        display: 'inline-flex', padding: 3, borderRadius: 12,
        background: 'rgba(102, 217, 255, 0.05)',
        border: '1px solid rgba(102, 217, 255, 0.22)',
      }}>
        <ModeBtn active={mode === 'generate'} onClick={() => setMode('generate')}>
          <Sparkles size={12} /> Generate
        </ModeBtn>
        <ModeBtn active={mode === 'review'} onClick={() => setMode('review')}>
          <Library size={12} /> Review ({stats.total})
        </ModeBtn>
      </div>
    </div>
  )
}

function ModeBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '9px 16px', borderRadius: 9,
      background: active ? GRAD.pillSoft : 'transparent',
      border: 'none',
      color: active ? '#fff' : C.textDim,
      fontFamily: 'inherit', fontSize: 12, fontWeight: 700,
      cursor: 'pointer', letterSpacing: 0.3,
      boxShadow: active ? '0 4px 14px rgba(79, 124, 255, 0.35)' : 'none',
      transition: 'all 0.18s',
    }}>{children}</button>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// STATS ROW
// ════════════════════════════════════════════════════════════════════════════
function StatsRow({ stats }: { stats: { total: number; today: number; mastered: number; due: number } }) {
  return (
    <div className="fc-stats-row" style={{ marginTop: 22, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
      <StatTile icon={<Layers size={13} />}  label="Total cards"  value={stats.total}    accent={C.purpleLite} />
      <StatTile icon={<Zap size={13} />}     label="Added today"   value={stats.today}    accent={C.purple} />
      <StatTile icon={<Brain size={13} />}   label="Mastered"      value={stats.mastered} accent={C.purpleHi} />
      <StatTile icon={<Flame size={13} />}   label="Due for review" value={stats.due}     accent={C.purpleDeep} />
    </div>
  )
}

function StatTile({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: number; accent: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -3, borderColor: accent + '50', boxShadow: `0 10px 24px ${accent}22` }}
      style={{
        background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14,
        padding: '14px 16px', position: 'relative', overflow: 'hidden',
        transition: 'border-color 0.2s, box-shadow 0.2s, transform 0.2s',
      }}
    >
      <div style={{
        position: 'absolute', top: -25, right: -25,
        width: 80, height: 80, borderRadius: '50%',
        background: accent, opacity: 0.12, filter: 'blur(30px)',
      }} />
      <div style={{ position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: accent, marginBottom: 6 }}>
          {icon}
          <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.4, color: accent }}>{label}</span>
        </div>
        <div style={{ fontSize: 28, fontWeight: 800, color: C.text, letterSpacing: -0.7, lineHeight: 1 }}>{value}</div>
      </div>
    </motion.div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// SECTION HEADER
// ════════════════════════════════════════════════════════════════════════════
function Section({ title, subtitle, icon, children }: { title: string; subtitle?: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 26 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        {icon && <span style={{ color: C.purple, display: 'flex' }}>{icon}</span>}
        <h2 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: C.text, letterSpacing: -0.2 }}>{title}</h2>
        {subtitle && <span style={{ fontSize: 11.5, color: C.textFaint }}>{subtitle}</span>}
      </div>
      {children}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// SUGGESTED DECK CARD
// ════════════════════════════════════════════════════════════════════════════
function SuggestedDeckCard({ title, subject, severity, count, onClick }: { title: string; subject: string; severity: number; count: number; onClick: () => void }) {
  const intensity = Math.min(1, severity)
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ y: -4, boxShadow: `0 14px 34px rgba(79, 124, 255, 0.03)` }}
      whileTap={{ scale: 0.97 }}
      style={{
        textAlign: 'left', padding: '16px 18px', borderRadius: 14,
        background: `linear-gradient(135deg, ${C.panel} 0%, ${C.bg} 100%)`,
        border: `1px solid rgba(102, 217, 255, ${0.18 + intensity * 0.3})`,
        cursor: 'pointer', fontFamily: 'inherit', color: 'inherit',
        position: 'relative', overflow: 'hidden',
      }}
    >
      <div style={{
        position: 'absolute', top: -30, right: -30,
        width: 110, height: 110, borderRadius: '50%',
        background: C.purple, opacity: 0.10 + intensity * 0.12, filter: 'blur(30px)',
      }} />
      <div style={{ position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <TrendingDown size={11} color={C.purpleLite} />
          <span style={{ fontSize: 10, color: C.purpleLite, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.4 }}>
            {subject}
          </span>
        </div>
        <div style={{ fontSize: 15, fontWeight: 800, color: C.text, marginBottom: 5, lineHeight: 1.2, letterSpacing: -0.2 }}>
          {title}
        </div>
        <div style={{ fontSize: 11.5, color: C.textFaint, marginBottom: 12 }}>
          {count} miss{count === 1 ? '' : 'es'} so far · {Math.round(severity * 100)}% severity
        </div>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '6px 11px', borderRadius: 8,
          background: 'rgba(102, 217, 255, 0.12)', border: `1px solid rgba(102, 217, 255, 0.3)`,
          fontSize: 11, color: C.purpleLite, fontWeight: 700, letterSpacing: 0.3,
        }}>
          Generate 10 cards <ChevronsRight size={12} />
        </div>
      </div>
    </motion.button>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// DECK VIEWER  (with proper 3D flip)
// ════════════════════════════════════════════════════════════════════════════
function DeckViewer({ cards, idx, flipped, onFlip, onPrev, onNext }: {
  cards: Card[]; idx: number; flipped: boolean;
  onFlip: () => void; onPrev: () => void; onNext: () => void
}) {
  const card = cards[idx]
  if (!card) return null
  return (
    <div>
      <div style={{ fontSize: 11, color: C.textFaint, letterSpacing: 1.4, textTransform: 'uppercase', fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
        Card {idx + 1} of {cards.length}
        <div style={{ flex: 1, height: 3, background: C.panel2, borderRadius: 999, overflow: 'hidden' }}>
          <motion.div
            animate={{ width: `${((idx + 1) / cards.length) * 100}%` }}
            style={{ height: '100%', background: GRAD.pill, borderRadius: 999 }}
          />
        </div>
      </div>
      <FlipCard front={card.front} back={card.back} flipped={flipped} onFlip={onFlip} />
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 14 }}>
        <button onClick={onPrev} disabled={idx === 0} style={{ ...navBtn, opacity: idx === 0 ? 0.35 : 1 }}>
          <ChevronLeft size={14} /> Previous
        </button>
        <button onClick={onNext} disabled={idx >= cards.length - 1} style={{ ...navBtn, opacity: idx >= cards.length - 1 ? 0.35 : 1, borderColor: 'rgba(102, 217, 255, 0.14)', color: C.purpleLite }}>
          Next <ChevronRight size={14} />
        </button>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// 3D FLIP CARD
// ════════════════════════════════════════════════════════════════════════════
function FlipCard({ front, back, flipped, onFlip }: { front: string; back: string; flipped: boolean; onFlip: () => void }) {
  return (
    <div style={{ perspective: 1400 }}>
      <motion.button
        type="button"
        onClick={onFlip}
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{ duration: 0.55, ease: [0.2, 0.8, 0.2, 1] }}
        whileHover={{ scale: 1.01 }}
        style={{
          width: '100%', height: 280, borderRadius: 18, cursor: 'pointer',
          position: 'relative', transformStyle: 'preserve-3d',
          background: 'transparent', border: 'none', padding: 0,
          fontFamily: 'inherit',
        }}
      >
        <Face side="front" text={front} active={!flipped} />
        <Face side="back"  text={back}  active={flipped} />
      </motion.button>
    </div>
  )
}

function Face({ side, text, active }: { side: 'front' | 'back'; text: string; active: boolean }) {
  return (
    <div style={{
      position: 'absolute', inset: 0,
      backfaceVisibility: 'hidden',
      WebkitBackfaceVisibility: 'hidden',
      transform: side === 'back' ? 'rotateY(180deg)' : 'rotateY(0deg)',
      borderRadius: 18,
      background: side === 'front'
        ? `linear-gradient(135deg, ${C.panel} 0%, ${C.bg} 100%)`
        : `linear-gradient(135deg, ${C.purpleDark} 0%, ${C.bg} 100%)`,
      border: `1px solid ${side === 'front' ? 'rgba(102, 217, 255, 0.3)' : 'rgba(165, 180, 252, 0.5)'}`,
      boxShadow: '0 24px 60px rgba(79, 124, 255, 0.01), inset 0 0 60px rgba(79, 124, 255, 0.01)',
      padding: '40px 38px',
      display: 'grid', placeItems: 'center', textAlign: 'center',
      color: C.text,
      overflow: 'hidden',
    }}>
      {/* corner orbs */}
      <div style={{
        position: 'absolute', top: -30, right: -30,
        width: 160, height: 160, borderRadius: '50%',
        background: side === 'front' ? C.purple : C.purpleLite,
        opacity: 0.10, filter: 'blur(40px)',
      }} />
      <div style={{
        position: 'absolute', bottom: -30, left: -30,
        width: 140, height: 140, borderRadius: '50%',
        background: C.purpleHi, opacity: 0.10, filter: 'blur(40px)',
      }} />
      <div style={{
        position: 'absolute', top: 16, left: 20,
        fontSize: 10, fontWeight: 800, color: side === 'front' ? C.purple : C.purpleLite,
        letterSpacing: 1.8, textTransform: 'uppercase',
      }}>
        {side === 'front' ? 'Question' : 'Answer'}
      </div>
      <p style={{
        margin: 0, fontSize: 19, fontWeight: 600,
        color: C.text, lineHeight: 1.5, maxWidth: 640,
        fontFamily: '"Charter", "Iowan Old Style", Georgia, serif',
        position: 'relative',
      }}>
        {text}
      </p>
      <div style={{
        position: 'absolute', bottom: 14, right: 20,
        fontSize: 10, color: C.textFaint, letterSpacing: 1.4, textTransform: 'uppercase', fontWeight: 700,
      }}>
        Click to {side === 'front' ? 'reveal' : 'flip back'}
      </div>
      {active && <span style={{ display: 'none' }} aria-hidden />}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// RECENT DECKS — group saved cards by topic
// ════════════════════════════════════════════════════════════════════════════
function RecentDecks({ deck }: { deck: TwinCard[] }) {
  const byTopic = useMemo(() => {
    const m = new Map<string, TwinCard[]>()
    for (const c of deck) {
      const key = (c.topic || 'general').toLowerCase()
      if (!m.has(key)) m.set(key, [])
      m.get(key)!.push(c)
    }
    return [...m.entries()]
      .sort((a, b) => Math.max(...b[1].map(c => c.ts)) - Math.max(...a[1].map(c => c.ts)))
      .slice(0, 6)
  }, [deck])

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
      {byTopic.map(([topic, cards]) => (
        <motion.div
          key={topic}
          whileHover={{ y: -3, borderColor: 'rgba(102, 217, 255, 0.14)', boxShadow: '0 10px 28px rgba(79, 124, 255, 0.01)' }}
          style={{
            padding: '14px 16px', borderRadius: 12,
            background: C.panel, border: `1px solid ${C.borderSoft}`,
            cursor: 'default', transition: 'all 0.2s',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <BookMarked size={11} color={C.purple} />
            <span style={{ fontSize: 10, fontWeight: 700, color: C.purple, textTransform: 'uppercase', letterSpacing: 1.3 }}>
              {cards.length} card{cards.length === 1 ? '' : 's'}
            </span>
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.text, textTransform: 'capitalize', lineHeight: 1.3, marginBottom: 4 }}>
            {topic}
          </div>
          <div style={{ fontSize: 10.5, color: C.textFaint }}>
            Latest {formatRelative(Math.max(...cards.map(c => c.ts)))}
          </div>
        </motion.div>
      ))}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// REVIEW DECK — SRS-style review across every saved card
// ════════════════════════════════════════════════════════════════════════════
function ReviewDeck({ deck, onReload }: { deck: TwinCard[]; onReload: () => void }) {
  const [idx, setIdx]         = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [reviewed, setReviewed] = useState({ got: 0, forgot: 0 })

  if (deck.length === 0) {
    return (
      <div style={{
        marginTop: 28, padding: '60px 24px', textAlign: 'center',
        background: C.panel, border: `1px dashed ${C.border}`, borderRadius: 18,
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: 14, margin: '0 auto 16px',
          background: 'rgba(102, 217, 255, 0.08)', border: '1px solid rgba(102, 217, 255, 0.22)',
          display: 'grid', placeItems: 'center',
        }}>
          <Library size={26} color={C.purple} style={{ opacity: 0.7 }} />
        </div>
        <h3 style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 800, color: C.text }}>
          No saved cards yet
        </h3>
        <p style={{ margin: 0, fontSize: 13, color: C.textFaint, maxWidth: 420, marginInline: 'auto', lineHeight: 1.6 }}>
          Switch to <strong style={{ color: C.purpleLite }}>Generate</strong> and create your first deck. Every card you make auto-saves here for spaced review.
        </p>
      </div>
    )
  }

  const c = deck[idx % deck.length]
  function go(n: number, action?: 'got' | 'forgot') {
    if (action) setReviewed(r => ({ ...r, [action]: r[action] + 1 }))
    setFlipped(false)
    setIdx(i => (i + n + deck.length) % deck.length)
  }

  return (
    <div style={{ marginTop: 18 }}>
      {/* Progress strip */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
        <div style={{ fontSize: 11, color: C.textFaint, letterSpacing: 1.4, textTransform: 'uppercase', fontWeight: 700 }}>
          Card {idx + 1} / {deck.length}
        </div>
        <div style={{ flex: 1, height: 3, background: C.panel2, borderRadius: 999, overflow: 'hidden' }}>
          <motion.div
            animate={{ width: `${((idx + 1) / deck.length) * 100}%` }}
            style={{ height: '100%', background: GRAD.pill }}
          />
        </div>
        <div style={{ fontSize: 11, color: C.textDim, fontWeight: 700 }}>
          <span style={{ color: C.purpleLite }}>✓ {reviewed.got}</span>
          <span style={{ margin: '0 8px', color: C.textGhost }}>·</span>
          <span style={{ color: C.purpleSoft }}>✗ {reviewed.forgot}</span>
        </div>
        <button onClick={onReload} title="Reload deck" style={{
          padding: 7, borderRadius: 8, background: 'transparent',
          border: `1px solid ${C.border}`, color: C.textDim, cursor: 'pointer',
        }}>
          <RotateCcw size={12} />
        </button>
      </div>

      {c.topic && (
        <div style={{ fontSize: 11, fontWeight: 700, color: C.purpleLite, textTransform: 'uppercase', letterSpacing: 1.4, marginBottom: 8 }}>
          {c.topic}
        </div>
      )}

      <FlipCard front={c.front} back={c.back} flipped={flipped} onFlip={() => setFlipped(f => !f)} />

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
        <button onClick={() => go(-1)} style={navBtn}><ChevronLeft size={14} /> Previous</button>
        <div style={{ display: 'flex', gap: 8 }}>
          <motion.button whileTap={{ scale: 0.94 }} onClick={() => go(1, 'forgot')} style={{
            ...navBtn,
            borderColor: 'rgba(165, 180, 252, 0.4)',
            color: C.purpleSoft,
            background: 'rgba(165, 180, 252, 0.06)',
          }}>
            <X size={13} /> Forgot
          </motion.button>
          <motion.button whileTap={{ scale: 0.94 }} onClick={() => go(1, 'got')} style={{
            ...navBtn,
            borderColor: C.purple,
            color: '#000',
            background: GRAD.pill,
            fontWeight: 700,
          }}>
            <Check size={13} /> Got it
          </motion.button>
        </div>
        <button onClick={() => go(1)} style={navBtn}>Next <ChevronRight size={14} /></button>
      </div>
    </div>
  )
}

const navBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '9px 16px', borderRadius: 10,
  background: 'transparent', border: `1px solid ${C.border}`,
  color: C.textDim, fontFamily: 'inherit', fontSize: 12, fontWeight: 700,
  cursor: 'pointer', transition: 'all 0.18s',
}

// ────────────────────────────────────────────────────────────────────────────
// HELPERS
// ────────────────────────────────────────────────────────────────────────────
function titleCase(s: string): string {
  return s.replace(/\b\w/g, c => c.toUpperCase())
}

function formatRelative(ts: number) {
  if (!ts) return '—'
  const diff = Date.now() - ts
  const s = Math.floor(diff / 1000)
  if (s < 45) return 'just now'
  const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24); if (d < 30) return `${d}d ago`
  return new Date(ts).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
}

// Suppress unused-import lint without exporting
const _unused = [Plus]
