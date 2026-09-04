/**
 * Local preview for Plan — dev only.
 *
 * Seeds a Class 10 CBSE profile with an exam in 12 days, nine days of study
 * history (so the pace model has enough to project), and a little chapter
 * progress; stubs the one AI call. Vite only builds index.html.
 *
 * Open http://localhost:3002/plan-preview.html
 */
import { createRoot } from 'react-dom/client'
import Plan from './pages/Plan'
import { PreviewFrame } from './preview-shared'
import { saveProfile, track, getDashboard } from './lib/twin'
import { setJSON } from './lib/storage'

const DAY = 86_400_000
const NOW = Date.now()

try {
  if (!localStorage.getItem('kyno:plan-preview-seeded')) {
    saveProfile({ name: 'Preview', cls: '10', board: 'CBSE', mode: 'personal' } as any)
    const exam = new Date(NOW + 12 * DAY).toISOString().slice(0, 10)
    setJSON('kyno:student_profile', { examDates: [{ name: 'Half-yearly', date: exam }] })

    // nine days of real-looking focus sessions, 15-25 minutes, one gap
    const hist = [1, 2, 3, 5, 6, 7, 8, 9, 10].map((d, i) => ({ ts: NOW - d * DAY - 3 * 3600_000, focusedMs: (15 + (i * 7) % 11) * 60_000, plannedMs: 25 * 60_000, drifts: i % 3 === 0 ? 1 : 0 }))
    localStorage.setItem('kyno:focus:history', JSON.stringify(hist))

    // some chapter progress so the map is not all untouched
    const ok = (subject: string, topic: string, n: number, correct = true) => {
      for (let i = 0; i < n; i++) track({ type: 'quiz_answered', subject, topic, correct, score: correct ? 100 : 0, modality: 'interactive', durationMs: 30_000, difficulty: 0.5, payload: { q: `${topic} ${i}` } } as any)
    }
    ok('Mathematics', 'quadratic formula', 6)          // Quadratic Equations -> practised
    ok('Mathematics', 'nth term of an ap', 8)           // Arithmetic Progressions -> solid-ish
    ok('Mathematics', 'sum of n terms', 6)
    ok('Science', "ohm's law", 3, false)                // Electricity -> practised, weak
    ok('Science', 'nutrition', 5)
    getDashboard() // recompute mastery
    localStorage.setItem('kyno:plan-preview-seeded', '1')
  }
} catch (e) { console.warn('seed failed', e) }

const real = window.fetch.bind(window)
window.fetch = ((url: any, init?: any) => {
  const u = String(url)
  if (u.includes('/api/plan/topic')) {
    let body: any = {}
    try { body = JSON.parse(String(init?.body || '{}')) } catch { /* ignore */ }
    const wording: Record<string, [string, string]> = {
      LEARN: ['The three definitions plus V = IR, and what resistance actually is.', 'Everything else in the chapter sits on top of these.'],
      PRACTISE: ['Ten circuit questions: series, parallel, then two mixed.', 'Knowing the formula and using it under time are different skills.'],
      TEST: ['One 5-mark numerical on a mixed circuit, on paper, photographed.', 'Find out now, not in the exam.'],
    }
    const sessions = (body.sessions || []).map((s: any) => ({ ...s, what: wording[s.kind]?.[0] || s.what, why: wording[s.kind]?.[1] || s.why }))
    return new Promise<Response>(res => setTimeout(() => res(new Response(JSON.stringify({ sessions, generated: true }), { status: 200, headers: { 'Content-Type': 'application/json' } })), 800))
  }
  return real(url, init)
}) as typeof window.fetch

createRoot(document.getElementById('root')!).render(
  <PreviewFrame active="plan">
    <Plan
      onOpenDoubt={seed => alert('Opens Doubt Solving with:\n\n' + seed)}
      onPractice={f => alert('Opens Practice filtered to:\n\n' + JSON.stringify(f))}
    />
  </PreviewFrame>,
)
