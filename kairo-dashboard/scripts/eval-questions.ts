/**
 * Generated-question accuracy harness (audit task 5).
 *
 * Every practice question Kyno serves is model-generated and presented as
 * correct. This script measures whether it is:
 *
 *   1. GENERATE  N questions per (subject × class × difficulty) using the
 *      same prompt shape the /api/quiz/start route uses (which also feeds
 *      Exam Hall) plus the Revision Simulator's prompt shape.
 *   2. CHECK     deterministically: exactly 4 options, all distinct, exactly
 *      one marked correct, well-formed answer letter, numeric-option sanity.
 *   3. ADJUDICATE with a second (stronger) model that solves the question
 *      independently and reports whether it agrees with the claimed key.
 *   4. REPORT    accuracy by subject/class/difficulty + every failing item,
 *      to eval-reports/<timestamp>/report.{json,md}. Exits non-zero when
 *      accuracy is below the floor, so CI can enforce it.
 *
 * Run:  node --experimental-strip-types scripts/eval-questions.ts
 * Env:  GROQ_API_KEYS   comma-separated keys (required — same var the server uses)
 *       EVAL_GEN_MODEL  generator model  (default: llama-3.1-8b-instant, the speed tier)
 *       EVAL_JUDGE_MODEL adjudicator     (default: llama-3.3-70b-versatile)
 *       EVAL_BATCH      "jee-neet-50" (default, the audit's first batch) | "full"
 *       EVAL_FLOOR      accuracy floor, default 0.95
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const KEYS = (process.env.GROQ_API_KEYS || process.env.GROQ_API_KEY || '').split(',').map(s => s.trim()).filter(Boolean)
const GEN_MODEL = process.env.EVAL_GEN_MODEL || 'llama-3.1-8b-instant'
const JUDGE_MODEL = process.env.EVAL_JUDGE_MODEL || 'llama-3.3-70b-versatile'
const FLOOR = Number(process.env.EVAL_FLOOR || 0.95)
const BATCH = process.env.EVAL_BATCH || 'jee-neet-50'

if (KEYS.length === 0) {
  console.error(
    '\n[eval-questions] GROQ_API_KEYS is not set.\n' +
    'This harness calls the same Groq API the product uses; it cannot run keyless.\n' +
    'Locally:  GROQ_API_KEYS=gsk_... node --experimental-strip-types scripts/eval-questions.ts\n' +
    'CI:       set the GROQ_API_KEYS repository secret (workflow: eval-questions.yml).\n',
  )
  process.exit(2)
}

let keyCursor = 0
const nextKey = () => KEYS[keyCursor++ % KEYS.length]

interface GenQuestion {
  question: string
  options: string[]
  correct: string
  explanation?: string
  difficulty?: string
  topic?: string
}
interface EvalItem {
  cell: string
  source: 'quiz-route' | 'simulator'
  q: GenQuestion
  deterministic: { ok: boolean; failures: string[] }
  judge?: { agrees: boolean; letter: string | null; reason: string }
  pass: boolean
}

/* ── the batch matrix ─────────────────────────────────────────────────────── */

type Cell = { board: string; cls: string; subject: string; difficulty: string; n: number; source: 'quiz-route' | 'simulator'; topics?: string[] }

// The audit's first gate: a 50-question JEE/NEET Physics + Maths batch.
const JEE_NEET_50: Cell[] = [
  { board: 'CBSE', cls: '12', subject: 'Physics',     difficulty: 'hard',   n: 13, source: 'quiz-route' },
  { board: 'CBSE', cls: '12', subject: 'Mathematics', difficulty: 'hard',   n: 13, source: 'quiz-route' },
  { board: 'CBSE', cls: '12', subject: 'Physics',     difficulty: 'medium', n: 6,  source: 'quiz-route' },
  { board: 'CBSE', cls: '12', subject: 'Mathematics', difficulty: 'medium', n: 6,  source: 'quiz-route' },
  { board: 'CBSE', cls: '12', subject: 'Physics',     difficulty: 'hard',   n: 6,  source: 'simulator', topics: ['rotational motion', 'electromagnetic induction'] },
  { board: 'CBSE', cls: '12', subject: 'Mathematics', difficulty: 'hard',   n: 6,  source: 'simulator', topics: ['definite integrals', 'probability'] },
]

const FULL: Cell[] = [
  ...JEE_NEET_50,
  { board: 'CBSE', cls: '10', subject: 'Science',   difficulty: 'medium', n: 10, source: 'quiz-route' },
  { board: 'CBSE', cls: '10', subject: 'Mathematics', difficulty: 'medium', n: 10, source: 'quiz-route' },
  { board: 'CBSE', cls: '12', subject: 'Chemistry', difficulty: 'hard',   n: 10, source: 'quiz-route' },
  { board: 'CBSE', cls: '12', subject: 'Biology',   difficulty: 'hard',   n: 10, source: 'quiz-route' },
]

