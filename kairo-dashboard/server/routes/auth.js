import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { db } from '../db/index.js'
import { signToken, requireAuth } from '../middleware/auth.js'

const router = Router()

router.post('/register', async (req, res) => {
  const { name, email, password, role = 'teacher', school_id } = req.body
  if (!name || !email || !password || !school_id)
    return res.status(400).json({ error: 'name, email, password, school_id are required.' })
  if (!['teacher', 'admin'].includes(role))
    return res.status(400).json({ error: 'role must be teacher or admin.' })
  if (password.length < 8)
    return res.status(400).json({ error: 'Password must be at least 8 characters.' })

  try {
    const existing = await db.users.findOneAsync({ email: email.toLowerCase() })
    if (existing) return res.status(409).json({ error: 'Email already registered.' })

    const hash = await bcrypt.hash(password, 12)
    const user = await db.users.insertAsync({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password_hash: hash,
      role,
      school_id,
      created_at: new Date().toISOString(),
    })

    const token = signToken({ id: user._id, email: user.email, role: user.role, school_id: user.school_id })
    res.status(201).json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role, school_id: user.school_id } })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.post('/login', async (req, res) => {
  const { email, password } = req.body
  if (!email || !password)
    return res.status(400).json({ error: 'email and password are required.' })

  try {
    const user = await db.users.findOneAsync({ email: email.toLowerCase() })
    if (!user) return res.status(401).json({ error: 'Invalid credentials.' })

    const ok = await bcrypt.compare(password, user.password_hash)
    if (!ok) return res.status(401).json({ error: 'Invalid credentials.' })

    const token = signToken({ id: user._id, email: user.email, role: user.role, school_id: user.school_id })
    res.json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role, school_id: user.school_id } })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await db.users.findOneAsync({ _id: req.user.id })
    if (!user) return res.status(404).json({ error: 'User not found.' })
    const { password_hash, ...safe } = user
    res.json(safe)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

export default router
