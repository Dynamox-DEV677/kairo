import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Layers, ChevronLeft, ChevronRight, Sparkles, FunctionSquare, RotateCcw } from 'lucide-react'
import { ToggleChip } from '../components/PrimaryButton'
import MathExpr from '../components/MathExpr'
import { listFormulas, listFlashcards } from '../lib/twin'
import { buildDeck, deckSubjects, readPositions, positionFor, withPosition, type ReelCard } from '../lib/reels.core'
import { getRaw, setRaw, get as getKey } from '../lib/storage'

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

function posKey(): string {
  // Per-user: scopeLocalToUser() only clears kairo:* keys, so an un-scoped
  // kyno: key would leak one student's position to the next on a shared device.
  const uid = getKey<string>('lastUid') || 'local'
  return `kyno:reels:pos:${uid}`
}

export default function RevisionReels() {
  // Read once on mount; the twin store does not change under an open reel.
  const deck = useMemo(
    () => buildDeck({ formulas: listFormulas(), flashcards: listFlashcards() }, { now: Date.now() }),
    [],
  )
  const subjects = useMemo(() => deckSubjects(deck), [deck])

  const [subject, setSubject] = useState<string | null>(null)
  const filtered = useMemo(
    () => (subject ? deck.filter(c => c.subject === subject) : deck),
    [deck, subject],
  )

  const [positions, setPositions] = useState<Record<string, string>>(() => readPositions(getRaw(posKey())))
  const [idx, setIdx] = useState(0)
  const [flipped, setFlipped] = useState(false)
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') go(1)
      else if (e.key === 'ArrowLeft') go(-1)
      else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setFlipped(f => !f) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, filtered.length, subject])

  const card: ReelCard | undefined = filtered[idx]

  return (
    <div style={{
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
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 18 }}>
            <ToggleChip selected={subject === null} onClick={() => setSubject(null)}>
              All ({deck.length})
            </ToggleChip>
            {subjects.map(s => (
              <ToggleChip key={s.subject} selected={subject === s.subject} onClick={() => setSubject(s.subject)}>
                {s.subject} ({s.count})
              </ToggleChip>
            ))}
          </div>
        )}

        {!card ? (
          <div style={{
            padding: '64px 24px', textAlign: 'center',
            background: C.panel, border: `1px dashed ${C.border}`, borderRadius: 18,
          }}>
            <Sparkles size={26} color={C.purple} style={{ marginBottom: 12 }} />
            <div style={{ fontSize: 15, fontWeight: 800, color: C.text, marginBottom: 6 }}>
              Nothing here yet — and that's normal
            </div>
            <p style={{ fontSize: 12.5, color: C.dim, maxWidth: 400, margin: '0 auto', lineHeight: 1.7 }}>
              Reels fill up as you use Kyno: formulas you touch in the Solver and flashcards you save
              land here automatically. Ask one doubt or snap one page, and your first card appears.
            </p>
          </div>
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
                      {card.front}
                    </div>
                  ) : (
                    <div style={{ fontSize: 18, color: C.text, lineHeight: 1.6, maxWidth: 560 }}>
                      {card.kind === 'formula' ? <MathExpr expr={card.back} /> : card.back}
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
