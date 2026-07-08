/**
 * Dev Email Preview routes.
 *
 *   GET /api/dev/emails                  → index page listing every template
 *   GET /api/dev/emails/:id              → render a template (HTML body)
 *   GET /api/dev/emails/:id?fmt=text     → render the plain-text fallback
 *   GET /api/dev/emails/:id?raw=1        → returns the raw HTML source as text/plain
 *
 * Protected by NODE_ENV — in production these routes return 404 unless
 * `KAIRO_ALLOW_EMAIL_PREVIEW=1` is set. Vercel preview deployments are NOT
 * production, so previews stay browsable on staging.
 *
 * Why this exists:
 *   - Designers iterate on templates without sending real email
 *   - QA can verify rendering on Gmail / Outlook / Apple Mail visually
 *   - CI can diff snapshots of every template's HTML
 */

import { Router } from 'express'
import { PREVIEW, listPreviews, renderPreviewHtml, renderPreviewText } from '../email/preview.js'
import { THEME } from '../email/theme.js'
import { getTransporter, getFromAddress, send } from '../email/transport.js'

const router = Router()

// Production guard — opt-in via env var
function previewAllowed() {
  if (process.env.KAIRO_ALLOW_EMAIL_PREVIEW === '1') return true
  return process.env.NODE_ENV !== 'production'
}

// ── /status — ALWAYS available, even in production ─────────────────────────
// Tells you exactly why the email system isn't sending. Hit this first when
// debugging "no email arrived" issues.
router.get('/status', async (_req, res) => {
  const hasEmail = !!process.env.KAIRO_EMAIL
  const hasPwd   = !!(process.env.KAIRO_EMAIL_APP_PASSWORD || '').replace(/\s+/g, '')
  const t        = getTransporter()

  let verifyResult = null
  let verifyError  = null
  if (t) {
    try {
      // Nodemailer .verify() does an SMTP handshake — confirms the credentials
      // are valid without actually sending mail.
      await t.verify()
      verifyResult = 'ok'
    } catch (e) {
      verifyResult = 'failed'
      verifyError  = e.message
    }
  }

  res.json({
    configured: hasEmail && hasPwd,
    env: {
      KAIRO_EMAIL_set:              hasEmail,
      KAIRO_EMAIL_APP_PASSWORD_set: hasPwd,
      ALLOWED_ORIGIN:               process.env.ALLOWED_ORIGIN || '(not set — will fall back to default)',
    },
    from_address:      getFromAddress(),
    transporter_ready: !!t,
    smtp_verify:       verifyResult,           // 'ok' | 'failed' | null
    smtp_error:        verifyError,            // human-readable error if verify failed
    hint: !hasEmail || !hasPwd
      ? 'Set KAIRO_EMAIL and KAIRO_EMAIL_APP_PASSWORD in Vercel env vars and redeploy.'
      : verifyResult === 'failed'
      ? 'SMTP credentials rejected. The App Password is wrong, expired, or 2FA was disabled. Generate a new App Password at myaccount.google.com → Security → App passwords.'
      : verifyResult === 'ok'
      ? 'All systems go. Hit /api/dev/emails/test-send?to=you@example.com to send a real test email.'
      : 'Transporter not built (config issue).',
  })
})

// ── /test-send — actually attempts to send a real email ────────────────────
// Use this to verify end-to-end delivery: `?to=you@example.com`
// Available in dev / when KAIRO_ALLOW_EMAIL_PREVIEW=1. Otherwise 404.
router.get('/test-send', async (req, res) => {
  if (!previewAllowed()) return res.status(404).json({ error: 'Not found.' })

  const to = (req.query.to || '').toString().trim()
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return res.status(400).json({ error: 'Pass ?to=your-email@example.com' })
  }

  const t = getTransporter()
  if (!t) {
    return res.status(400).json({
      ok:    false,
      error: 'Email is not configured. Check /api/dev/emails/status for details.',
    })
  }

  // Send the welcome-personal template as a real test email
  const sample = PREVIEW['welcome-personal'].sample
  const html   = PREVIEW['welcome-personal'].renderHtml(sample)
  const text   = PREVIEW['welcome-personal'].renderText(sample)

  const info = await send({
    to,
    subject: '[Kora Test] Email system is working',
    html,
    text,
  })

  if (!info) {
    return res.status(500).json({
      ok:    false,
      error: 'Send returned null. Check server logs for the actual SMTP error.',
    })
  }

  res.json({
    ok:          true,
    message:     `Test email sent to ${to}. Check your inbox (and Spam / Promotions).`,
    message_id:  info.messageId,
    accepted:    info.accepted,
    rejected:    info.rejected,
    response:    info.response,
  })
})

router.use((req, res, next) => {
  if (!previewAllowed()) return res.status(404).json({ error: 'Not found.' })
  next()
})

