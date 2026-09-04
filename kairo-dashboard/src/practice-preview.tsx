/**
 * Local preview for Practice — dev only.
 *
 * Mounts the page on its own, past the login wall, with every network call
 * stubbed and enough local data seeded that all six screens have something to
 * show. Canned answers, real component.
 *
 * Vite only builds index.html, so this never reaches production.
 * Open http://localhost:3002/practice-preview.html
 */
import { createRoot } from 'react-dom/client'
import Practice from './pages/Practice'
import { recordFlashcard, recordMistake } from './lib/twin'
import { setJSON } from './lib/storage'

/* ── seed: due cards, a weak topic, an exam in 12 days ── */
try {
  const have = (JSON.parse(localStorage.getItem('kyno:practice-preview-seeded') || 'null'))
  if (!have) {
    const cards = [
      ['What is the SI unit of acceleration?', 'm/s²', 'vectors'],
      ['Define a scalar quantity.', 'A quantity with magnitude only', 'vectors'],
      ['First equation of motion?', 'v = u + at', 'motion under gravity'],
      ['g on Earth (approx)?', '9.8 m/s²', 'motion under gravity'],
      ['Resultant of two perpendicular vectors 3 and 4?', '5 (Pythagoras)', 'vectors'],
      ['What does a negative acceleration mean?', 'Velocity decreasing in the +ve direction', 'vectors'],
      ['Second equation of motion?', 's = ut + ½at²', 'motion under gravity'],
      ['Unit vector along x?', 'î', 'vectors'],
    ]
    for (const [f, b, t] of cards) recordFlashcard({ front: f, back: b, subject: 'Physics', topic: t, source: 'manual' })
    for (let i = 0; i < 3; i++) recordMistake({ topic: 'vectors', subject: 'Physics', detail: 'dropped the direction' })
    recordMistake({ topic: 'periodic table', subject: 'Chemistry' })
    recordMistake({ topic: 'periodic table', subject: 'Chemistry' })
    const d = new Date(Date.now() + 12 * 86400000)
    setJSON('kyno:student_profile', { examDates: [{ name: 'Half-yearly', date: d.toISOString().slice(0, 10) }] })
    localStorage.setItem('kyno:practice-preview-seeded', '1')
  }
} catch (e) { console.warn('seed failed', e) }

/* ── stubs ── */
const json = (b: unknown, ms = 600) =>
  new Promise<Response>(res => setTimeout(() => res(new Response(JSON.stringify(b), { status: 200, headers: { 'Content-Type': 'application/json' } })), ms))

const QUESTIONS = Array.from({ length: 8 }, (_, i) => ({
  id: i + 1,
  question: [
    'A body moves 3 m east then 4 m north. The magnitude of its displacement is:',
    'Which of these is a vector quantity?',
    'Two forces of 6 N and 8 N act at right angles. The resultant is:',
    'The dot product of two perpendicular vectors is:',
    'A vector of magnitude 10 makes 60° with the x-axis. Its x-component is:',
    'Which operation gives a vector perpendicular to both inputs?',
    'Displacement divided by time gives:',
    'Adding a vector to its negative gives:',
  ][i],
  options: [
    ['A. 5 m', 'B. 7 m', 'C. 1 m', 'D. 12 m'],
    ['A. Speed', 'B. Mass', 'C. Velocity', 'D. Temperature'],
    ['A. 14 N', 'B. 2 N', 'C. 10 N', 'D. 48 N'],
    ['A. 1', 'B. 0', 'C. −1', 'D. Undefined'],
    ['A. 5', 'B. 8.66', 'C. 10', 'D. 0'],
    ['A. Dot product', 'B. Cross product', 'C. Scalar multiplication', 'D. Addition'],
    ['A. Speed', 'B. Acceleration', 'C. Velocity', 'D. Distance'],
    ['A. Twice the vector', 'B. The zero vector', 'C. A unit vector', 'D. Its magnitude'],
  ][i],
  correct: ['A', 'C', 'C', 'B', 'A', 'B', 'C', 'B'][i],
  explanation: 'Draw it. Perpendicular components combine with Pythagoras; parallel ones add directly.',
  difficulty: 'medium',
  topic: 'vectors',
}))

const real = window.fetch.bind(window)
window.fetch = ((url: any, init?: any) => {
  const u = String(url)
  if (u.includes('/api/quiz/start')) return json({ session_id: 'local', total: QUESTIONS.length, first_question: QUESTIONS[0], questions: QUESTIONS }, 900)
  if (u.includes('/api/camera/analyze')) return json({
    mode: 'transcribe', provider: 'stub', readable: true, confidence: 91,
    text: 'u = 0, a = 9.8, s = 20\n20 = 0.5 × 9.8 × t²\nt² = 4.08\nt = 2.02',
  }, 1100)
  if (u.includes('/api/practice/grade')) return json({
    total: 5, awarded: 4, verdict: 'You lost a mark on presentation',
    steps: [
      { line: null, type: 'method', marks: 1, awarded: 0, title: 'You skipped the formula line', reason: 'Write s = ut + ½gt² before substituting. CBSE gives a mark for stating it — even if the rest is wrong.' },
      { line: 2, type: 'substitution', marks: 2, awarded: 2, title: 'Substitution correct', reason: 'Every value in the right place, u = 0 handled cleanly.' },
      { line: 4, type: 'answer', marks: 1, awarded: 1, title: 'Final answer correct', reason: '2.02 s to two decimals — exactly what the marking scheme wants.' },
      { line: 4, type: 'units', marks: 1, awarded: 1, title: 'Units carried through', reason: 'You wrote s on the answer. Most students drop it.' },
    ],
  }, 1400)
  if (u.includes('/api/practice/teachback')) return json({
    score: 72, verdict: 'You named the mechanism — that is the hard part.',
    gotRight: ['"more mass means more force but also more resistance" — that is exactly the cancelling'],
    missed: [{ point: 'Why the ratio is constant', reasoning: 'Force from gravity is proportional to mass, and acceleration is force divided by mass. The mass appears on both sides and divides out — so every object gets the same 9.8.' }],
  }, 1200)
  return real(url, init)
}) as typeof window.fetch

createRoot(document.getElementById('root')!).render(
  <Practice onOpenDoubt={seed => alert('Opens Doubt Solving with this as the question:\n\n' + seed)} />,
)
