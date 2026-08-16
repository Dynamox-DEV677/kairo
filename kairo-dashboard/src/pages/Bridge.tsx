import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, CheckCircle2, AlertTriangle, MinusCircle, Route, Info } from 'lucide-react'
import { PrimaryButton, ToggleChip } from '../components/PrimaryButton'
import { BOARD_OPTIONS, resolveCurriculum } from '../lib/curriculum.core'
import { buildBridge, classesUpTo, groupRows } from '../lib/bridge.core'
import { allTopics, type BoardId } from '../data/syllabus/index'
import { getProfile } from '../lib/twin'

/**
 * Bridging mode — for a student who changed curriculum mid-year.
 *
 * The advice such a student normally gets is "you'll need to catch up", with no
 * list. This produces the list, from the two curricula's real topic maps:
 * what they have already met, what only the old course had (safe to drop), and
 * what is genuinely new.
 *
 * Nothing on this page is AI-generated. Every row is a comparison of
 * src/data/syllabus/*.json, which is the only reason it can be trusted — and
 * why it refuses to render a comparison when either side is unmapped.
 */

const C = {
  bg: '#0A0D16', panel: '#141A2A', panel2: '#1C2233',
  border: 'rgba(255,255,255,0.08)', text: '#fafafa', dim: '#B1B5BA',
  faint: '#9CA3AF', purple: '#A5B4FC', green: '#34D399', amber: '#FFB020',
}
const card: React.CSSProperties = {
  background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: 18,
}
const lbl: React.CSSProperties = {
  fontSize: 10, color: C.purple, fontWeight: 700, letterSpacing: 1.2,
  textTransform: 'uppercase', display: 'block', marginBottom: 8,
}
const CLASSES = ['6', '7', '8', '9', '10', '11', '12']

export default function Bridge() {
  const profile = getProfile()

  const [fromBoard, setFromBoard] = useState('CBSE')
  const [fromCls, setFromCls] = useState('9')
  const [toBoard, setToBoard] = useState(profile?.board || 'Cambridge')
  const [toCls, setToCls] = useState(String(profile?.cls || '10').replace(/\D/g, '') || '10')
  const [ran, setRan] = useState(false)

  const result = useMemo(() => {
    if (!ran) return null
    const a = resolveCurriculum(fromBoard, fromCls)
    const b = resolveCurriculum(toBoard, toCls)
    return buildBridge({
      // Everything covered so far, not just the leaving year.
      from: { label: a.label, cls: a.cls, syllabusBoard: a.syllabusBoard, classes: classesUpTo(fromCls) },
      to:   { label: b.label, cls: b.cls, syllabusBoard: b.syllabusBoard },
      lookup: (board, cls) => allTopics(board as BoardId, cls ?? undefined),
    })
  }, [ran, fromBoard, fromCls, toBoard, toCls])

  return (
    <div style={{
      width: '100%', height: '100%', overflowY: 'auto', background: C.bg,
      padding: '24px 32px 60px',
    }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 22 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14, flexShrink: 0,
            background: 'linear-gradient(135deg, #A5B4FC 0%, #7C5CFF 60%, #0B1530 100%)',
            display: 'grid', placeItems: 'center',
          }}>
            <Route size={24} color="#000" strokeWidth={2.4} />
          </div>
          <div>
            <div style={{ ...lbl, marginBottom: 2 }}>Switching curriculum</div>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: C.text, letterSpacing: -0.5 }}>
              What you've already done, and what you actually need.
            </h1>
            <p style={{ fontSize: 12.5, color: C.faint, marginTop: 4, maxWidth: 640 }}>
              Compares the real chapter lists of both curricula. Not an estimate and not AI-written —
              if Kyno doesn't have a verified map for one of them, it says so instead of guessing.
            </p>
          </div>
        </div>

        <div style={{ ...card, marginBottom: 18 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 16, alignItems: 'center' }}
            className="mob-stack">
            <Picker title="Coming from" board={fromBoard} setBoard={setFromBoard}
              cls={fromCls} setCls={setFromCls} />
            <ArrowRight size={20} color={C.purple} style={{ alignSelf: 'center' }} />
            <Picker title="Moving to" board={toBoard} setBoard={setToBoard}
              cls={toCls} setCls={setToCls} />
          </div>
          <div style={{ marginTop: 16 }}>
            <PrimaryButton onClick={() => setRan(true)} full>
              <Route size={14} /> Compare my curricula
            </PrimaryButton>
          </div>
        </div>

        {result?.unavailable && (
          <div style={{ ...card, borderColor: 'rgba(255,176,32,0.35)', background: 'rgba(255,176,32,0.06)' }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <Info size={17} color={C.amber} style={{ flexShrink: 0, marginTop: 1 }} />
              <div>
                <div style={{ fontWeight: 800, color: C.text, fontSize: 14, marginBottom: 4 }}>
                  Can't compare these two honestly
                </div>
                <p style={{ margin: 0, fontSize: 13, color: C.dim, lineHeight: 1.6 }}>{result.reason}</p>
              </div>
            </div>
          </div>
        )}

        {result && !result.unavailable && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <div style={{ ...card, marginBottom: 16, display: 'flex', gap: 22, flexWrap: 'wrap', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 34, fontWeight: 900, color: C.green, lineHeight: 1 }}>
                  {result.readiness}%
                </div>
                <div style={{ fontSize: 11, color: C.faint, marginTop: 4 }}>
                  of {result.to.label} already covered
                </div>
              </div>
              <div style={{ flex: 1, minWidth: 220, fontSize: 12.5, color: C.dim, lineHeight: 1.6 }}>
                Comparing <b style={{ color: C.text }}>{result.from.total}</b> topics you've studied
                on {result.from.label} (classes 6–{result.from.cls}) against
                the <b style={{ color: C.text }}>{result.to.total}</b> topics {result.to.label} expects.
              </div>
            </div>

            <Section
              icon={AlertTriangle} color={C.amber}
              title={`Catch up on these — ${result.toLearn.length}`}
              blurb="In your new curriculum, with no close match in what you've already studied. This is the real gap list."
              rows={result.toLearn}
            />
            <Section
              icon={CheckCircle2} color={C.green}
              title={`Already covered — ${result.covered.length}`}
              blurb="You've met these under a different name. Shown with the chapter they came from, so you can check for yourself."
              rows={result.covered} showMatch
            />
            <Section
              icon={MinusCircle} color={C.faint}
              title={`Only in your old curriculum — ${result.canDrop.length}`}
              blurb="Not in the new course. You can stop revising these — but keep them if you still have exams on the old syllabus."
              rows={result.canDrop}
            />

            <p style={{ fontSize: 11.5, color: C.faint, marginTop: 18, lineHeight: 1.7 }}>
              Matching is by topic wording, so it is a strong guide rather than a guarantee — two
              curricula can use the same words for slightly different depth. Kyno deliberately errs
              toward listing something as "catch up": being told you've covered something you
              haven't is the mistake that costs marks.
            </p>
          </motion.div>
        )}
      </div>
    </div>
  )
}

