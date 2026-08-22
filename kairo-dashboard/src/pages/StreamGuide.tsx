import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Compass, ArrowRight, Info } from 'lucide-react'
import { PrimaryButton } from '../components/PrimaryButton'
import { getDashboard } from '../lib/twin'
import { STREAM_QUIZ, STREAMS, suggestStream, type StreamSuggestion } from '../lib/stream.core'

/**
 * C27 — stream guidance for a Class 9-10 student. The suggestion is weighted
 * toward the student's REAL in-app mastery (0.6), with the short quiz as the
 * lighter interest signal (0.4). It says plainly when it's leaning on the quiz
 * because there's little performance data yet — never a confident verdict off
 * four taps.
 */

const C = {
  bg: '#0A0D16', panel: '#141A2A', panel2: '#1C2233', border: 'rgba(255,255,255,0.08)',
  text: '#fafafa', dim: '#B1B5BA', faint: '#9CA3AF', purple: '#A5B4FC', green: '#34D399', amber: '#FFB020',
}
const card: React.CSSProperties = { background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20 }

export default function StreamGuide() {
  const [answers, setAnswers] = useState<(string | null)[]>(() => STREAM_QUIZ.map(() => null))
  const [result, setResult] = useState<StreamSuggestion | null>(null)

  const mastery = useMemo(() => { try { return getDashboard().mastery } catch { return [] } }, [])
  const allAnswered = answers.every(Boolean)

  function compute() {
    const signals = answers.filter(Boolean) as string[]
    setResult(suggestStream({ mastery, signals }))
  }

  return (
    <div style={{ width: '100%', height: '100%', overflowY: 'auto', background: C.bg, padding: '24px 20px 80px' }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <div style={{ width: 46, height: 46, borderRadius: 13, flexShrink: 0, background: 'linear-gradient(135deg, #A5B4FC 0%, #7C5CFF 60%, #0B1530 100%)', display: 'grid', placeItems: 'center' }}>
            <Compass size={22} color="#000" strokeWidth={2.4} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: C.text, letterSpacing: -0.4 }}>Which stream?</h1>
            <div style={{ fontSize: 12, color: C.faint }}>Science · Commerce · Arts — weighed against how you actually perform, not just a quiz.</div>
          </div>
        </div>

        <div style={{ ...card, marginBottom: 16 }}>
          {STREAM_QUIZ.map((item, qi) => (
            <div key={qi} style={{ marginBottom: qi === STREAM_QUIZ.length - 1 ? 0 : 18 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: C.text, marginBottom: 8 }}>{qi + 1}. {item.q}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {item.options.map((opt, oi) => {
                  const chosen = answers[qi] === opt.signal
                  return (
                    <button key={oi} onClick={() => setAnswers(a => { const n = [...a]; n[qi] = opt.signal; return n })}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left',
                        padding: '11px 14px', borderRadius: 11, cursor: 'pointer', fontFamily: 'inherit',
                        background: chosen ? 'rgba(124,92,255,0.12)' : 'rgba(255,255,255,0.03)',
                        border: `1.5px solid ${chosen ? 'rgba(124,92,255,0.55)' : 'rgba(255,255,255,0.08)'}`,
                        color: chosen ? '#fff' : C.dim, fontSize: 12.5,
                      }}>
                      <span style={{
                        width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
                        border: `2px solid ${chosen ? '#7C5CFF' : 'rgba(255,255,255,0.2)'}`,
                        background: chosen ? '#7C5CFF' : 'transparent',
                      }} />
                      {opt.label}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
          <div style={{ marginTop: 16 }}>
            <PrimaryButton full onClick={compute} disabled={!allAnswered}>
              {allAnswered ? 'See my suggestion' : `Answer all ${STREAM_QUIZ.length} to continue`}
            </PrimaryButton>
          </div>
        </div>

        {result && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={card}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.4, textTransform: 'uppercase', color: C.purple, marginBottom: 8 }}>
              Your closest fit
            </div>
            <div style={{ fontSize: 26, fontWeight: 900, color: C.text, marginBottom: 4 }}>{STREAMS[result.top as 'science'].label}</div>
            <div style={{ fontSize: 12.5, color: C.dim, lineHeight: 1.6, marginBottom: 12 }}>{STREAMS[result.top as 'science'].blurb}</div>

            {result.reasons.map((r, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 6 }}>
                <ArrowRight size={13} color={C.green} style={{ flexShrink: 0, marginTop: 2 }} />
                <span style={{ fontSize: 12.5, color: C.dim, lineHeight: 1.5 }}>{r}</span>
              </div>
            ))}

            {/* The three-way breakdown, so it's a comparison not a decree. */}
            <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {result.ranked.map(r => (
                <div key={r.stream} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 130, fontSize: 12, color: r.stream === result.top ? C.text : C.faint, fontWeight: r.stream === result.top ? 800 : 600 }}>
                    {STREAMS[r.stream as 'science'].label}
                  </span>
                  <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                    <div style={{ width: `${Math.round(r.score * 100)}%`, height: '100%', background: r.stream === result.top ? 'var(--c-purple)' : 'rgba(165,180,252,0.4)' }} />
                  </div>
                </div>
              ))}
            </div>

            {(result.dataStrength !== 'ok' || result.close) && (
              <div style={{ display: 'flex', gap: 8, marginTop: 14, padding: '10px 12px', borderRadius: 10, background: 'rgba(255,176,32,0.06)', border: '1px solid rgba(255,176,32,0.28)' }}>
                <Info size={14} color={C.amber} style={{ flexShrink: 0, marginTop: 1 }} />
                <span style={{ fontSize: 11.5, color: C.dim, lineHeight: 1.6 }}>
                  {result.dataStrength === 'none'
                    ? 'This is based on your answers alone — Kyno has no quiz/performance history for you yet. Do a few quizzes across subjects and this will get much sharper.'
                    : result.dataStrength === 'low'
                      ? 'Based on a little performance data plus your answers. The more you quiz across subjects, the more this reflects your real strengths.'
                      : "It's close between your top options — treat this as a nudge, not a verdict. Your interests matter as much as the numbers."}
                </span>
              </div>
            )}
            <div style={{ fontSize: 10.5, color: C.faint, marginTop: 12, lineHeight: 1.5 }}>
              A suggestion, not a rule — plenty of people thrive in a stream this didn't pick first.
            </div>
          </motion.div>
        )}
      </div>
    </div>
  )
}
