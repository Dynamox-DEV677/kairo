/**
 * Payment + Subscription backend for school activation.
 *
 *   POST /api/payments/create-session   Create a checkout session for a school
 *   POST /api/payments/webhook          Provider webhook (Razorpay/Stripe sig-verified)
 *   GET  /api/payments/status           Current school subscription state
 *
 * Provider abstraction:
 *   - If RAZORPAY_KEY_ID + RAZORPAY_KEY_SECRET are set → real Razorpay flow
 *   - Else → "demo mode" that auto-activates 3 seconds after session creation
 *     (lets us build/test the frontend without real keys)
 *
 * Subscription states stored on schools.subscription_status:
 *   pending_payment / trial / active / canceled / expired / inactive
 *
 * The webhook is the source of truth — we NEVER trust frontend "payment success"
 * callbacks. The frontend redirects after checkout; the webhook actually flips status.
 */
import { Router } from 'express'
import crypto from 'crypto'
import { supabaseAdmin, requireSupabase } from '../services/supabase.js'
import { requireSupabaseAuth, requireRole } from '../middleware/supabaseAuth.js'

const router = Router()
router.use(requireSupabase)

// ─── Plan definitions (server-side source of truth, never trust frontend price) ─
const PLANS = {
  monthly: { code: 'monthly',  label: 'Monthly',  amount_inr: 199900,  interval_days: 30,  description: '₹1,999 / month' },
  yearly:  { code: 'yearly',   label: 'Yearly',   amount_inr: 1999900, interval_days: 365, description: '₹19,999 / year (save 17%)' },
  trial:   { code: 'trial',    label: '14-day trial', amount_inr: 0,    interval_days: 14,  description: 'Free for 14 days' },
}

const RAZORPAY_KEY_ID     = process.env.RAZORPAY_KEY_ID
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET
const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET
const DEMO_MODE = !RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET

if (DEMO_MODE) {
  console.warn('⚠️  Payments running in DEMO MODE — set RAZORPAY_KEY_ID + RAZORPAY_KEY_SECRET for live payments.')
}