function Picker({ title, board, setBoard, cls, setCls }: {
  title: string; board: string; setBoard: (v: string) => void
  cls: string; setCls: (v: string) => void
}) {
  return (
    <div style={{ background: C.panel2, borderRadius: 12, padding: 14 }}>
      <div style={lbl}>{title}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
        {BOARD_OPTIONS.map(b => (
          <ToggleChip key={b.value} selected={board === b.value} onClick={() => setBoard(b.value)}
            style={{ fontSize: 11.5, padding: '6px 11px' }}>
            {b.label}
          </ToggleChip>
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
        {CLASSES.map(c => (
          <ToggleChip key={c} selected={cls === c} onClick={() => setCls(c)}
            style={{ fontSize: 11, padding: '5px 10px' }}>
            {c}
          </ToggleChip>
        ))}
      </div>
    </div>
  )
}

function Section({ icon: Icon, color, title, blurb, rows, showMatch = false }: {
  icon: any; color: string; title: string; blurb: string; rows: any[]; showMatch?: boolean
}) {
  const [open, setOpen] = useState(true)
  const grouped = useMemo(() => groupRows(rows), [rows])
  if (!rows.length) return null

  return (
    <div style={{ ...card, marginBottom: 14 }}>
      <button onClick={() => setOpen(o => !o)} className="kyno-ghost" style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 9,
        padding: '8px 12px', textAlign: 'left', marginBottom: open ? 12 : 0,
      }}>
        <Icon size={16} color={color} style={{ flexShrink: 0 }} />
        <span style={{ fontWeight: 800, fontSize: 13.5, flex: 1 }}>{title}</span>
        <span style={{ fontSize: 11 }}>{open ? 'Hide' : 'Show'}</span>
      </button>

      {open && (
        <>
          <p style={{ margin: '0 0 12px', fontSize: 12, color: C.faint, lineHeight: 1.6 }}>{blurb}</p>
          {grouped.map(g => (
            <div key={g.subject} style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: C.purple, marginBottom: 6 }}>
                {g.subject}
              </div>
              {g.chapters.map(ch => (
                <div key={ch.chapter} style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 11, color: C.faint, marginBottom: 3 }}>{ch.chapter}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    {ch.topics.map((t: any, i: number) => (
                      <span key={i}
                        title={showMatch && t.matchedWith ? `You studied this as "${t.matchedWith}"` : undefined}
                        style={{
                          fontSize: 11.5, padding: '4px 9px', borderRadius: 7,
                          background: 'rgba(255,255,255,0.04)',
                          border: `1px solid ${C.border}`, color: C.dim,
                        }}>
                        {t.name}
                        {showMatch && t.matchedWith && (
                          <span style={{ color: C.faint }}> · was “{t.matchedWith}”</span>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </>
      )}
    </div>
  )
}
