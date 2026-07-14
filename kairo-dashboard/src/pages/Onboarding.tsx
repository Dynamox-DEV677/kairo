import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight, ArrowLeft, Check, Sparkles, GraduationCap, BookOpen, Repeat, Eye } from 'lucide-react'
import { saveProfile, type KynoProfile } from '../lib/twin'
import type { AuthProfile } from './Login'

interface Props { profile: AuthProfile; onDone: () => void; onSkip: () => void }

const A = { bg: '#050505', card: '#0E1117', border: '#1f2532', accent: '#4F7CFF', cyan: '#66D9FF', text: '#fafafa', mut: '#9CA3AF' }
const FONT = "'Inter', system-ui, sans-serif"

const BOARDS = ['CBSE', 'ICSE', 'State Board', 'IB', 'IGCSE', 'Other']
const TIMES = ['Morning', 'Afternoon', 'Evening', 'Late night']
const SUBJECTS = ['Maths', 'Physics', 'Chemistry', 'Biology', 'English', 'Social', 'Computer', 'Hindi', 'Economics', 'Other']
const GOALS = ['Score 90%+ in boards', 'Top my class', 'Crack JEE', 'Crack NEET', 'Build strong basics', 'Just learn better']
const HOBBIES = ['Cricket', 'Football', 'Gaming', 'Music', 'Drawing', 'Coding', 'Reading', 'Dancing', 'Movies', 'Space', 'Chess', 'Cooking', 'Anime', 'Photography']
const HOURS = ['Under 1 hr', '1–2 hrs', '2–4 hrs', '4+ hrs']
const STYLES = [
  { id: 'visual', label: 'Watching', desc: 'Videos & visuals', icon: Eye },
  { id: 'reading', label: 'Reading', desc: 'Notes & text', icon: BookOpen },
  { id: 'practice', label: 'Practising', desc: 'Solving & doing', icon: Sparkles },
  { id: 'repeat', label: 'Repetition', desc: 'Flashcards & recall', icon: Repeat },
]

const STEPS = ['You', 'School', 'How you learn', 'Subjects & goal', 'You beyond books']