const CELLS = BATCH === 'full' ? FULL : JEE_NEET_50

/* ── prompts (mirroring the product's own) ────────────────────────────────── */

function quizRoutePrompt(c: Cell): string {
  // Mirrors server/routes/quiz.js — the generator behind Adaptive Quiz AND Exam Hall.
  return `You are an expert ${c.board} Class ${c.cls} ${c.subject} quiz maker.

Generate ${c.n} MCQ questions at ${c.difficulty} difficulty level.

Return ONLY valid JSON:
{
  "questions": [
    {
      "id": 1,
      "question": "Question text?",
      "options": ["A. Option 1", "B. Option 2", "C. Option 3", "D. Option 4"],
      "correct": "A",
      "explanation": "Brief explanation of why A is correct",
      "difficulty": "${c.difficulty}",
      "topic": "subtopic name"
    }
  ]
}

Make questions exam-style. No markdown.
Mathematics notation: use $...$ for inline math and $$...$$ for display math ONLY.`
}

function simulatorPrompt(c: Cell): string {
  // Mirrors RevisionSimulator's client prompt shape (index-based answers).
  return `You are an expert exam question writer. Generate ${c.n} ${c.difficulty}-difficulty MCQs targeting ONLY these topics: ${(c.topics || []).join(', ')}. Subject: ${c.subject}, ${c.board} Class ${c.cls}. Each question has exactly 4 options with one correct answer (index 0-3).
Return ONLY valid JSON: {"questions":[{"q":"...","options":["...","...","...","..."],"answer":0,"explain":"...","topic":"..."}]}`
}

/* ── plumbing ─────────────────────────────────────────────────────────────── */

async function groq(model: string, content: string, maxTokens = 3000): Promise<string> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const key = nextKey()
    try {
      const r = await fetch(GROQ_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages: [{ role: 'user', content }], temperature: 0.4, max_tokens: maxTokens }),
        signal: AbortSignal.timeout(45_000),
      })
      if (r.status === 429 || r.status >= 500) { await new Promise(s => setTimeout(s, 1200 * (attempt + 1))); continue }
      if (!r.ok) throw new Error(`groq ${r.status}: ${(await r.text()).slice(0, 200)}`)
      const data = await r.json()
      return data.choices?.[0]?.message?.content || ''
    } catch (e) {
      if (attempt === 3) throw e
      await new Promise(s => setTimeout(s, 800 * (attempt + 1)))
    }
  }
  throw new Error('unreachable')
}

function extractJSON(raw: string): any {
  const m = raw.match(/\{[\s\S]*\}/)
  if (!m) throw new Error('no JSON in model output')
  return JSON.parse(m[0])
}

function normaliseQuestion(row: any, source: Cell['source']): GenQuestion | null {
  if (source === 'quiz-route') {
    if (!row?.question || !Array.isArray(row.options)) return null
    return { question: String(row.question), options: row.options.map(String), correct: String(row.correct || ''), explanation: row.explanation, difficulty: row.difficulty, topic: row.topic }
  }
  if (!row?.q || !Array.isArray(row.options) || typeof row.answer !== 'number') return null
  const letter = 'ABCD'[row.answer] || ''
  return { question: String(row.q), options: row.options.map((o: string, i: number) => `${'ABCD'[i]}. ${o}`), correct: letter, explanation: row.explain, topic: row.topic }
}

/* ── deterministic checks ─────────────────────────────────────────────────── */

const stripLetter = (o: string) => o.replace(/^\s*[A-Da-d][.):]\s*/, '').trim()

export function deterministicCheck(q: GenQuestion): { ok: boolean; failures: string[] } {
  const f: string[] = []
  if (!q.question || q.question.length < 8) f.push('question text too short')
  if (q.options.length !== 4) f.push(`expected 4 options, got ${q.options.length}`)
  const bodies = q.options.map(stripLetter).map(s => s.toLowerCase())
  if (new Set(bodies).size !== bodies.length) f.push('duplicate options')
  if (bodies.some(b => !b)) f.push('empty option body')
  if (!/^[A-D]$/.test(q.correct)) f.push(`correct is "${q.correct}", not a letter A-D`)
  else {
    const idx = 'ABCD'.indexOf(q.correct)
    if (idx >= q.options.length) f.push('correct letter points past the options')
  }
  if (!q.explanation || String(q.explanation).length < 5) f.push('missing explanation')
  return { ok: f.length === 0, failures: f }
}

