import { Router } from 'express'
import { db } from '../db/index.js'
import { aiCall, parseJSON } from '../utils/ai.js'

const router = Router()

router.post('/create', async (req, res) => {
  const {
    student_id,
    student_name,
    exam_date,
    subjects,
    daily_hours = 4,
    board = 'CBSE',
    class: cls = '10',
  } = req.body

  if (!exam_date || !subjects?.length)
    return res.status(400).json({ error: 'exam_date and subjects[] are required.' })

  const today = new Date().toISOString().slice(0, 10)
  const daysLeft = Math.max(1, Math.round((new Date(exam_date) - new Date(today)) / 86400000))

  try {
    const prompt = `You are an expert Indian board exam study planner (${board}, Class ${cls}).

Student: ${student_name || 'Student'}
Exam date: ${exam_date} (${daysLeft} days from today)
Available study hours per day: ${daily_hours}
Subjects and weak topics:
${subjects.map(s => `- ${s.name}${s.weak_topics?.length ? ' (weak: ' + s.weak_topics.join(', ') + ')' : ''}`).join('\n')}

Create a realistic daily study plan from today (${today}) to ${exam_date}.

Return ONLY valid JSON:
{
  "summary": "brief 1-line plan overview",
  "total_days": ${daysLeft},
  "daily_hours": ${daily_hours},
  "weeks": [
    {
      "week": 1,
      "focus": "primary subject/topic focus this week",
      "days": [
        {
          "date": "YYYY-MM-DD",
          "tasks": [
            { "subject": "...", "topic": "...", "hours": 1.5, "type": "study|revision|practice|mock" }
          ]
        }
      ]
    }
  ]
}

Rules:
- Prioritize weak topics in the first half
- Include revision days in last 20% of plan
- Include at least one mock test day per week
- Keep daily total ≤ ${daily_hours} hours
- No markdown, no extra text`

    const raw = await aiCall({
      taskType: 'study_plan',
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 3000,
    })

    const plan = parseJSON(raw)

    const doc = await db.studyPlans.insertAsync({
      school_id: req.body?.school_id || req.query?.school_id || 'demo_school',
      created_by: 'system',
      student_id: student_id || null,
      student_name: student_name || null,
      exam_date,
      subjects,
      daily_hours,
      board,
      class: cls,
      plan,
      completed_tasks: [],
      created_at: new Date().toISOString(),
    })

    res.status(201).json(doc)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.get('/', async (req, res) => {
  try {
    const plans = await db.studyPlans
      .findAsync({ school_id: req.body?.school_id || req.query?.school_id || 'demo_school' })
      .sort({ created_at: -1 })
    res.json(plans)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.get('/:id', async (req, res) => {
  try {
    const plan = await db.studyPlans.findOneAsync({ _id: req.params.id, school_id: req.body?.school_id || req.query?.school_id || 'demo_school' })
    if (!plan) return res.status(404).json({ error: 'Plan not found.' })
    res.json(plan)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.put('/:id/progress', async (req, res) => {
  const { date, subject, topic, done = true } = req.body
  if (!date || !subject || !topic) return res.status(400).json({ error: 'date, subject, topic required.' })

  try {
    const plan = await db.studyPlans.findOneAsync({ _id: req.params.id, school_id: req.body?.school_id || req.query?.school_id || 'demo_school' })
    if (!plan) return res.status(404).json({ error: 'Plan not found.' })

    const key = `${date}|${subject}|${topic}`
    let completed = plan.completed_tasks || []

    if (done && !completed.includes(key)) completed.push(key)
    if (!done) completed = completed.filter(k => k !== key)

    await db.studyPlans.updateAsync({ _id: plan._id }, { $set: { completed_tasks: completed } })
    res.json({ message: 'Progress updated.', completed_count: completed.length })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.delete('/:id', async (req, res) => {
  await db.studyPlans.removeAsync({ _id: req.params.id, school_id: req.body?.school_id || req.query?.school_id || 'demo_school' }, {})
  res.json({ message: 'Plan deleted.' })
})

export default router
