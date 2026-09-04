import { useEffect, useMemo, useState, useRef } from 'react'
import { motion } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import { KATEX_OPTS } from '../lib/katex'
import { Layers, ChevronLeft, ChevronRight, Sparkles, FunctionSquare, RotateCcw, Plus, Check, Headphones, Square } from 'lucide-react'
import { useHotkeys } from '../lib/useHotkeys'
import { speakableText } from '../lib/listen.core'
import { speak, stopSpeaking, ttsAvailable } from '../lib/tts'
import { ToggleChip } from '../components/PrimaryButton'
import MathExpr from '../components/MathExpr'
import { listFormulas, listFlashcards, recordFlashcard, getProfile } from '../lib/twin'
import { buildDeck, deckSubjects, readPositions, positionFor, withPosition, type ReelCard } from '../lib/reels.core'
import { getRaw, setRaw, get as getKey } from '../lib/storage'
import { startTopicClock } from '../lib/timeTracker'
import { STARTER_DECKS, type StarterDeck } from '../data/starterDecks'
import { decksForCurriculum, newCardsForDeck, deckRemainingCount } from '../lib/starterDecks.core'
import { prepMathMarkdown } from '../lib/math.core'

/**
 * Revision Reels — a swipeable feed of the student's OWN cards.
 *
 * The deck is the twin store's formulas + flashcards, the same records the
 * Formula Sheet and Flashcards pages read. No second card database: a doubt
 * exported with recordFlashcard() simply appears here (that is C30 — the
 * export button in the Solver writes to the same store this reads).
 *
 * Position is remembered per subject, by card id — see reels.core.js for why
 * an index would drift.
 */

const C = {
  bg: '#0A0D16', panel: '#141A2A', border: 'rgba(255,255,255,0.08)',
  text: '#fafafa', dim: '#B1B5BA', faint: '#9CA3AF', purple: '#A5B4FC',
}

/**
 * Card text is not plain text: flashcards generated from doubts and camera
 * pages carry $...$ inline math, and rendering them as a raw string put
 * literal "$s = ut + \frac{1}{2}at^2$" on screen. Same renderer stack as the
 * Solver and drill answers, paragraphs flattened so the card stays centred.
 */
const MD_INLINE = { p: ({ children }: any) => <span>{children}</span> }
function CardText({ text }: { text: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[[rehypeKatex, KATEX_OPTS]]}
      components={MD_INLINE}
    >
      {prepMathMarkdown(text)}
    </ReactMarkdown>
  )
}

function posKey(): string {
  // Per-user: scopeLocalToUser() only clears kairo:* keys, so an un-scoped
  // kyno: key would leak one student's position to the next on a shared device.
  const uid = getKey<string>('lastUid') || 'local'
  return `kyno:reels:pos:${uid}`
}

