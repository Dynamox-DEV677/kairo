import { Router }        from 'express'
import { fail } from '../lib/fail.js'
import { supabaseAdmin, requireSupabase } from '../services/supabase.js'
import { requireSupabaseAuth, requireRole } from '../middleware/supabaseAuth.js'

const router = Router()
router.use(requireSupabase)
router.use(requireSupabaseAuth)

router.post('/', requireRole('teacher', 'admin'), async (req, res) => {
  const { message, target_role = 'all', expires_in_hours = 12 } = req.body

  if (!message?.trim()) return res.status(400).json({ error: 'message is required.' })
  if (!req.schoolId)    return res.status(400).json({ error: 'You must be in a school to send notifications.' })
  if (!['all', 'student', 'teacher'].includes(target_role)) {
    return res.status(400).json({ error: 'target_role must be all, student, or teacher.' })
  }

  const hours = Math.min(Math.max(Number(expires_in_hours) || 12, 1), 72)
  const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString()

  try {
    const { data, error } = await supabaseAdmin
      .from('notifications')
      .insert({
        school_id:   req.schoolId,
        sender_id:   req.user.id,
        sender_name: req.user.name,
        message:     message.trim(),
        target_role,
        expires_at:  expiresAt,
      })
      .select('id, message, target_role, sender_name, created_at, expires_at')
      .single()

    if (error) throw new Error(error.message)

    console.log(`[Notifications] ✓ Sent by ${req.user.name} → ${target_role} (expires ${expiresAt})`)
    res.status(201).json({ message: 'Notification sent.', notification: data })
  } catch (e) {
    console.error('[Notifications/send]', e.message)
    fail(res, req, e)
  }
})

router.get('/', async (req, res) => {
  if (!req.schoolId) return res.status(400).json({ error: 'You are not in a school.' })

  try {
    const now = new Date().toISOString()
    const userRole = req.user.role

    const { data, error } = await supabaseAdmin
      .from('notifications')
      .select('id, message, target_role, sender_id, sender_name, created_at, expires_at')
      .eq('school_id', req.schoolId)
      .gt('expires_at', now)
      .or(`target_role.eq.all,target_role.eq.${userRole}`)
      .order('created_at', { ascending: false })

    if (error) throw new Error(error.message)

    const enriched = data.map(n => ({
      ...n,
      expires_in_minutes: Math.max(
        0,
        Math.round((new Date(n.expires_at) - Date.now()) / 60000)
      ),
    }))

    res.json({ notifications: enriched, count: enriched.length })
  } catch (e) {
    fail(res, req, e)
  }
})

router.get('/all', requireRole('teacher', 'admin'), async (req, res) => {
  if (!req.schoolId) return res.status(400).json({ error: 'You are not in a school.' })

  try {
    const { data, error } = await supabaseAdmin
      .from('notifications')
      .select('id, message, target_role, sender_name, created_at, expires_at')
      .eq('school_id', req.schoolId)
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) throw new Error(error.message)

    const now = Date.now()
    const enriched = data.map(n => ({
      ...n,
      expired: new Date(n.expires_at) <= now,
    }))

    res.json({ notifications: enriched, count: enriched.length })
  } catch (e) {
    fail(res, req, e)
  }
})

router.delete('/:id', async (req, res) => {
  try {
    const { data: existing, error: fetchErr } = await supabaseAdmin
      .from('notifications')
      .select('id, sender_id, school_id')
      .eq('id', req.params.id)
      .single()

    if (fetchErr || !existing) return res.status(404).json({ error: 'Notification not found.' })

    if (existing.school_id !== req.schoolId) return res.status(403).json({ error: 'Not your school.' })

    const isOwner = existing.sender_id === req.user.id
    const isAdmin = req.user.role === 'admin'
    if (!isOwner && !isAdmin) return res.status(403).json({ error: 'Only the sender or admin can delete this.' })

    const { error: delErr } = await supabaseAdmin
      .from('notifications')
      .delete()
      .eq('id', req.params.id)

    if (delErr) throw new Error(delErr.message)

    res.json({ message: 'Notification deleted.' })
  } catch (e) {
    fail(res, req, e)
  }
})

export default router