export default function Onboarding({ profile, onDone, onSkip }: Props) {
  const [step, setStep] = useState(0)
  const [nickname, setNickname] = useState('')
  const [mode, setMode] = useState<'personal' | 'school'>(profile.school_id ? 'school' : 'personal')
  const [school, setSchool] = useState(profile.school_name || '')
  const [cls, setCls] = useState(profile.cls || '')
  const [section, setSection] = useState('')
  const [board, setBoard] = useState(profile.board || '')
  const [studyStyles, setStudyStyles] = useState<string[]>([])
  const [bestTime, setBestTime] = useState('')
  const [goal, setGoal] = useState('')
  const [strong, setStrong] = useState<string[]>([])
  const [weak, setWeak] = useState<string[]>([])
  const [hobbies, setHobbies] = useState<string[]>([])
  const [dailyHours, setDailyHours] = useState('')

  const toggle = (arr: string[], set: (v: string[]) => void, v: string) =>
    set(arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v])

  function finish() {
    const p: KynoProfile = {
      name: profile.name, nickname: nickname.trim() || undefined, mode,
      school: mode === 'school' ? (school.trim() || undefined) : undefined,
      cls: cls.trim() || undefined, section: section.trim() || undefined, board: board || undefined,
      studyStyles, bestTime: bestTime || undefined, goal: goal || undefined,
      strong, weak, hobbies, dailyHours: dailyHours || undefined,
    }
    saveProfile(p)
    onDone()
  }

  const last = STEPS.length - 1
  const pct = ((step + 1) / STEPS.length) * 100

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 99998, background: A.bg, color: A.text,
      fontFamily: FONT, display: 'flex', flexDirection: 'column', alignItems: 'center',
      overflowY: 'auto', WebkitOverflowScrolling: 'touch',
      paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)',
    }}>
      <div style={{
        position: 'absolute', top: '-10%', left: '50%', transform: 'translateX(-50%)',
        width: 'min(560px,100vw)', height: 'min(560px,100vw)', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(79,124,255,0.12), transparent 70%)', pointerEvents: 'none',
      }} />

      <div style={{ width: '100%', maxWidth: 540, padding: '26px 20px 40px', position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src="/kyno-logo.png" alt="" style={{ width: 34, height: 34, objectFit: 'contain', filter: 'drop-shadow(0 0 12px rgba(102,217,255,0.4))' }} />
            <span style={{ fontWeight: 800, letterSpacing: -0.3 }}>Set up your Kyno</span>
          </div>
          <button onClick={onSkip} style={{ background: 'none', border: 'none', color: A.mut, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: FONT }}>Skip for now</button>
        </div>

        <div style={{ height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 999, overflow: 'hidden', marginBottom: 6 }}>
          <motion.div animate={{ width: `${pct}%` }} transition={{ ease: [0.2, 0.8, 0.2, 1], duration: 0.4 }}
            style={{ height: '100%', background: `linear-gradient(90deg, ${A.cyan}, ${A.accent})` }} />
        </div>
        <div style={{ fontSize: 11, color: A.mut, fontWeight: 600, letterSpacing: 1, marginBottom: 22 }}>
          STEP {step + 1} / {STEPS.length} · {STEPS[step].toUpperCase()}
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.28 }}>
            {step === 0 && (
              <Section title={`Hey${profile.name ? ' ' + profile.name.split(' ')[0] : ''}! 👋`} sub="What should Kyno call you?">
                <Field label="Nickname">
                  <input value={nickname} onChange={e => setNickname(e.target.value)} placeholder={profile.name?.split(' ')[0] || 'Your nickname'} style={inputSt} />
                </Field>
              </Section>
            )}

            {step === 1 && (
              <Section title="Your studies" sub="So Kyno matches your syllabus.">
                <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
                  {(['personal', 'school'] as const).map(m => (
                    <button key={m} onClick={() => setMode(m)} style={pillBtn(mode === m)}>
                      {m === 'personal' ? 'Just me' : 'My school'}
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <Field label="Class / grade"><input value={cls} onChange={e => setCls(e.target.value)} placeholder="e.g. 9" style={inputSt} /></Field>
                  {mode === 'school' && <Field label="Section"><input value={section} onChange={e => setSection(e.target.value)} placeholder="e.g. B" style={inputSt} /></Field>}
                </div>
                {mode === 'school' && (
                  <Field label="School name"><input value={school} onChange={e => setSchool(e.target.value)} placeholder="Your school" style={inputSt} /></Field>
                )}
                <Field label="Board">
                  <div style={chipWrap}>{BOARDS.map(b => <Chip key={b} on={board === b} onClick={() => setBoard(board === b ? '' : b)}>{b}</Chip>)}</div>
                </Field>
              </Section>
            )}

            {step === 2 && (
              <Section title="How do you learn best?" sub="Pick any that feel like you — Kyno adapts to this.">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {STYLES.map(s => {
                    const on = studyStyles.includes(s.id)
                    return (
                      <button key={s.id} onClick={() => toggle(studyStyles, setStudyStyles, s.id)} style={styleCard(on)}>
                        <s.icon size={22} color={on ? A.cyan : A.mut} />
                        <div style={{ fontWeight: 700, marginTop: 8 }}>{s.label}</div>
                        <div style={{ fontSize: 12, color: A.mut }}>{s.desc}</div>
                      </button>
                    )
                  })}
                </div>
                <Field label="When do you focus best?">
                  <div style={chipWrap}>{TIMES.map(t => <Chip key={t} on={bestTime === t} onClick={() => setBestTime(bestTime === t ? '' : t)}>{t}</Chip>)}</div>
                </Field>
              </Section>
            )}

            {step === 3 && (
              <Section title="Subjects & your goal" sub="Kyno focuses where it matters most.">
                <Field label="Strongest subjects"><div style={chipWrap}>{SUBJECTS.map(s => <Chip key={s} on={strong.includes(s)} onClick={() => toggle(strong, setStrong, s)}>{s}</Chip>)}</div></Field>
                <Field label="Subjects you struggle with"><div style={chipWrap}>{SUBJECTS.map(s => <Chip key={s} on={weak.includes(s)} onClick={() => toggle(weak, setWeak, s)} tone="warn">{s}</Chip>)}</div></Field>
                <Field label="Your main goal"><div style={chipWrap}>{GOALS.map(g => <Chip key={g} on={goal === g} onClick={() => setGoal(goal === g ? '' : g)}>{g}</Chip>)}</div></Field>
              </Section>
            )}

            {step === 4 && (
              <Section title="You, beyond books" sub="So Kyno explains things using stuff you love.">
                <Field label="Your hobbies & interests"><div style={chipWrap}>{HOBBIES.map(h => <Chip key={h} on={hobbies.includes(h)} onClick={() => toggle(hobbies, setHobbies, h)}>{h}</Chip>)}</div></Field>
                <Field label="How long do you study daily?"><div style={chipWrap}>{HOURS.map(h => <Chip key={h} on={dailyHours === h} onClick={() => setDailyHours(dailyHours === h ? '' : h)}>{h}</Chip>)}</div></Field>
              </Section>
            )}
          </motion.div>
        </AnimatePresence>

        <div style={{ display: 'flex', gap: 12, marginTop: 30 }}>
          {step > 0 && (
            <button onClick={() => setStep(step - 1)} style={{ ...navBtn, background: 'transparent', border: `1px solid ${A.border}`, color: A.text, flex: '0 0 auto', padding: '14px 20px' }}>
              <ArrowLeft size={16} />
            </button>
          )}
          <button onClick={() => (step === last ? finish() : setStep(step + 1))} style={{ ...navBtn, flex: 1 }}>
            {step === last ? <>Finish setup <Check size={17} /></> : <>Continue <ArrowRight size={17} /></>}
          </button>
        </div>
      </div>
    </div>
  )
}

function Section({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 style={{ fontSize: 24, fontWeight: 800, margin: 0, letterSpacing: -0.6 }}>{title}</h2>
      <p style={{ fontSize: 14, color: A.mut, margin: '6px 0 22px' }}>{sub}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>{children}</div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: A.mut, letterSpacing: 0.5, marginBottom: 8, textTransform: 'uppercase' }}>{label}</div>
      {children}
    </div>
  )
}

