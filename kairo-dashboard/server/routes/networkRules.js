/**
 * Network Rules (Wi-Fi Restriction) Routes
 *
 * School admins configure CIDR IP ranges. When rules exist, students/teachers
 * must access from a matching network. Admins are always exempt.
 *
 * POST   /api/network-rules          Add a new IP rule (admin only)
 * GET    /api/network-rules          List all rules for your school (admin only)
 * PUT    /api/network-rules/:id      Update a rule (admin only)
 * DELETE /api/network-rules/:id      Delete a rule (admin only)
 * GET    /api/network-rules/check    Check if your current IP is allowed
 */
import { Router } from 'express'
import { supabaseAdmin, requireSupabase }     from '../services/supabase.js'
import { requireSupabaseAuth }                from '../middleware/supabaseAuth.js'
import { requireSchoolAdmin, getClientIp, isIpInRange } from '../middleware/schoolAuth.js'

const router = Router()
router.use(requireSupabase)
router.use(requireSupabaseAuth)

// ── Check current IP ───────────────────────────────────────────────────────────
// Must be defined BEFORE /:id routes to avoid "check" being treated as an ID
router.get('/check', async (req, res) => {
  if (!req.schoolId) return res.status(400).json({ error: 'You are not part of a school.' })

  const clientIp = getClientIp(req)

  try {
    const { data: rules, error } = await supabaseAdmin
      .from('network_rules')
      .select('id, label, cidr, enabled')
      .eq('school_id', req.schoolId)
      .eq('enabled', true)

    if (error) throw new Error(error.message)

    if (!rules || rules.length === 0) {
      return res.json({
        allowed:     true,
        reason:      'No network restrictions configured for this school.',
        client_ip:   clientIp,
        rules_count: 0,
      })
    }

    // Admins always allowed
    if (req.user.role === 'admin') {
      return res.json({
        allowed:   true,
        reason:    'Admin accounts bypass network restrictions.',
        client_ip: clientIp,
      })
    }

    const matchedRule = rules.find(r => isIpInRange(clientIp, r.cidr))

    res.json({
      allowed:      !!matchedRule,
      client_ip:    clientIp,
      matched_rule: matchedRule ? { id: matchedRule.id, label: matchedRule.label, cidr: matchedRule.cidr } : null,
      rules_count:  rules.length,
      reason:       matchedRule
        ? `Matched rule: ${matchedRule.label} (${matchedRule.cidr})`
        : 'Your IP does not match any allowed network.',
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── Add Rule ───────────────────────────────────────────────────────────────────
router.post('/', requireSchoolAdmin, async (req, res) => {
  const { label, cidr, enabled = true } = req.body

  if (!label) return res.status(400).json({ error: 'label is required.' })
  if (!cidr)  return res.status(400).json({ error: 'cidr is required (e.g. "192.168.1.0/24" or "203.0.113.5/32").' })
  if (!req.schoolId) return res.status(400).json({ error: 'You are not part of a school.' })

  // Basic CIDR format validation
  if (!isValidCidr(cidr)) {
    return res.status(400).json({
      error: `Invalid CIDR format: "${cidr}". Expected format: "192.168.1.0/24" or "203.0.113.5/32".`,
    })
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('network_rules')
      .insert({
        school_id:  req.schoolId,
        label:      label.trim(),
        cidr:       cidr.trim(),
        enabled:    !!enabled,
        created_by: req.user.id,
      })
      .select('*')
      .single()

    if (error) throw new Error(error.message)

    console.log(`[NetworkRules] ✓ Added rule: ${label} (${cidr}) for school ${req.schoolId}`)
    res.status(201).json({ message: 'Network rule added.', rule: data })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── List Rules ─────────────────────────────────────────────────────────────────
router.get('/', requireSchoolAdmin, async (req, res) => {
  if (!req.schoolId) return res.status(400).json({ error: 'You are not part of a school.' })

  try {
    const { data, error } = await supabaseAdmin
      .from('network_rules')
      .select(`
        id, label, cidr, enabled, created_at,
        creator:users!network_rules_created_by_fkey(id, name)
      `)
      .eq('school_id', req.schoolId)
      .order('created_at', { ascending: true })

    if (error) throw new Error(error.message)

    const clientIp = getClientIp(req)
    const enabledRules = data.filter(r => r.enabled)

    res.json({
      school_id:    req.schoolId,
      rules:        data,
      count:        data.length,
      enabled_count: enabledRules.length,
      your_ip:      clientIp,
      your_ip_allowed: enabledRules.length === 0 || enabledRules.some(r => isIpInRange(clientIp, r.cidr)),
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── Update Rule ────────────────────────────────────────────────────────────────
router.put('/:id', requireSchoolAdmin, async (req, res) => {
  if (!req.schoolId) return res.status(400).json({ error: 'You are not part of a school.' })

  try {
    const { data: existing } = await supabaseAdmin
      .from('network_rules')
      .select('id, school_id')
      .eq('id', req.params.id)
      .single()

    if (!existing)                          return res.status(404).json({ error: 'Rule not found.' })
    if (existing.school_id !== req.schoolId) return res.status(403).json({ error: 'Not your school.' })

    const { label, cidr, enabled } = req.body
    const updates = {}

    if (label !== undefined)   updates.label   = label.trim()
    if (cidr  !== undefined) {
      if (!isValidCidr(cidr)) return res.status(400).json({ error: `Invalid CIDR: "${cidr}".` })
      updates.cidr = cidr.trim()
    }
    if (enabled !== undefined) updates.enabled = !!enabled

    if (!Object.keys(updates).length) return res.status(400).json({ error: 'Nothing to update.' })

    const { data, error } = await supabaseAdmin
      .from('network_rules')
      .update(updates)
      .eq('id', req.params.id)
      .select('*')
      .single()

    if (error) throw new Error(error.message)
    res.json({ message: 'Rule updated.', rule: data })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── Delete Rule ────────────────────────────────────────────────────────────────
router.delete('/:id', requireSchoolAdmin, async (req, res) => {
  if (!req.schoolId) return res.status(400).json({ error: 'You are not part of a school.' })

  try {
    const { data: existing } = await supabaseAdmin
      .from('network_rules')
      .select('id, school_id, label')
      .eq('id', req.params.id)
      .single()

    if (!existing)                          return res.status(404).json({ error: 'Rule not found.' })
    if (existing.school_id !== req.schoolId) return res.status(403).json({ error: 'Not your school.' })

    const { error } = await supabaseAdmin
      .from('network_rules')
      .delete()
      .eq('id', req.params.id)

    if (error) throw new Error(error.message)

    console.log(`[NetworkRules] 🗑 Deleted rule: ${existing.label} (${req.params.id})`)
    res.json({ message: `Rule "${existing.label}" deleted.` })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── Helpers ────────────────────────────────────────────────────────────────────
function isValidCidr(cidr) {
  // Matches "a.b.c.d/n" where a-d are 0-255 and n is 0-32
  return /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/.test(cidr.trim())
}

export default router