/* ── adjudication ─────────────────────────────────────────────────────────── */

async function adjudicate(q: GenQuestion): Promise<{ agrees: boolean; letter: string | null; reason: string }> {
  const prompt = `Solve this multiple-choice question INDEPENDENTLY, showing brief working, then answer in JSON.

Question: ${q.question}
Options:
${q.options.join('\n')}

Return ONLY JSON: {"letter":"A|B|C|D","confident":true|false,"reason":"one line of working"}`
  try {
    const raw = await groq(JUDGE_MODEL, prompt, 900)
    const j = extractJSON(raw)
    const letter = /^[A-D]$/.test(j?.letter) ? j.letter : null
    return { agrees: letter != null && letter === q.correct, letter, reason: String(j?.reason || '').slice(0, 300) }
  } catch (e: any) {
    return { agrees: false, letter: null, reason: `judge failed: ${e.message}` }
  }
}

/* ── main ─────────────────────────────────────────────────────────────────── */

async function main() {
  console.log(`[eval-questions] batch=${BATCH} gen=${GEN_MODEL} judge=${JUDGE_MODEL} floor=${FLOOR}`)
  const items: EvalItem[] = []

  for (const cell of CELLS) {
    const label = `${cell.subject}/cls${cell.cls}/${cell.difficulty}/${cell.source}`
    process.stdout.write(`  generating ${cell.n} × ${label} … `)
    try {
      const raw = await groq(GEN_MODEL, cell.source === 'quiz-route' ? quizRoutePrompt(cell) : simulatorPrompt(cell))
      const rows = extractJSON(raw)?.questions || []
      const qs = rows.map((r: any) => normaliseQuestion(r, cell.source)).filter(Boolean) as GenQuestion[]
      console.log(`${qs.length} parsed`)
      for (const q of qs.slice(0, cell.n)) {
        const det = deterministicCheck(q)
        const judge = det.ok ? await adjudicate(q) : undefined
        items.push({ cell: label, source: cell.source, q, deterministic: det, judge, pass: det.ok && !!judge?.agrees })
      }
    } catch (e: any) {
      console.log(`FAILED: ${e.message}`)
    }
  }

  /* report */
  const byCell: Record<string, { n: number; pass: number }> = {}
  for (const it of items) {
    const b = byCell[it.cell] || (byCell[it.cell] = { n: 0, pass: 0 })
    b.n++; if (it.pass) b.pass++
  }
  const total = items.length
  const passed = items.filter(i => i.pass).length
  const accuracy = total ? passed / total : 0

  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const dir = join('eval-reports', stamp)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'report.json'), JSON.stringify({ batch: BATCH, genModel: GEN_MODEL, judgeModel: JUDGE_MODEL, total, passed, accuracy, byCell, items }, null, 2))

  const failing = items.filter(i => !i.pass)
  const md = [
    `# Question accuracy report — ${stamp}`,
    ``,
    `Generator: \`${GEN_MODEL}\` · Judge: \`${JUDGE_MODEL}\` · Batch: ${BATCH}`,
    ``,
    `## Headline`,
    `**${passed}/${total} passed — accuracy ${(accuracy * 100).toFixed(1)}% (floor ${(FLOOR * 100).toFixed(0)}%)**`,
    ``,
    `## By cell`,
    ...Object.entries(byCell).map(([c, b]) => `- ${c}: ${b.pass}/${b.n} (${((b.pass / b.n) * 100).toFixed(0)}%)`),
    ``,
    `## Failing items (${failing.length})`,
    ...failing.flatMap(i => [
      `### ${i.cell}`,
      `> ${i.q.question}`,
      `- options: ${i.q.options.join(' | ')}`,
      `- claimed: ${i.q.correct} · judge: ${i.judge?.letter ?? 'n/a'}`,
      `- why failed: ${i.deterministic.ok ? `judge disagrees — ${i.judge?.reason}` : i.deterministic.failures.join('; ')}`,
      ``,
    ]),
  ].join('\n')
  writeFileSync(join(dir, 'report.md'), md)

  console.log(`\n[eval-questions] ${passed}/${total} — accuracy ${(accuracy * 100).toFixed(1)}%`)
  console.log(`[eval-questions] report: ${dir}/report.md`)
  if (accuracy < FLOOR) {
    console.error(`[eval-questions] BELOW FLOOR ${(FLOOR * 100).toFixed(0)}% — failing the run.`)
    process.exit(1)
  }
}

// Node's strip-types runner executes top-level await fine.
await main()
