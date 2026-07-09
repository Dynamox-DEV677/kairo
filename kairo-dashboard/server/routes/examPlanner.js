/**
 * Exam Planner Routes
 *
 * POST /api/exam-planner/generate
 *   Body: { exam, examDate, hoursPerDay, weakAreas?, currentLevel? }
 *   exam ∈ { 'jee-main', 'jee-advanced', 'neet', 'cbse-10', 'cbse-12', 'icse-10', 'icse-12', 'custom' }
 *
 * Difference from /api/study-plan: this route knows the syllabus and
 * weighting of major Indian exams up front, so the user only has to pick
 * the exam — not list every subject + topic themselves. The AI is
 * primed with the syllabus block before being asked for a plan.
 */
import { Router } from 'express'
import { aiCall, parseJSON } from '../utils/ai.js'
import { supabaseAdmin, SUPABASE_CONFIGURED } from '../services/supabase.js'
import groqPool from '../services/groqPool.js'

const router = Router()

// ── Groq-first AI helper ────────────────────────────────────────────────
// Tries Groq's 70B model (free, fast) using a rotating key pool. Falls
// back to aiCall (OpenRouter) if Groq has no live keys OR fails. This
// avoids the 500 we saw when only GROQ_API_KEYS is set in Vercel env.
async function aiCallSmart({ taskType, messages, maxTokens = 4000, temperature = 0.4 }) {
  // 1) Try Groq first
  const key = groqPool.next()
  if (key) {
    try {
      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${key}`,
          'Content-Type':  'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages,
          temperature,
          max_tokens: maxTokens,
          response_format: { type: 'json_object' },
        }),
      })
      if (!r.ok) {
        if (r.status === 429 || r.status >= 500) {
          try { groqPool.markBad(key, r.status) } catch {}
        }
        throw new Error('groq http ' + r.status)
      }
      const data = await r.json()
      const content = data?.choices?.[0]?.message?.content
      if (content) return content
    } catch (e) {
      console.warn('[exam-planner] Groq failed, trying OpenRouter:', e.message)
    }
  }
  // 2) Fall back to OpenRouter (aiCall)
  return aiCall({ taskType, messages, maxTokens, temperature })
}

// Helper — return 503 if Supabase isn't set up. Used by the persistence
// endpoints; the AI-only /generate + /replan + /exams endpoints don't
// need a DB so they still work without Supabase env vars.
function requireDB(req, res, next) {
  if (!SUPABASE_CONFIGURED) {
    return res.status(503).json({
      error: 'Supabase not configured.',
      hint:  'Run server/db/exam_plans_schema.sql in Supabase, then set SUPABASE_* env vars.',
    })
  }
  next()
}

// ── Exam knowledge base ────────────────────────────────────────────────
// Compact syllabi the AI gets injected into its prompt so it doesn't
// have to recall from memory. Topic weights are rough percentages from
// past papers — used to prioritize what to study first.
const EXAMS = {
  'jee-main': {
    label: 'JEE Main',
    durationHrs: 3,
    pattern: '90 MCQs across PCM, no negative for numericals, ~300 marks',
    subjects: {
      Mathematics: { weight: 0.34, weakest: ['Coordinate Geometry', 'Vectors & 3D', 'Differential Equations', 'Integrals'] },
      Physics:     { weight: 0.33, weakest: ['Rotational Mechanics', 'Electrodynamics', 'Modern Physics', 'EM Waves'] },
      Chemistry:   { weight: 0.33, weakest: ['Organic Reactions', 'Coordination Compounds', 'Chemical Bonding', 'Thermodynamics'] },
    },
  },
  'jee-advanced': {
    label: 'JEE Advanced',
    durationHrs: 6,
    pattern: 'Two 3-hour papers, mix of single/multi-correct + numericals + paragraph, ~360 marks',
    subjects: {
      Mathematics: { weight: 0.34, weakest: ['Function Iteration', 'Conic Sections', 'Vectors & 3D', 'Integrals (Definite + Indef)'] },
      Physics:     { weight: 0.33, weakest: ['Rotational + Rolling', 'Modern Physics', 'Optics', 'Capacitors + EM Induction'] },
      Chemistry:   { weight: 0.33, weakest: ['Organic mechanisms', 'Inorganic qualitative', 'Equilibria', 'Coordination'] },
    },
  },
  'neet': {
    label: 'NEET',
    durationHrs: 3.33,
    pattern: '180 MCQs (45 Phy + 45 Chem + 90 Bio), 720 marks',
    subjects: {
      Biology:   { weight: 0.50, weakest: ['Genetics', 'Human Physiology', 'Plant Physiology', 'Ecology', 'Cell Biology'] },
      Physics:   { weight: 0.25, weakest: ['Mechanics', 'Electrodynamics', 'Modern Physics', 'Thermodynamics'] },
      Chemistry: { weight: 0.25, weakest: ['Organic GOC + Reactions', 'Chemical Bonding', 'Coordination', 'Equilibria'] },
    },
  },
  'cbse-10': {
    label: 'CBSE Class 10 Boards',
    durationHrs: 3,
    pattern: 'Five 80-mark papers across subjects',
    subjects: {
      Mathematics:    { weight: 0.20, weakest: ['Trigonometry', 'Arithmetic Progressions', 'Surface Areas & Volumes', 'Coordinate Geometry'] },
      Science:        { weight: 0.20, weakest: ['Chemical Reactions', 'Electricity & Magnetism', 'Life Processes', 'Light & Optics'] },
      'Social Science':{ weight: 0.20, weakest: ['History — Nationalism', 'Geography — Resources', 'Civics — Democracy', 'Economics — Sectors'] },
      English:        { weight: 0.20, weakest: ['Literature analysis', 'Writing — Letter/Article', 'Grammar', 'Reading Comprehension'] },
      'Second Language': { weight: 0.20, weakest: ['Grammar', 'Composition', 'Literature'] },
    },
  },
  'cbse-12': {
    label: 'CBSE Class 12 Boards',
    durationHrs: 3,
    pattern: 'Five 80-mark stream-dependent papers',
    subjects: {
      Mathematics: { weight: 0.20, weakest: ['Calculus', 'Vectors & 3D', 'Probability', 'Linear Programming'] },
      Physics:     { weight: 0.20, weakest: ['Electrodynamics', 'Modern Physics', 'Ray + Wave Optics', 'EM Induction'] },
      Chemistry:   { weight: 0.20, weakest: ['Organic mechanisms', 'Coordination', 'Electrochemistry', 'Solutions'] },
      Biology:     { weight: 0.20, weakest: ['Genetics', 'Reproduction', 'Ecology', 'Biotechnology'] },
      English:     { weight: 0.20, weakest: ['Flamingo prose', 'Vistas chapters', 'Writing skills', 'Reading'] },
    },
  },
  'icse-10': { label: 'ICSE Class 10', durationHrs: 3, pattern: 'Subject-wise 80-mark papers', subjects: {
      Mathematics: { weight: 0.25, weakest: ['Geometry Proofs', 'Trigonometry', 'Statistics', 'Mensuration'] },
      Physics:     { weight: 0.20, weakest: ['Force & Pressure', 'Light', 'Electricity', 'Sound'] },
      Chemistry:   { weight: 0.20, weakest: ['Periodic Properties', 'Acids/Bases/Salts', 'Mole Concept', 'Organic Chemistry'] },
      Biology:     { weight: 0.20, weakest: ['Cell Biology', 'Genetics', 'Human Anatomy', 'Plant Physiology'] },
      English:     { weight: 0.15, weakest: ['Literature', 'Composition', 'Grammar'] },
    } },
  'icse-12': { label: 'ISC Class 12', durationHrs: 3, pattern: 'Subject-wise 70-100 mark papers', subjects: {
      Mathematics: { weight: 0.20, weakest: ['Calculus', '3D Geometry', 'Probability', 'Differential Equations'] },
      Physics:     { weight: 0.20, weakest: ['Electrostatics', 'Modern Physics', 'EM Induction', 'Optics'] },
      Chemistry:   { weight: 0.20, weakest: ['Organic reactions', 'Coordination', 'Electrochemistry', 'p-block'] },
      Biology:     { weight: 0.20, weakest: ['Reproduction', 'Genetics', 'Ecology', 'Biotech'] },
      English:     { weight: 0.20, weakest: ['Drama analysis', 'Poetry analysis', 'Composition'] },
    } },
  'custom': null,
}

// ── POST /api/exam-planner/generate ────────────────────────────────────
router.post('/generate', async (req, res) => {
  const {
    exam = 'jee-main',
    examDate,                 // 'YYYY-MM-DD'
    hoursPerDay = 4,
    weakAreas = [],           // string[] — topics the student already knows are shaky
    currentLevel = 'mid',     // 'beginner' | 'mid' | 'strong'
    customSubjects = null,    // [{ name, weight, weakest:[] }] — only if exam === 'custom'
  } = req.body || {}

  if (!examDate) {
    return res.status(400).json({ error: 'examDate (YYYY-MM-DD) is required.' })
  }

  const today = new Date().toISOString().slice(0, 10)
  const daysLeft = Math.max(1, Math.round(
    (new Date(examDate) - new Date(today)) / 86400000
  ))

  const examConfig = exam === 'custom'
    ? { label: 'Custom Exam', pattern: 'User-defined', subjects: Object.fromEntries(
        (customSubjects || []).map(s => [s.name, { weight: s.weight ?? 0.25, weakest: s.weakest || [] }])
      ) }
    : EXAMS[exam]

  if (!examConfig) return res.status(400).json({ error: `Unknown exam: ${exam}` })

  // Format the subjects block for the prompt
  const subjectsBlock = Object.entries(examConfig.subjects).map(([name, cfg]) =>
    `- ${name} (~${Math.round(cfg.weight * 100)}% of exam, common-weak topics: ${cfg.weakest.join(', ')})`
  ).join('\n')

  const weakBlock = weakAreas.length
    ? `Student has self-flagged these as weak — give them extra weight:\n${weakAreas.map(w => `- ${w}`).join('\n')}`
    : 'Student has not flagged specific weak areas — use the per-subject "common-weak topics" as the priority list.'

  const prompt = `You are India's most pragmatic exam coach. Build a realistic, day-by-day study plan.

Target exam: ${examConfig.label}
Exam pattern: ${examConfig.pattern}
Exam date: ${examDate}  (${daysLeft} days from today, ${today})
Hours available per day: ${hoursPerDay}
Student's current level: ${currentLevel}

Subjects and their typical weight:
${subjectsBlock}

${weakBlock}

Return ONLY valid JSON in EXACTLY this shape — no markdown, no commentary:
{
  "exam": "${examConfig.label}",
  "totalDays": ${daysLeft},
  "summary": "1-sentence headline of the plan strategy",
  "topicPriorities": [
    { "subject": "Physics", "topic": "Rotational Mechanics", "weight": "HIGH|MED|LOW", "reason": "..." }
  ],
  "weeklySchedule": [
    {
      "week": 1,
      "focus": "Headline focus for this week (e.g. 'Foundation: Mechanics + Calculus')",
      "days": [
        {
          "day": "Mon",
          "blocks": [
            { "time": "07:00-08:30", "subject": "Math", "topic": "Limits", "type": "concept" }
          ]
        }
      ]
    }
  ],
  "milestones": [
    { "atDay": 14, "checkpoint": "Mock test #1", "target": "60% accuracy" }
  ],
  "answerStrategy": "1-paragraph advice on how to attack the exam paper itself (which sections first, time per question, etc.)",
  "tips": "1-paragraph high-level advice"
}

Rules:
- Total study minutes per day must not exceed ${hoursPerDay * 60} minutes.
- "type" must be one of: concept | practice | PYQ | revision | mock | rest.
- Bake in 1 rest day per week (e.g. Sunday short).
- Reserve the last ~20% of days for revision + mocks only.
- Include at least one full mock test in the second half of the plan.
- If daysLeft > 28, return only first 4 weeks in weeklySchedule (representative sample).
- If daysLeft <= 14, plan day-by-day in detail.
- Prioritize weak topics in the first 60% of the plan.`

  try {
    const raw = await aiCallSmart({
      taskType: 'exam_planner',
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 4000,
    })
    const plan = parseJSON(raw)
    if (!plan) {
      return res.status(502).json({ error: 'AI returned non-JSON', raw: raw?.slice(0, 1000) })
    }
    plan.generatedAt = new Date().toISOString()
    plan.hoursPerDay = hoursPerDay
    plan.examDate = examDate
    return res.json(plan)
  } catch (err) {
    console.error('[exam-planner] generate failed:', err)
    return res.status(500).json({ error: err.message, hint: 'Set GROQ_API_KEYS in Vercel env, then redeploy.' })
  }
})

// ── POST /api/exam-planner/replan ──────────────────────────────────────
// Re-generates a plan with feedback from the student's last week.
// Body: { previousPlan, mockScore (0-100), completionPercent (0-100),
//         strugglingTopics: [], confidentTopics: [], hoursPerDay, examDate }
// The AI gets the *previous* plan's structure as context and rebuilds it
// using the user's actual progress + how the latest mock went.
router.post('/replan', async (req, res) => {
  const {
    previousPlan,
    mockScore = null,
    completionPercent = 70,
    strugglingTopics = [],
    confidentTopics = [],
    hoursPerDay,
    examDate,
  } = req.body || {}

  if (!previousPlan || !examDate) {
    return res.status(400).json({ error: 'previousPlan + examDate required' })
  }

  const today = new Date().toISOString().slice(0, 10)
  const daysLeft = Math.max(1, Math.round(
    (new Date(examDate) - new Date(today)) / 86400000
  ))

  const prompt = `You are India's most pragmatic exam coach. Re-plan a student's
remaining ${daysLeft} days based on their actual progress.

Previous plan summary: ${previousPlan.summary || previousPlan.exam || 'Prior exam plan'}
Target exam: ${previousPlan.exam}
Days remaining: ${daysLeft}
Hours per day: ${hoursPerDay ?? previousPlan.hoursPerDay ?? 4}

Student's recent progress:
- Completion of last week's plan: ${completionPercent}%
${mockScore !== null ? `- Latest mock test score: ${mockScore}%` : '- No mock test results yet'}
${strugglingTopics.length ? `- Topics they're struggling with: ${strugglingTopics.join(', ')}` : ''}
${confidentTopics.length ? `- Topics they feel confident on: ${confidentTopics.join(', ')}` : ''}

Re-plan using the SAME JSON shape as before:
{
  "exam": "${previousPlan.exam}",
  "totalDays": ${daysLeft},
  "summary": "1-sentence headline reflecting the adjustment you're making",
  "topicPriorities": [{ "subject", "topic", "weight": "HIGH|MED|LOW", "reason" }],
  "weeklySchedule": [{ "week", "focus", "days": [{ "day", "blocks": [{ "time", "subject", "topic", "type" }] }] }],
  "milestones": [{ "atDay", "checkpoint", "target" }],
  "answerStrategy": "...",
  "tips": "..."
}

Adjustments to make:
- If completion < 60%: reduce daily load by 20%, mark fewer topics HIGH.
- If mock < 50%: drop newer topics, double-down on foundations.
- If mock 50-75%: keep pace, add 1 extra mock test in next 2 weeks.
- If mock > 75%: introduce 1-2 stretch topics + an extended mock.
- Topics in 'strugglingTopics' must appear HIGH priority + scheduled earliest.
- Topics in 'confidentTopics' drop to LOW priority or removed unless they're high-weight.
- Only include the next 3-4 weeks in weeklySchedule (don't re-plan the whole exam — just the near future).

Return ONLY valid JSON, no markdown.`

  try {
    const raw = await aiCallSmart({
      taskType: 'exam_planner_replan',
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 3000,
    })
    const plan = parseJSON(raw)
    if (!plan) return res.status(502).json({ error: 'AI returned non-JSON', raw: raw?.slice(0, 1000) })
    plan.generatedAt = new Date().toISOString()
    plan.hoursPerDay = hoursPerDay ?? previousPlan.hoursPerDay
    plan.examDate = examDate
    plan.isReplan = true
    return res.json(plan)
  } catch (err) {
    console.error('[exam-planner] replan failed:', err)
    return res.status(500).json({ error: err.message })
  }
})

// ── GET /api/exam-planner/exams ────────────────────────────────────────
// Lightweight metadata endpoint for the picker UI.
router.get('/exams', (req, res) => {
  res.json(Object.entries(EXAMS)
    .filter(([k]) => k !== 'custom')
    .map(([k, v]) => ({
      id: k,
      label: v.label,
      subjects: Object.keys(v.subjects),
      durationHrs: v.durationHrs,
    }))
    .concat([{ id: 'custom', label: 'Custom (define subjects yourself)', subjects: [], durationHrs: null }]))
})

// ── Persistence (Supabase) ─────────────────────────────────────────────
// All DB endpoints below require Supabase to be configured.

// POST /api/exam-planner/save  — store a freshly-generated plan
// Body: { user_id, exam, exam_date, hours_per_day, plan_json }
router.post('/save', requireDB, async (req, res) => {
  const { user_id, exam, exam_date, hours_per_day, plan_json } = req.body || {}
  if (!user_id || !exam || !exam_date || !plan_json) {
    return res.status(400).json({ error: 'user_id, exam, exam_date, plan_json required' })
  }
  try {
    const { data, error } = await supabaseAdmin
      .from('exam_plans')
      .insert([{ user_id, exam, exam_date, hours_per_day: hours_per_day || 4, plan_json }])
      .select()
      .single()
    if (error) throw error
    res.json(data)
  } catch (e) {
    console.error('[exam-planner] save:', e)
    res.status(500).json({ error: e.message })
  }
})

// GET /api/exam-planner/list?user_id=…
// Returns [] (with a hint header) instead of 500 if the table doesn't
// exist yet — keeps the UI usable before the schema SQL has been run.
router.get('/list', requireDB, async (req, res) => {
  const { user_id } = req.query
  if (!user_id) return res.status(400).json({ error: 'user_id required' })
  try {
    const { data, error } = await supabaseAdmin
      .from('exam_plans')
      .select('id, exam, exam_date, hours_per_day, created_at, updated_at, mock_scores, completion_state, is_archived')
      .eq('user_id', user_id)
      .eq('is_archived', false)
      .order('created_at', { ascending: false })
    if (error) throw error
    res.json(data || [])
  } catch (e) {
    const msg = e?.message || ''
    // "relation … does not exist" → table not migrated yet. Don't 500;
    // just return [] with a hint header so the UI silently handles it.
    if (msg.includes('does not exist') || msg.includes('schema cache')) {
      res.setHeader('x-exam-planner-hint', 'run server/db/exam_plans_schema.sql in Supabase')
      return res.json([])
    }
    console.error('[exam-planner] list:', e)
    res.status(500).json({ error: msg })
  }
})

// GET /api/exam-planner/:id — full plan with plan_json
router.get('/:id', requireDB, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('exam_plans')
      .select('*')
      .eq('id', req.params.id)
      .single()
    if (error) throw error
    res.json(data)
  } catch (e) {
    res.status(404).json({ error: e.message })
  }
})

// PATCH /api/exam-planner/:id/checkin
// Body: { block_key: "1-Mon-0", done: true }
// Toggles the completion_state JSON map.
router.patch('/:id/checkin', requireDB, async (req, res) => {
  const { block_key, done } = req.body || {}
  if (!block_key) return res.status(400).json({ error: 'block_key required' })
  try {
    const { data: row, error: e1 } = await supabaseAdmin
      .from('exam_plans')
      .select('completion_state')
      .eq('id', req.params.id)
      .single()
    if (e1) throw e1
    const state = { ...(row.completion_state || {}) }
    if (done) state[block_key] = true
    else delete state[block_key]
    const { data, error } = await supabaseAdmin
      .from('exam_plans')
      .update({ completion_state: state })
      .eq('id', req.params.id)
      .select('completion_state')
      .single()
    if (error) throw error
    res.json(data)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// PATCH /api/exam-planner/:id/mock  — log a mock-test score
// Body: { score: 0-100, note: "" }
router.patch('/:id/mock', requireDB, async (req, res) => {
  const { score, note = '' } = req.body || {}
  if (typeof score !== 'number') return res.status(400).json({ error: 'score (number) required' })
  try {
    const { data: row, error: e1 } = await supabaseAdmin
      .from('exam_plans')
      .select('mock_scores')
      .eq('id', req.params.id)
      .single()
    if (e1) throw e1
    const scores = Array.isArray(row.mock_scores) ? row.mock_scores : []
    scores.push({ date: new Date().toISOString().slice(0, 10), score, note })
    const { data, error } = await supabaseAdmin
      .from('exam_plans')
      .update({ mock_scores: scores })
      .eq('id', req.params.id)
      .select('mock_scores')
      .single()
    if (error) throw error
    res.json(data)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// PATCH /api/exam-planner/:id  — replace plan_json with a re-planned version
router.patch('/:id', requireDB, async (req, res) => {
  const { plan_json, hours_per_day } = req.body || {}
  if (!plan_json) return res.status(400).json({ error: 'plan_json required' })
  try {
    const patch = { plan_json }
    if (hours_per_day) patch.hours_per_day = hours_per_day
    const { data, error } = await supabaseAdmin
      .from('exam_plans')
      .update(patch)
      .eq('id', req.params.id)
      .select()
      .single()
    if (error) throw error
    res.json(data)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// DELETE /api/exam-planner/:id  — soft delete (set is_archived = true)
router.delete('/:id', requireDB, async (req, res) => {
  try {
    const { error } = await supabaseAdmin
      .from('exam_plans')
      .update({ is_archived: true })
      .eq('id', req.params.id)
    if (error) throw error
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

export default router