// ── Index page ─────────────────────────────────────────────────────────────
router.get('/', (_req, res) => {
  const items = listPreviews()
  const rows = items.map(p => `
    <a class="card" href="/api/dev/emails/${p.id}" target="_blank">
      <div class="card-id">${p.id}</div>
      <div class="card-label">${p.label}</div>
      <div class="card-actions">
        <span>HTML preview</span>
        <a href="/api/dev/emails/${p.id}?fmt=text" target="_blank" class="alt">Text fallback</a>
        <a href="/api/dev/emails/${p.id}?raw=1" target="_blank" class="alt">View HTML source</a>
      </div>
    </a>
  `).join('')

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.end(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Kora · Email Previews</title>
  <style>
    :root {
      color-scheme: dark;
    }
    body {
      margin: 0;
      padding: 40px 24px 80px;
      font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif;
      background: ${THEME.bg.page};
      background-image:
        radial-gradient(at 10% 0%, rgba(124,58,237,0.12) 0%, transparent 35%),
        radial-gradient(at 90% 100%, rgba(37,99,235,0.10) 0%, transparent 40%);
      color: ${THEME.text.primary};
      min-height: 100vh;
    }
    .wrap {
      max-width: 920px;
      margin: 0 auto;
    }
    h1 {
      font-size: 28px;
      font-weight: 800;
      letter-spacing: -0.5px;
      margin: 0 0 6px;
      background: ${THEME.gradient.cta};
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      display: inline-block;
    }
    .subtitle {
      color: ${THEME.text.muted};
      font-size: 14px;
      margin: 0 0 28px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 14px;
    }
    .card {
      display: block;
      padding: 18px;
      border: 1px solid ${THEME.bg.border};
      border-radius: 14px;
      background: ${THEME.bg.card};
      text-decoration: none;
      color: inherit;
      transition: transform .15s ease, border-color .15s ease, box-shadow .15s ease;
      position: relative;
    }
    .card:hover {
      transform: translateY(-2px);
      border-color: rgba(124,58,237,0.55);
      box-shadow: ${THEME.glow.medium};
    }
    .card-id {
      font-family: ${THEME.font.mono};
      font-size: 11px;
      color: ${THEME.brand.purpleLite};
      text-transform: uppercase;
      letter-spacing: 1.4px;
      margin-bottom: 6px;
    }
    .card-label {
      font-size: 16px;
      font-weight: 700;
      margin-bottom: 14px;
    }
    .card-actions {
      display: flex;
      gap: 12px;
      font-size: 12px;
      color: ${THEME.text.dim};
      flex-wrap: wrap;
    }
    .card-actions span {
      color: ${THEME.brand.purpleLite};
      font-weight: 600;
    }
    .card-actions a.alt {
      color: ${THEME.text.dim};
      text-decoration: underline;
      text-decoration-color: ${THEME.bg.border};
    }
    .card-actions a.alt:hover { color: ${THEME.text.primary}; }
    .hint {
      font-size: 12px;
      color: ${THEME.text.faint};
      margin-top: 36px;
      line-height: 1.7;
    }
    code {
      font-family: ${THEME.font.mono};
      background: rgba(124,58,237,0.10);
      border: 1px solid rgba(124,58,237,0.32);
      padding: 1px 6px;
      border-radius: 4px;
      color: ${THEME.brand.purpleLite};
    }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>Kora · Email Previews</h1>
    <p class="subtitle">
      Every Kora email template, rendered with sample data. Click a card to open the HTML preview in a new tab —
      that's exactly what users receive in Gmail / Apple Mail / Outlook.
    </p>
    <div class="grid">${rows}</div>
    <p class="hint">
      Override sample data by appending query params, e.g.
      <code>?name=Sathya&amp;schoolName=DPS</code>.<br>
      Available in dev by default. In production set
      <code>KAIRO_ALLOW_EMAIL_PREVIEW=1</code> to enable.
    </p>
  </div>
</body>
</html>`)
})

// ── Render a single template ───────────────────────────────────────────────
router.get('/:id', (req, res) => {
  const id = req.params.id
  const preview = PREVIEW[id]
  if (!preview) return res.status(404).json({ error: `Unknown email template id: ${id}` })

  // Build overrides from the query string — string values only, anything that
  // matches one of the sample fields gets overridden.
  const overrides = {}
  for (const [k, v] of Object.entries(req.query || {})) {
    if (k === 'fmt' || k === 'raw') continue
    if (k in preview.sample) overrides[k] = v
  }

  // Plain-text fallback
  if (req.query.fmt === 'text') {
    const text = renderPreviewText(id, overrides) || ''
    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    return res.end(text)
  }

  // View HTML source as text (useful for diffing / pasting into spam-score tools)
  if (req.query.raw === '1') {
    const html = renderPreviewHtml(id, overrides) || ''
    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    return res.end(html)
  }

  // Render the full HTML (what users actually receive)
  const html = renderPreviewHtml(id, overrides)
  if (!html) return res.status(500).json({ error: 'Render failed.' })
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.end(html)
})

export default router
