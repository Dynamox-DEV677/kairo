import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BookOpen, Brain, BarChart3, ChevronRight, ChevronLeft,
  Lightbulb, Target, TrendingUp, Hash, Layers, Loader,
} from 'lucide-react'
import { chat } from '../lib/openrouter'

type Tab = 'summary' | 'concepts' | 'progress'

const MOCK_SUBJECTS = [
  { name: 'Physics', progress: 72, color: '#A5B4FC' },
  { name: 'Chemistry', progress: 55, color: '#34d399' },
  { name: 'Mathematics', progress: 88, color: '#C7D2E8' },
  { name: 'Biology', progress: 41, color: '#f472b6' },
  { name: 'History', progress: 63, color: '#4F7CFF' },
]

const INSIGHT_SYSTEM = `You analyze student questions and return educational insights as JSON.
Return ONLY valid JSON, no markdown, no explanation:
{
  "keyPoints": ["concise point 1", "concise point 2", "concise point 3"],
  "examProbability": 75,
  "examContext": "Very likely in CBSE Class 10 Science",
  "difficulty": 3,
  "difficultyLabel": "Medium · Class 10 level",
  "relatedTopics": ["Topic1", "Topic2", "Topic3", "Topic4", "Topic5"],
  "concepts": [
    {"name": "Concept Name", "strength": 70},
    {"name": "Concept Name", "strength": 55},
    {"name": "Concept Name", "strength": 40},
    {"name": "Concept Name", "strength": 25}
  ]
}
examProbability is 0-100. difficulty is 1-5. Base everything on the student's actual question.`

const CONCEPT_COLORS = ['#A5B4FC', '#34d399', '#C7D2E8', '#f472b6']

interface InsightPanelProps {
  hasContent: boolean
  lastQuestion?: string
}

