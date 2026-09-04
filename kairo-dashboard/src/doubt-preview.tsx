/**
 * Local preview for Doubt Solving — dev only.
 *
 * The real app needs a Supabase login, and signing in on localhost bounces to
 * the production site, so there was no way to look at a new screen while
 * building it. This mounts the page on its own with the network stubbed.
 *
 * Vite only builds index.html, so this file and doubt-preview.html never reach
 * a production bundle. Open http://localhost:3002/doubt-preview.html
 */
import { createRoot } from 'react-dom/client'
import DoubtSolving from './pages/DoubtSolving'
import { recordDoubt } from './lib/twin'

/* Two recents so "Pick up where you left" has something to show. */
try {
  recordDoubt({
    question: 'Why is the mole ratio 1:1 in this reaction?',
    subject: 'Chemistry', topic: 'moles',
  })
  recordDoubt({
    question: 'A ball is dropped from 20 m. How long does it take to hit the ground?',
    subject: 'Physics', topic: 'motion under gravity', answer: 'saved',
  })
} catch { /* private mode */ }

/** A plan shaped exactly like SOLVER_SYSTEM's JSON, so splitSteps() is exercised for real. */
function plan(question: string) {
  const q = question.toLowerCase()
  if (q.includes('mole') || q.includes('ratio')) {
    return {
      topicKeyword: 'Mole ratio', questionType: 'chemistry',
      textExplanation: [
        '## Balance the equation first',
        'Nothing about ratios means anything until the equation is balanced.',
        'NaOH + HCl -> NaCl + H2O',
        '',
        '## Read the coefficients',
        'Every coefficient here is 1, so one mole of acid needs exactly one mole of base.',
        'ratio = 1 : 1',
        '',
        '## Use it',
        'n(NaOH) = 0.2 mol, so n(HCl) = 0.2 mol',
        'The ratio is the bridge between the two substances — it is the only reason you can go from one to the other.',
      ].join('\n'),
    }
  }
  return {
    topicKeyword: 'Motion under gravity', questionType: 'physics',
    textExplanation: [
      '## Write down what you know',
      'The ball is dropped rather than thrown, so its starting speed is zero.',
      'u = 0 m/s, a = 9.8 m/s^2, s = 20 m',
      '',
      '## Choose the equation',
      'You know distance and acceleration and you want time, so the second equation of motion is the one that fits.',
      '$$s = ut + (1/2)at^2$$',
      '',
      '## Substitute',
      '20 = 0 + 0.5 * 9.8 * t^2',
      't^2 = 4.08',
      '',
      '## Solve and check the units',
      't = 2.02 s',
      'Two decimals unless the question says otherwise. Seconds, not metres — if your answer came out in metres you used the wrong equation.',
    ].join('\n'),
  }
}

const real = window.fetch.bind(window)
window.fetch = ((url: any, init?: any) => {
  const u = String(url)
  const json = (b: unknown) => Promise.resolve(
    new Response(JSON.stringify(b), { status: 200, headers: { 'Content-Type': 'application/json' } }))

  if (u.includes('/api/ai/solver/text')) {
    let question = ''
    try { question = JSON.parse(String(init?.body || '{}')).question || '' } catch { /* ignore */ }
    // A beat of latency so the loading state is visible rather than skipped.
    return new Promise(res => setTimeout(() => res(json(plan(question)) as any), 700)) as any
  }
  if (u.includes('/api/camera/analyze')) {
    return new Promise(res => setTimeout(() => res(json({
      text: 'A stone is thrown vertically upward with a speed of 15 m/s. Find the maximum height reached.',
    }) as any), 900)) as any
  }
  return real(url, init)
}) as typeof window.fetch

createRoot(document.getElementById('root')!).render(
  <DoubtSolving
    profile={{ cls: '10', board: 'CBSE' }}
    onOpenChat={seed => alert('Opens the existing chat with this prefilled:\n\n' + seed)}
  />,
)