function Chip({ on, onClick, children, tone }: { on: boolean; onClick: () => void; children: React.ReactNode; tone?: 'warn' }) {
  const c = tone === 'warn' ? '#ffb454' : A.accent
  return (
    <button onClick={onClick} style={{
      padding: '9px 15px', borderRadius: 999, cursor: 'pointer', fontFamily: FONT, fontSize: 14, fontWeight: 600,
      background: on ? `${c}22` : '#151a24', color: on ? '#fff' : A.mut,
      border: `1px solid ${on ? c : A.border}`, transition: 'all 0.15s',
    }}>{children}</button>
  )
}

const inputSt: React.CSSProperties = {
  width: '100%', padding: '13px 15px', borderRadius: 12, background: '#151a24',
  border: `1px solid ${A.border}`, color: A.text, fontFamily: FONT, fontSize: 15, outline: 'none', boxSizing: 'border-box',
}
const chipWrap: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 8 }
const navBtn: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
  padding: '15px 20px', borderRadius: 13, border: 'none', cursor: 'pointer',
  background: `linear-gradient(135deg, ${A.accent}, #3a63e0)`, color: '#fff', fontFamily: FONT, fontSize: 15, fontWeight: 700,
}
const pillBtn = (on: boolean): React.CSSProperties => ({
  flex: 1, padding: '13px', borderRadius: 12, cursor: 'pointer', fontFamily: FONT, fontSize: 15, fontWeight: 700,
  background: on ? 'rgba(79,124,255,0.16)' : '#151a24', color: on ? '#fff' : A.mut,
  border: `1px solid ${on ? A.accent : A.border}`,
})
const styleCard = (on: boolean): React.CSSProperties => ({
  padding: '18px 16px', borderRadius: 16, cursor: 'pointer', textAlign: 'left', fontFamily: FONT, color: A.text,
  background: on ? 'rgba(79,124,255,0.12)' : A.card, border: `1px solid ${on ? A.accent : A.border}`, transition: 'all 0.15s',
})