export default function InsightPanel({ hasContent, lastQuestion }: InsightPanelProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [tab, setTab] = useState<Tab>('summary')
  const [insights, setInsights] = useState<any>(null)
  const [loadingInsights, setLoadingInsights] = useState(false)

  useEffect(() => {
    if (!lastQuestion) return
    setLoadingInsights(true)
    setInsights(null)
    chat({
      messages: [
        { role: 'system', content: INSIGHT_SYSTEM },
        { role: 'user', content: `Student question: "${lastQuestion}"` }
      ]
    }).then(r => {
      try {
        const cleaned = r.replace(/```json|```/g, '').trim()
        setInsights(JSON.parse(cleaned))
      } catch { /* keep null */ }
    }).finally(() => setLoadingInsights(false))
  }, [lastQuestion])

  const keyPoints = insights?.keyPoints ?? []
  const examProbability = insights?.examProbability ?? 0
  const examContext = insights?.examContext ?? ''
  const difficultyLevel = insights?.difficulty ?? 0
  const difficultyLabel = insights?.difficultyLabel ?? ''
  const relatedTopics = insights?.relatedTopics ?? []
  const concepts = (insights?.concepts ?? []).map((c: any, i: number) => ({
    ...c, color: CONCEPT_COLORS[i % CONCEPT_COLORS.length]
  }))

  const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'summary', label: 'Summary', icon: BookOpen },
    { id: 'concepts', label: 'Concepts', icon: Brain },
    { id: 'progress', label: 'Progress', icon: BarChart3 },
  ]

  return (
    <motion.div
      animate={{ width: collapsed ? 40 : 280 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      style={{
        flexShrink: 0,
        height: '100%',
        background: '#0E1117',
        borderLeft: '1px solid #1a1f2e',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(c => !c)}
        style={{
          position: 'absolute', top: 12,
          left: collapsed ? 4 : undefined,
          right: collapsed ? undefined : 10,
          width: 24, height: 24, borderRadius: 6,
          background: '#151922', border: '1px solid #1f2532',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', zIndex: 10, color: '#6B7280',
          transition: 'all 0.15s',
          flexShrink: 0,
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#fafafa' }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#6B7280' }}
      >
        {collapsed ? <ChevronLeft size={13} /> : <ChevronRight size={13} />}
      </button>

      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}
          >
            {/* Header */}
            <div style={{ padding: '12px 14px 0', paddingRight: 40 }}>
              <h3 style={{ fontSize: 12, fontWeight: 700, color: '#fafafa', marginBottom: 12 }}>
                Insight Panel
              </h3>

              {/* Tabs */}
              <div style={{ display: 'flex', gap: 2, background: '#0E1117', borderRadius: 8, padding: 3, border: '1px solid #1f2532' }}>
                {TABS.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    style={{
                      flex: 1, padding: '5px 4px', borderRadius: 6, border: 'none',
                      background: tab === t.id ? '#1a1f2e' : 'none',
                      cursor: 'pointer', fontFamily: 'inherit',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                      fontSize: 10, fontWeight: 600,
                      color: tab === t.id ? '#fafafa' : '#6B7280',
                      transition: 'all 0.12s',
                    }}
                  >
                    <t.icon size={10} />
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '14px' }}>
              <AnimatePresence mode="wait">
                {tab === 'summary' && (
                  <motion.div
                    key="summary"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.15 }}
                  >
                    {loadingInsights ? (
                      <div style={{ textAlign: 'center', paddingTop: 40 }}>
                        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }} style={{ display: 'inline-block', marginBottom: 12 }}>
                          <Loader size={20} color="#4F7CFF" />
                        </motion.div>
                        <p style={{ fontSize: 11, color: '#6B7280' }}>Analysing your question…</p>
                      </div>
                    ) : hasContent && insights ? (
                      <>
                        {keyPoints.length > 0 && (
                          <SmallCard>
                            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                              <Lightbulb size={13} color="#C7D2E8" />
                              <span style={{ fontSize: 11, fontWeight: 600, color: '#B1B5BA' }}>Key Points</span>
                            </div>
                            {keyPoints.map((pt: string, i: number) => (
                              <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 5, alignItems: 'flex-start' }}>
                                <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#4F7CFF', marginTop: 5, flexShrink: 0 }} />
                                <span style={{ fontSize: 11, color: '#9CA3AF', lineHeight: 1.5 }}>{pt}</span>
                              </div>
                            ))}
                          </SmallCard>
                        )}

                        {examProbability > 0 && (
                          <SmallCard style={{ marginTop: 10 }}>
                            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                              <Target size={13} color="#f472b6" />
                              <span style={{ fontSize: 11, fontWeight: 600, color: '#B1B5BA' }}>Exam Probability</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                              <div style={{ flex: 1, height: 5, background: '#1a1f2e', borderRadius: 3, overflow: 'hidden' }}>
                                <motion.div
                                  key={examProbability}
                                  initial={{ width: 0 }}
                                  animate={{ width: `${examProbability}%` }}
                                  transition={{ delay: 0.1, duration: 0.6 }}
                                  style={{ height: '100%', background: 'linear-gradient(90deg, #4F7CFF, #ec4899)', borderRadius: 3 }}
                                />
                              </div>
                              <span style={{ fontSize: 12, fontWeight: 700, color: '#f472b6' }}>{examProbability}%</span>
                            </div>
                            <p style={{ fontSize: 10, color: '#6B7280' }}>{examContext}</p>
                          </SmallCard>
                        )}

                        {difficultyLevel > 0 && (
                          <SmallCard style={{ marginTop: 10 }}>
                            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                              <Layers size={13} color="#34d399" />
                              <span style={{ fontSize: 11, fontWeight: 600, color: '#B1B5BA' }}>Difficulty</span>
                            </div>
                            <div style={{ display: 'flex', gap: 4 }}>
                              {[1,2,3,4,5].map(n => (
                                <div key={n} style={{
                                  flex: 1, height: 6, borderRadius: 3,
                                  background: n <= difficultyLevel ? '#C7D2E8' : '#1a1f2e',
                                }} />
                              ))}
                            </div>
                            <p style={{ fontSize: 10, color: '#6B7280', marginTop: 6 }}>{difficultyLabel}</p>
                          </SmallCard>
                        )}

                        {relatedTopics.length > 0 && (
                          <SmallCard style={{ marginTop: 10 }}>
                            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                              <Hash size={13} color="#A5B4FC" />
                              <span style={{ fontSize: 11, fontWeight: 600, color: '#B1B5BA' }}>Related Topics</span>
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                              {relatedTopics.map((tag: string) => (
                                <span key={tag} style={{
                                  fontSize: 10, padding: '3px 8px', borderRadius: 20,
                                  background: '#151922', border: '1px solid #1f2532',
                                  color: '#9CA3AF', cursor: 'pointer', transition: 'all 0.1s',
                                }}
                                  onMouseEnter={e => { (e.currentTarget as HTMLSpanElement).style.borderColor = '#4F7CFF'; (e.currentTarget as HTMLSpanElement).style.color = '#A5B4FC' }}
                                  onMouseLeave={e => { (e.currentTarget as HTMLSpanElement).style.borderColor = '#1f2532'; (e.currentTarget as HTMLSpanElement).style.color = '#9CA3AF' }}
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </SmallCard>
                        )}
                      </>
                    ) : (
                      <EmptyState icon={Lightbulb} text="Ask a question to see insights here" />
                    )}
                  </motion.div>
                )}

                {tab === 'concepts' && (
                  <motion.div
                    key="concepts"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.15 }}
                  >
                    <p style={{ fontSize: 11, color: '#6B7280', marginBottom: 12 }}>Concept strength from your sessions</p>
                    {concepts.length > 0 ? concepts.map((c: any, i: number) => (
                      <div key={i} style={{ marginBottom: 14 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                          <span style={{ fontSize: 12, color: '#B1B5BA' }}>{c.name}</span>
                          <span style={{ fontSize: 11, fontWeight: 700, color: c.color }}>{c.strength}%</span>
                        </div>
                        <div style={{ height: 4, background: '#1a1f2e', borderRadius: 3, overflow: 'hidden' }}>
                          <motion.div
                            key={`${c.name}-${c.strength}`}
                            initial={{ width: 0 }}
                            animate={{ width: `${c.strength}%` }}
                            transition={{ delay: i * 0.1 + 0.2, duration: 0.5 }}
                            style={{ height: '100%', background: c.color, borderRadius: 3, boxShadow: `0 0 6px ${c.color}60` }}
                          />
                        </div>
                      </div>
                    )) : (
                      <EmptyState icon={Brain} text="Ask a question to see concept analysis" />
                    )}

                    <SmallCard style={{ marginTop: 6 }}>
                      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                        <TrendingUp size={13} color="#34d399" />
                        <span style={{ fontSize: 11, fontWeight: 600, color: '#B1B5BA' }}>XP Earned Today</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                        <span style={{ fontSize: 24, fontWeight: 800, color: '#fafafa' }}>+85</span>
                        <span style={{ fontSize: 12, color: '#34d399', fontWeight: 600 }}>XP</span>
                      </div>
                      <p style={{ fontSize: 10, color: '#6B7280', marginTop: 2 }}>Keep going to unlock "Physics Pro" 🏆</p>
                    </SmallCard>
                  </motion.div>
                )}

                {tab === 'progress' && (
                  <motion.div
                    key="progress"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.15 }}
                  >
                    <p style={{ fontSize: 11, color: '#6B7280', marginBottom: 12 }}>Subject-wise board prep</p>
                    {MOCK_SUBJECTS.map((s, i) => (
                      <div key={i} style={{ marginBottom: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: 12, color: '#B1B5BA' }}>{s.name}</span>
                          <span style={{ fontSize: 11, fontWeight: 700, color: s.color }}>{s.progress}%</span>
                        </div>
                        <div style={{ height: 5, background: '#1a1f2e', borderRadius: 3, overflow: 'hidden' }}>
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${s.progress}%` }}
                            transition={{ delay: i * 0.08 + 0.2, duration: 0.5 }}
                            style={{ height: '100%', background: `linear-gradient(90deg, ${s.color}aa, ${s.color})`, borderRadius: 3 }}
                          />
                        </div>
                      </div>
                    ))}

                    {/* Badges */}
                    <SmallCard style={{ marginTop: 6 }}>
                      <p style={{ fontSize: 11, fontWeight: 600, color: '#B1B5BA', marginBottom: 10 }}>Achievements</p>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {[
                          { emoji: '🔥', label: '5-day streak', unlocked: true },
                          { emoji: '📐', label: 'Math Wizard', unlocked: true },
                          { emoji: '🧬', label: 'Bio Master', unlocked: false },
                          { emoji: '⚡', label: 'Speed Learner', unlocked: false },
                        ].map((b, i) => (
                          <div key={i} title={b.label} style={{
                            width: 36, height: 36, borderRadius: 9,
                            background: b.unlocked ? '#1a1f2e' : '#0E1117',
                            border: `1px solid ${b.unlocked ? '#2d2d3d' : '#1a1f2e'}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 17, opacity: b.unlocked ? 1 : 0.3,
                            cursor: 'pointer',
                          }}>
                            {b.emoji}
                          </div>
                        ))}
                      </div>
                    </SmallCard>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function SmallCard({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: '#0E1117', border: '1px solid #1f2532',
      borderRadius: 10, padding: '12px 12px', ...style,
    }}>
      {children}
    </div>
  )
}

function EmptyState({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <div style={{ textAlign: 'center', paddingTop: 40 }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10, background: '#151922',
        border: '1px solid #1f2532', display: 'flex', alignItems: 'center',
        justifyContent: 'center', margin: '0 auto 10px',
      }}>
        <Icon size={16} color="#4B5563" />
      </div>
      <p style={{ fontSize: 11, color: '#4B5563', lineHeight: 1.6 }}>{text}</p>
    </div>
  )
}