// ─── Razorpay HTTP helper (no SDK dep — direct REST call) ─────────────────────
async function razorpayCall(method, path, body) {
  const auth = Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64')
  const res = await fetch(`https://api.razorpay.com/v1${path}`, {
    method,
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type':  'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.error?.description || `Razorpay ${res.status}`)
  return data
}

// ════════════════════════════════════════════════════════════════════════════
// POST /create-session — create a checkout session for the caller's school
// ════════════════════════════════════════════════════════════════════════════
router.post('/create-session', requireSupabaseAuth, requireRole('admin'), async (req, res) => {
  const { plan = 'monthly' } = req.body || {}
  const planDef = PLANS[plan]
  if (!planDef) return res.status(400).json({ error: `Unknown plan. Available: ${Object.keys(PLANS).join(', ')}` })

  if (!req.schoolId) return res.status(400).json({ error: 'You are not associated with a school.' })

  try {
    // Pull school + verify ownership
    const { data: school, error: scErr } = await supabaseAdmin
      .from('schools')
      .select('id, school_name, school_email, owner_id, subscription_status')
      .eq('id', req.schoolId)
      .single()
    if (scErr || !school) return res.status(404).json({ error: 'School not found.' })

    // Already active? Don't create another session.
    if (school.subscription_status === 'active') {
      return res.status(409).json({ error: 'Subscription is already active.', status: 'active' })
    }

    // ── Trial path — instant activation, no payment ──
    if (plan === 'trial') {
      const trialEnds = new Date(Date.now() + planDef.interval_days * 24 * 60 * 60 * 1000).toISOString()
      const { error: upErr } = await supabaseAdmin
        .from('schools')
        .update({
          subscription_plan:   'trial',
          subscription_status: 'trial',
          trial_ends_at:       trialEnds,
          status:              'active',
        })
        .eq('id', school.id)
      if (upErr) throw new Error(upErr.message)
      return res.json({ mode: 'trial', message: 'Trial activated.', trial_ends_at: trialEnds })
    }

    // ── Demo mode — fake session, auto-activate via setTimeout ──
    if (DEMO_MODE) {
      const fakeSessionId = `demo_${crypto.randomBytes(8).toString('hex')}`
      // In-process timer pretends webhook fires after 3s
      setTimeout(async () => {
        await activateSchool(school.id, plan, fakeSessionId, fakeSessionId).catch(e => console.error('[demo activation]', e))
      }, 3000)
      return res.json({
        mode:        'demo',
        session_id:  fakeSessionId,
        checkout_url: null,
        plan:        planDef,
        message:     'Demo mode — school will auto-activate in ~3 seconds. Set RAZORPAY_KEY_ID for live payments.',
      })
    }

    // ── Real Razorpay path ──
    // 1. Create or fetch a customer
    let customerId = null
    if (school.school_email) {
      try {
        const cust = await razorpayCall('POST', '/customers', {
          name:    school.school_name,
          email:   school.school_email,
          fail_existing: '0',
          notes:   { school_id: school.id },
        })
        customerId = cust.id
      } catch (e) {
        // Razorpay returns 400 "customer exists" if the email is taken — that's fine
        console.warn('[razorpay] customer create:', e.message)
      }
    }

    // 2. Create an order (one-time payment) or subscription.
    // For simplicity start with order; switch to subscriptions when recurring is needed.
    const order = await razorpayCall('POST', '/orders', {
      amount:   planDef.amount_inr,
      currency: 'INR',
      receipt:  `school_${school.id}_${Date.now()}`.slice(0, 40),
      notes: {
        school_id: school.id,
        plan:      plan,
        owner_id:  school.owner_id || '',
      },
    })

    // 3. Persist pending payment intent on the school
    await supabaseAdmin
      .from('schools')
      .update({
        subscription_plan:       plan,
        subscription_status:     'pending_payment',
        payment_customer_id:     customerId,
        payment_subscription_id: order.id,
      })
      .eq('id', school.id)

    res.json({
      mode:           'razorpay',
      order_id:       order.id,
      amount:         order.amount,
      currency:       order.currency,
      key_id:         RAZORPAY_KEY_ID,        // safe — public key
      customer_id:    customerId,
      plan:           planDef,
      school_name:    school.school_name,
      school_email:   school.school_email,
    })
  } catch (e) {
    console.error('[payments/create-session]', e.message)
    res.status(500).json({ error: e.message })
  }
})

// ════════════════════════════════════════════════════════════════════════════
// POST /webhook — provider sends payment events here
// ════════════════════════════════════════════════════════════════════════════
// IMPORTANT: this route must NOT use the JSON body parser before signature
// verification, or the raw body needed for HMAC won't be available.
// We re-read the raw body via Buffer.from(JSON.stringify(req.body)) which is
// not ideal — production should mount express.raw() before this route.
router.post('/webhook', async (req, res) => {
  if (DEMO_MODE) return res.json({ ok: true, mode: 'demo' })

  const signature = req.headers['x-razorpay-signature']
  if (!signature || !RAZORPAY_WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'Missing signature or webhook secret not configured.' })
  }

  // Verify HMAC SHA256
  const rawBody = JSON.stringify(req.body)
  const expected = crypto
    .createHmac('sha256', RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex')

  if (expected !== signature) {
    console.warn('[webhook] signature mismatch')
    return res.status(401).json({ error: 'Invalid signature.' })
  }

  const event   = req.body?.event
  const payload = req.body?.payload || {}

  try {
    switch (event) {
      case 'payment.captured':
      case 'order.paid': {
        const order = payload.order?.entity || payload.payment?.entity?.order_id
        const orderId = typeof order === 'string' ? order : order?.id
        const paymentId = payload.payment?.entity?.id
        const schoolId = payload.payment?.entity?.notes?.school_id || payload.order?.entity?.notes?.school_id
        const plan     = payload.payment?.entity?.notes?.plan     || payload.order?.entity?.notes?.plan || 'monthly'
        if (!schoolId) {
          console.warn('[webhook] no school_id in notes')
          return res.json({ ok: true, ignored: 'no school_id' })
        }
        await activateSchool(schoolId, plan, paymentId, orderId)
        break
      }

      case 'payment.failed': {
        const schoolId = payload.payment?.entity?.notes?.school_id
        if (schoolId) {
          await supabaseAdmin
            .from('schools')
            .update({ subscription_status: 'pending_payment' })
            .eq('id', schoolId)
        }
        break
      }

      case 'subscription.cancelled': {
        const subId = payload.subscription?.entity?.id
        if (subId) {
          await supabaseAdmin
            .from('schools')
            .update({ subscription_status: 'canceled' })
            .eq('payment_subscription_id', subId)
        }
        break
      }

      default:
        // Unhandled event types are fine — Razorpay sends many we don't care about
        break
    }

    res.json({ ok: true, event })
  } catch (e) {
    console.error('[webhook]', e.message)
    res.status(500).json({ error: e.message })
  }
})

// ════════════════════════════════════════════════════════════════════════════
// GET /status — current school's subscription status
// ════════════════════════════════════════════════════════════════════════════
router.get('/status', requireSupabaseAuth, async (req, res) => {
  if (!req.schoolId) return res.json({ status: 'inactive', reason: 'No school' })

  try {
    const { data, error } = await supabaseAdmin
      .from('schools')
      .select('subscription_plan, subscription_status, trial_ends_at, status, school_name')
      .eq('id', req.schoolId)
      .single()
    if (error) throw new Error(error.message)

    const trialActive = data.trial_ends_at && new Date(data.trial_ends_at) > new Date()
    const expired     = data.trial_ends_at && new Date(data.trial_ends_at) < new Date() && data.subscription_status === 'trial'

    res.json({
      school_name:         data.school_name,
      plan:                data.subscription_plan || null,
      status:              expired ? 'expired' : (data.subscription_status || 'inactive'),
      school_status:       data.status,                 // 'active' | 'pending_payment' | 'inactive'
      trial_ends_at:       data.trial_ends_at,
      trial_active:        !!trialActive,
      available_plans:     Object.values(PLANS),
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ════════════════════════════════════════════════════════════════════════════
// Helper — activate a school (used by webhook + demo timer)
// ════════════════════════════════════════════════════════════════════════════
async function activateSchool(schoolId, plan, paymentId, orderId) {
  const planDef = PLANS[plan] || PLANS.monthly
  const expiresAt = new Date(Date.now() + planDef.interval_days * 24 * 60 * 60 * 1000).toISOString()

  const { error } = await supabaseAdmin
    .from('schools')
    .update({
      subscription_plan:       plan,
      subscription_status:     'active',
      status:                  'active',
      payment_subscription_id: orderId || paymentId,
      trial_ends_at:           expiresAt,    // re-used as next-renewal-due
    })
    .eq('id', schoolId)

  if (error) throw new Error(error.message)
  console.log(`[payments] ✓ School ${schoolId} activated on ${plan} until ${expiresAt}`)
}

export default router