export default function RevisionReels() {
  // Bumped when a starter deck is added, to rebuild the deck from the store.
  const [rev, setRev] = useState(0)
  const [showPicker, setShowPicker] = useState(false)

  // Read on mount and after each starter-deck add.
  const deck = useMemo(
    () => buildDeck({ formulas: listFormulas(), flashcards: listFlashcards() }, { now: Date.now() }),
    [rev],
  )
  const subjects = useMemo(() => deckSubjects(deck), [deck])

  const [subject, setSubject] = useState<string | null>(null)
  const filtered = useMemo(
    () => (subject ? deck.filter(c => c.subject === subject) : deck),
    [deck, subject],
  )

  // Starter decks that suit this student's board/class.
  const starterDecks = useMemo(() => {
    const p = getProfile() as any
    return decksForCurriculum(STARTER_DECKS, { board: p?.board, cls: p?.cls })
  }, [])

  function addDeck(d: StarterDeck) {
    const cards = newCardsForDeck(d, listFlashcards())
    for (const c of cards) recordFlashcard(c)
    setRev(r => r + 1)   // rebuild the reel from the store
    setShowPicker(false)
  }

  const [positions, setPositions] = useState<Record<string, string>>(() => readPositions(getRaw(posKey())))
  const [idx, setIdx] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [speakingId, setSpeakingId] = useState<string | null>(null)
  // The voice never outlives the page.
  useEffect(() => () => stopSpeaking(), [])
  const [dir, setDir] = useState(1)

  // Resume where they left off whenever the filter changes.
  useEffect(() => {
    setIdx(positionFor(filtered, positions, subject))
    setFlipped(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subject, filtered.length])

  function go(delta: number) {
    if (!filtered.length) return
    const next = (idx + delta + filtered.length) % filtered.length
    setDir(delta >= 0 ? 1 : -1)
    setIdx(next)
    setFlipped(false)
    const p = withPosition(positions, subject, filtered[next].id)
    setPositions(p)
    try { setRaw(posKey(), JSON.stringify(p)) } catch { /* private mode */ }
  }

  // Deck keys are page-scoped. Reels stays mounted behind whatever page is
  // showing, so an unguarded listener here ate the space bar app-wide and let
  // cursor arrows reshuffle the deck from other screens. useHotkeys refuses to
  // fire while the student is typing or while this page is parked.
  const rootRef = useRef<HTMLDivElement | null>(null)

  useHotkeys(e => {
    if (e.key === 'ArrowRight') { e.preventDefault(); go(1) }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1) }
    else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setFlipped(f => !f) }
  }, { containerRef: rootRef })

  const card: ReelCard | undefined = filtered[idx]

  // C24 — the time this card is actually on a visible screen counts toward its
  // subject/topic. The clock pauses when the tab is hidden and clamps runaway
  // credits; see timeTracker.ts.
  const clockRef = useMemo(() => ({ c: null as ReturnType<typeof startTopicClock> | null }), [])
  useEffect(() => {
    if (!clockRef.c) clockRef.c = startTopicClock()
    if (card) clockRef.c.switch(card.subject, card.topic)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card?.id])
  useEffect(() => () => { clockRef.c?.stop(); clockRef.c = null }, [clockRef])

  return (
    <div ref={rootRef} style={{
      width: '100%', height: '100%', overflowY: 'auto', background: C.bg,
      padding: '24px 32px 60px',
    }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{
            width: 46, height: 46, borderRadius: 13,
            background: 'linear-gradient(135deg, #A5B4FC 0%, #7C5CFF 60%, #0B1530 100%)',
            display: 'grid', placeItems: 'center', flexShrink: 0,
          }}>
            <Layers size={22} color="#000" strokeWidth={2.4} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: C.text, letterSpacing: -0.4 }}>
              Revision Reels
            </h1>
            <div style={{ fontSize: 12, color: C.faint }}>
              Your own formulas and flashcards, one swipe at a time. Cards due for review come first.
            </div>
          </div>
        </div>

        {subjects.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 18, alignItems: 'center' }}>
            <ToggleChip selected={subject === null} onClick={() => setSubject(null)}>
              All ({deck.length})
            </ToggleChip>
            {subjects.map(s => (
              <ToggleChip key={s.subject} selected={subject === s.subject} onClick={() => setSubject(s.subject)}>
                {s.subject} ({s.count})
              </ToggleChip>
            ))}
            {starterDecks.length > 0 && (
              <button onClick={() => setShowPicker(v => !v)} className="kyno-ghost"
                style={{ padding: '7px 13px', fontSize: 11.5, display: 'inline-flex', alignItems: 'center', gap: 5, marginLeft: 'auto' }}>
                <Plus size={12} /> {showPicker ? 'Close' : 'Starter decks'}
              </button>
            )}
          </div>
        )}

        {/* Cold-start: no cards yet, OR the student opened the picker to add more. */}
        {(!card || showPicker) ? (
          <StarterPicker
            decks={starterDecks}
            existing={listFlashcards()}
            onAdd={addDeck}
            emptyReel={!card}
          />
        ) : (
          <>
            <div style={{ fontSize: 11, color: C.faint, marginBottom: 8, textAlign: 'center' }}>
              {idx + 1} of {filtered.length}
              {card.due && <span style={{ color: '#FFB020' }}> · due for review</span>}
            </div>

            {/* Enter-only animation, no AnimatePresence: with mode="wait" +
                drag on the same node, the exiting card finished its fade and
                was never unmounted (stuck at opacity 0, verified in the DOM),
                so the next card never appeared. A keyed enter is less showy
                and cannot strand the student on an invisible card. */}
            <div style={{ position: 'relative', minHeight: 320 }}>
                <motion.div
                  key={card.id}
                  initial={{ opacity: 0, x: 60 * dir }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.16 }}
                  drag="x"
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={0.6}
                  onDragEnd={(_, info) => {
                    if (info.offset.x < -70) go(1)
                    else if (info.offset.x > 70) go(-1)
                  }}
                  onClick={() => setFlipped(f => !f)}
                  style={{
                    background: C.panel, border: `1px solid ${C.border}`, borderRadius: 20,
                    padding: '34px 28px', minHeight: 320, cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    justifyContent: 'center', textAlign: 'center', gap: 14,
                    boxShadow: '0 4px 0 0 rgba(0,0,0,0.38), 0 8px 18px rgba(0,0,0,0.20)',
                    userSelect: 'none',
                  }}
                >
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    fontSize: 10.5, fontWeight: 700, letterSpacing: 1.4, textTransform: 'uppercase',
                    color: C.purple,
                  }}>
                    {card.kind === 'formula' ? <FunctionSquare size={12} /> : <Layers size={12} />}
                    {card.subject}{card.topic ? ` · ${card.topic}` : ''}
                  </div>

                  {!flipped ? (
                    <div style={{ fontSize: 21, fontWeight: 800, color: C.text, lineHeight: 1.45 }}>
                      <CardText text={card.front} />
                    </div>
                  ) : (
                    <div style={{ fontSize: 18, color: C.text, lineHeight: 1.6, maxWidth: 560 }}>
                      {card.kind === 'formula' ? <MathExpr expr={card.back} /> : <CardText text={card.back} />}
                      {card.variants.length > 0 && (
                        <div style={{ marginTop: 14, fontSize: 13, color: C.dim }}>
                          <div style={{ fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase', color: C.faint, marginBottom: 6 }}>
                            Same law, rearranged
                          </div>
                          {card.variants.map((v, i) => (
                            <div key={i} style={{ marginTop: 4 }}><MathExpr expr={v} /></div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div style={{ fontSize: 10.5, color: C.faint }}>
                    <RotateCcw size={10} style={{ verticalAlign: '-1px', marginRight: 4 }} />
                    tap to {flipped ? 'see the front' : 'reveal'} · swipe or arrow keys to move
                  </div>

                  {/* Listen: the card reads itself aloud (front, beat, answer).
                      stopPropagation so it never doubles as a flip. */}
                  {ttsAvailable() && (
                    <button
                      onClick={e => {
                        e.stopPropagation()
                        if (speakingId === card.id) { stopSpeaking(); setSpeakingId(null); return }
                        const script = `${speakableText(card.front)}. ... ${card.kind === 'formula' ? 'The formula is: ' : 'The answer: '}${speakableText(card.back)}.`
                        if (speak(script, { onend: () => setSpeakingId(null) })) setSpeakingId(card.id)
                      }}
                      aria-label={speakingId === card.id ? 'Stop reading' : 'Read this card aloud'}
                      style={{
                        position: 'absolute', top: 12, right: 12, width: 34, height: 34,
                        borderRadius: '50%', border: `1px solid ${C.border}`, cursor: 'pointer',
                        background: speakingId === card.id ? '#FF7A90' : 'rgba(124,92,255,0.15)',
                        color: speakingId === card.id ? '#fff' : C.purple,
                        display: 'grid', placeItems: 'center',
                      }}>
                      {speakingId === card.id ? <Square size={12} /> : <Headphones size={14} />}
                    </button>
                  )}
                </motion.div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 16 }}>
              <button onClick={() => go(-1)} className="kyno-ghost" aria-label="Previous card"
                style={{ width: 42, height: 42, display: 'grid', placeItems: 'center' }}>
                <ChevronLeft size={17} />
              </button>
              <button onClick={() => go(1)} className="kyno-chunky" aria-label="Next card"
                style={{ width: 42, height: 42, display: 'grid', placeItems: 'center' }}>
                <ChevronRight size={17} />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/**
 * Starter deck picker — the cold-start fix. Full-width stacked cards so it
 * reads cleanly on a phone (no side-by-side squeeze), each showing how many
 * of its cards are still new to the student. Adding is idempotent: once every
 * card is in, the deck shows "Added" and can't double.
 */
function StarterPicker({ decks, existing, onAdd, emptyReel }: {
  decks: StarterDeck[]
  existing: any[]
  onAdd: (d: StarterDeck) => void
  emptyReel: boolean
}) {
  if (decks.length === 0) {
    return (
      <div style={{
        padding: '48px 24px', textAlign: 'center',
        background: C.panel, border: `1px dashed ${C.border}`, borderRadius: 18,
      }}>
        <Sparkles size={24} color={C.purple} style={{ marginBottom: 10 }} />
        <div style={{ fontSize: 14.5, fontWeight: 800, color: C.text, marginBottom: 6 }}>
          Starter decks for your board are coming
        </div>
        <p style={{ fontSize: 12.5, color: C.dim, maxWidth: 400, margin: '0 auto', lineHeight: 1.7 }}>
          For now, Reels fills up as you use Kyno — ask a doubt in the Solver or snap a page,
          and your first cards appear here.
        </p>
      </div>
    )
  }

  return (
    <div>
      {emptyReel && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: C.text, marginBottom: 4 }}>
            Start with a ready deck
          </div>
          <p style={{ fontSize: 12.5, color: C.dim, lineHeight: 1.6, margin: 0 }}>
            High-yield cards to revise from today. They join your own cards, and Kyno spaces them
            out for you. Your Solver doubts and saved formulas land here too.
          </p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {decks.map(d => {
          const remaining = deckRemainingCount(d, existing)
          const added = remaining === 0
          return (
            <div key={d.id} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '14px 16px', borderRadius: 14,
              background: C.panel, border: `1px solid ${C.border}`,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 800, color: C.text }}>{d.title}</div>
                <div style={{ fontSize: 11.5, color: C.faint, marginTop: 3, lineHeight: 1.5 }}>{d.blurb}</div>
                <div style={{ fontSize: 10.5, color: C.faint, marginTop: 4 }}>
                  {d.cards.length} cards{added ? ' · added' : remaining < d.cards.length ? ` · ${remaining} new` : ''}
                </div>
              </div>
              <button
                onClick={() => onAdd(d)}
                disabled={added}
                className={added ? 'kyno-ghost' : 'kyno-chunky'}
                style={{ padding: '9px 15px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0, opacity: added ? 0.7 : 1 }}>
                {added ? <><Check size={13} /> Added</> : <><Plus size={13} /> Add</>}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
