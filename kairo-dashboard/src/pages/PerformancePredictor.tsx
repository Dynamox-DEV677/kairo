import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  TrendingUp, TrendingDown, Minus, Sparkles,
  RefreshCw, Target, Zap, Award,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import { api } from '../lib/api'
import { chat } from '../lib/openrouter'

interface SubjectPrediction {
  subject:    string
  current:    number
  predicted:  number
  trajectory: 'up' | 'down' | 'flat'
  confidence: 'low' | 'medium' | 'high'
  exams:      number
  weak_count: number
  risk:       'low' | 'medium' | 'high'
}

const card: React.CSSProperties = { background: '#141A2A', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14 }

export default function PerformancePredictor() {
  const [predictions, setPredictions] = useState<SubjectPrediction[] | null>(null)
  const [loading, setLoading]         = useState(true)
  const [insight, setInsight]         = useState('')
  const [insightBusy, setInsightBusy] = useState(false)
  const [err, setErr]                 = useState('')

  const compute = useCallback(async () => {
    setLoading(true); setErr('')
    try {
      const [marks, stats] = await Promise.all([
        api('/marks/my').catch(() => ({ marks: [] })),
        api('/battle/me').catch(() => null),
      ])
      const memory = await (async () => {
        try {
          const { dumpState } = await import('../lib/twin')
          const state = dumpState()
          return {
            weak: state.mastery
              .filter(m => m.mastery < 0.45)
              .map(m => ({ subject: m.subject, topic: m.topic })),
          }
        } catch { return { weak: [] as any[] } }
      })()

      const bySubject: Record<string, { obtained: number; max: number; date: string }[]> = {}
      const memWeakBySubject: Record<string, number> = {}
      for (const m of marks?.marks || []) {
        const s = m.subject || 'General'
        if (!bySubject[s]) bySubject[s] = []
        bySubject[s].push({ obtained: parseFloat(m.marks_obtained) || 0, max: parseFloat(m.total_marks) || 1, date: m.created_at })
      }
      for (const s of Object.keys(bySubject)) {
        bySubject[s].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      }
      for (const w of memory?.weak || []) {
        const s = w.subject || 'General'
        memWeakBySubject[s] = (memWeakBySubject[s] || 0) + 1
      }

      const preds: SubjectPrediction[] = []
      for (const [subject, exams] of Object.entries(bySubject)) {
        if (exams.length === 0) continue
        const pcts = exams.map(e => e.max > 0 ? (e.obtained / e.max) * 100 : 0)
        const current = pcts.reduce((s, x) => s + x, 0) / pcts.length

        const recent = pcts.slice(-3).reduce((s, x) => s + x, 0) / Math.min(pcts.length, 3)
        const earlier = pcts.slice(0, 3).reduce((s, x) => s + x, 0) / Math.min(pcts.length, 3)
        const delta = recent - earlier

        let trajectory: 'up' | 'down' | 'flat' = 'flat'
        if (delta > 5) trajectory = 'up'
        else if (delta < -5) trajectory = 'down'

        const weakPenalty = (memWeakBySubject[subject] || 0) * 1.5
        const trendBoost  = trajectory === 'up' ? 4 : trajectory === 'down' ? -3 : 0
        let predicted = recent + trendBoost - weakPenalty
        predicted = Math.max(0, Math.min(100, predicted))

        const confidence: SubjectPrediction['confidence'] =
          exams.length >= 5 ? 'high' : exams.length >= 3 ? 'medium' : 'low'

        const risk: SubjectPrediction['risk'] =
          predicted < 50 ? 'high' : predicted < 70 ? 'medium' : 'low'

        preds.push({
          subject, current: Math.round(current), predicted: Math.round(predicted),
          trajectory, confidence, exams: exams.length,
          weak_count: memWeakBySubject[subject] || 0, risk,
        })
      }

      preds.sort((a, b) => {
        const riskOrder = { high: 0, medium: 1, low: 2 }
        if (riskOrder[a.risk] !== riskOrder[b.risk]) return riskOrder[a.risk] - riskOrder[b.risk]
        return a.predicted - b.predicted
      })

      setPredictions(preds)
    } catch (e: any) {
      setErr(e.message)
      setPredictions([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { compute() }, [compute])

  async function generateInsight() {
    if (!predictions?.length) return
    setInsightBusy(true)
    try {
      const summary = predictions.map(p =>
        `- ${p.subject}: current ${p.current}%, predicted ${p.predicted}%, trend ${p.trajectory}, weak topics ${p.weak_count}, risk ${p.risk}`
      ).join('\n')

      const reply = await chat({
        messages: [
          { role: 'system', content: `You are Kyno, an expert exam coach. Read the student's predicted performance and give a tight, actionable report.

## What I see
2-3 sentences interpreting the trajectory.

## Biggest opportunity
1 specific subject + topic where the smallest effort would yield the biggest score improvement. Be concrete.

## Biggest risk
1 specific subject that's most likely to drag the overall result. Why.

## Action plan (this week)
3-4 specific items, each tied to a Kyno feature (Revision Simulator, Adaptive Path, Kyno's Solver, Camera Study).

Keep it under 200 words. No fluff.` },
          { role: 'user', content: `My predicted performance:\n\n${summary}\n\nGive me your read.` },
        ],
      })
      setInsight(reply)
    } catch (e: any) { setErr(e.message) }
    finally { setInsightBusy(false) }
  }

  const overall = predictions?.length
    ? Math.round(predictions.reduce((s, p) => s + p.predicted, 0) / predictions.length)
    : 0
  const overallCurrent = predictions?.length
    ? Math.round(predictions.reduce((s, p) => s + p.current, 0) / predictions.length)
    : 0
  const overallDelta = overall - overallCurrent

  return (
    <div style={{ padding: '28px 36px', maxWidth: 1100, margin: '0 auto', height: '100%', overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 22 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 11,
          background: 'linear-gradient(135deg, #8FA0FA, #A5B4FC)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 18px rgba(143,160,250,0.35)', flexShrink: 0,
        }}>
          <TrendingUp size={22} color="#fff" />
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#fafafa', margin: 0 }}>Performance Predictor</h1>
          <p style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>
            Where your scores are heading · risk areas · improvement potential
          </p>
        </div>
        <button onClick={compute} disabled={loading} className="kyno-ghost" style={{
          padding: '9px 14px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <RefreshCw size={12} style={{ animation: loading ? 'spin 0.8s linear infinite' : 'none' }} />
          Refresh
        </button>
      </div>

      {err && (
        <div style={{ marginBottom: 16, padding: '10px 14px', background: 'rgba(165, 180, 252, 0.08)', border: '1px solid rgba(165, 180, 252, 0.25)', borderRadius: 8, fontSize: 12, color: '#A5B4FC' }}>
          {err}
        </div>
      )}

      {loading && !predictions && (
        <div style={{ textAlign: 'center', padding: '80px 0', color: '#6B7280' }}>Computing predictions…</div>
      )}

      {predictions && predictions.length === 0 && (
        <div style={{ ...card, padding: '60px 32px', textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, borderRadius: 15, margin: '0 auto 16px', background: 'rgba(124, 92, 255,0.10)', border: '1px solid rgba(124, 92, 255,0.28)', display: 'grid', placeItems: 'center' }}>
            <TrendingUp size={26} color="#7C5CFF" />
          </div>
          <h3 style={{ fontSize: 17, fontWeight: 800, color: '#fafafa', margin: 0, marginBottom: 8 }}>No exam history yet</h3>
          <p style={{ fontSize: 13, color: '#9CA3AF', maxWidth: 460, margin: '0 auto', lineHeight: 1.6 }}>
            Predictions need at least one mark per subject. Once teachers enter marks or you complete graded essays, this page will project your trajectory.
          </p>
        </div>
      )}

      {predictions && predictions.length > 0 && (
        <>
          <div style={{ ...card, padding: 26, marginBottom: 16, position: 'relative', overflow: 'hidden' }}>
            <div style={{
              position: 'absolute', top: -50, right: -50, width: 220, height: 220,
              borderRadius: '50%',
              background: overall >= 75 ? 'rgba(52,211,153,0.20)' : overall >= 60 ? 'rgba(255,176,32,0.20)' : 'rgba(255, 90, 110,0.20)',
              filter: 'blur(60px)',
            }} />
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 24 }}>
              <div style={{
                width: 110, height: 110, borderRadius: '50%',
                background: '#141A2A', border: `3px solid ${overall >= 75 ? '#34D399' : overall >= 60 ? '#FFB020' : '#FF5A6E'}`,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              }}>
                <div style={{
                  fontSize: 30, fontWeight: 800, lineHeight: 1,
                  color: overall >= 75 ? '#34D399' : overall >= 60 ? '#FFB020' : '#FF5A6E',
                }}>{overall}%</div>
                <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 4, textTransform: 'uppercase', letterSpacing: 1 }}>predicted</div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.5 }}>
                  Overall projection
                </div>
                <div style={{ fontSize: 28, fontWeight: 800, color: '#fafafa', marginTop: 4, lineHeight: 1 }}>
                  {overall >= 90 ? 'Outstanding' : overall >= 75 ? 'On track' : overall >= 60 ? 'Workable' : 'Needs work'}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, fontSize: 12, color: '#B1B5BA' }}>
                  <span>Current avg: <strong style={{ color: '#fafafa' }}>{overallCurrent}%</strong></span>
                  <span style={{
                    padding: '2px 8px', borderRadius: 4,
                    background: overallDelta > 0 ? 'rgba(165, 180, 252, 0.12)' : overallDelta < 0 ? 'rgba(165, 180, 252, 0.12)' : 'rgba(115,115,115,0.12)',
                    color: overallDelta > 0 ? '#A5B4FC' : overallDelta < 0 ? '#A5B4FC' : '#B1B5BA',
                    fontWeight: 700,
                  }}>
                    {overallDelta > 0 ? '+' : ''}{overallDelta} projected change
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div style={{ ...card, padding: 22, marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <Sparkles size={15} color="#A5B4FC" />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#fafafa' }}>AI Coach Read</div>
                <div style={{ fontSize: 11, color: '#6B7280' }}>What to do this week — biggest opportunity, biggest risk, action plan</div>
              </div>
              <button onClick={generateInsight} disabled={insightBusy}
                className="kyno-chunky"
                style={{
                  padding: '9px 16px', fontSize: 12,
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                <Sparkles size={12} />{insightBusy ? 'Reading…' : insight ? 'Regenerate' : 'Generate'}
              </button>
            </div>
            {insight && (
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                className="prose-ai"
                style={{
                  background: '#141A2A', border: '1px solid #1f2532',
                  borderRadius: 10, padding: 16, fontSize: 13, color: '#e4e4e7', lineHeight: 1.65,
                }}>
                <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{insight}</ReactMarkdown>
              </motion.div>
            )}
            {!insight && !insightBusy && (
              <p style={{ fontSize: 12, color: '#6B7280', fontStyle: 'italic', margin: 0 }}>
                Click Generate to get a personalized read on your trajectory.
              </p>
            )}
          </div>

          <div style={{ ...card, padding: 18 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#fafafa', marginBottom: 14 }}>
              Per-subject Projections
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {predictions.map(p => {
                const TrendIcon = p.trajectory === 'up' ? TrendingUp : p.trajectory === 'down' ? TrendingDown : Minus
                const trendColor = p.trajectory === 'up' ? '#A5B4FC' : p.trajectory === 'down' ? '#A5B4FC' : '#B1B5BA'
                const riskColor = p.risk === 'high' ? '#A5B4FC' : p.risk === 'medium' ? '#A5B4FC' : '#A5B4FC'
                return (
                  <div key={p.subject} style={{
                    padding: 14, borderRadius: 10, background: '#141A2A',
                    border: `1px solid ${riskColor}30`, borderLeft: `3px solid ${riskColor}`,
                    display: 'flex', alignItems: 'center', gap: 14,
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 13.5, fontWeight: 700, color: '#fafafa' }}>{p.subject}</span>
                        <span style={{ fontSize: 10, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 1 }}>
                          {p.exams} exam{p.exams === 1 ? '' : 's'} · confidence {p.confidence}
                        </span>
                      </div>
                      <div style={{ position: 'relative', height: 8, background: '#171D2D', borderRadius: 4, overflow: 'hidden' }}>
                        <motion.div
                          initial={{ width: 0 }} animate={{ width: `${p.predicted}%` }}
                          transition={{ duration: 0.7, ease: 'easeOut' }}
                          style={{ height: '100%', background: riskColor }} />
                        <div style={{
                          position: 'absolute', top: -2, bottom: -2, left: `${p.current}%`,
                          width: 2, background: '#fafafa',
                        }} />
                      </div>
                      <div style={{ display: 'flex', gap: 12, marginTop: 6, fontSize: 10.5, color: '#9CA3AF' }}>
                        <span>Current <strong style={{ color: '#fafafa' }}>{p.current}%</strong></span>
                        <span>·</span>
                        <span>Predicted <strong style={{ color: riskColor }}>{p.predicted}%</strong></span>
                        {p.weak_count > 0 && (
                          <span style={{ marginLeft: 'auto', color: '#A5B4FC' }}>{p.weak_count} weak topic{p.weak_count === 1 ? '' : 's'}</span>
                        )}
                      </div>
                    </div>
                    <div style={{
                      width: 36, height: 36, borderRadius: 9, background: `${trendColor}18`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      <TrendIcon size={16} color={trendColor} />
                    </div>
                  </div>
                )
              })}
            </div>
            <p style={{ fontSize: 10.5, color: '#4B5563', marginTop: 10, textAlign: 'center' }}>
              White line = current avg · colored bar = projected at exam · color = risk level
            </p>
          </div>
        </>
      )}
    </div>
  )
}
