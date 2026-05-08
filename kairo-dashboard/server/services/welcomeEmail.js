/**
 * Welcome email service — uses Kairo's platform Gmail (not per-school).
 *
 * Triggered automatically by:
 *   - usersV2.js /register      → joinedSchoolEmail()
 *   - schools.js /register      → schoolCreatedEmail()
 *   - schools.js /approve/:id   → approvedEmail()
 *   - parent.js /register       → parentLinkedEmail()
 *
 * Env vars required (set in Vercel):
 *   KAIRO_EMAIL              the platform Gmail address (e.g. quro.cor@gmail.com)
 *   KAIRO_EMAIL_APP_PASSWORD 16-char Gmail App Password (no spaces)
 *
 * If env vars are missing the service silently no-ops so signups still work.
 */
import nodemailer from 'nodemailer'

const FROM_EMAIL = process.env.KAIRO_EMAIL
const APP_PWD    = (process.env.KAIRO_EMAIL_APP_PASSWORD || '').replace(/\s+/g, '')
const APP_URL    = process.env.ALLOWED_ORIGIN || 'https://kairo-daily-edu.vercel.app'

let transporter = null
function tx() {
  if (transporter) return transporter
  if (!FROM_EMAIL || !APP_PWD) return null
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: FROM_EMAIL, pass: APP_PWD },
  })
  return transporter
}

// ─── Send wrapper — fire-and-forget, never throws upstream ──────────────────
async function send(to, subject, html, text) {
  const t = tx()
  if (!t) {
    console.warn('[welcomeEmail] KAIRO_EMAIL not configured — skipping:', subject)
    return null
  }
  if (!to) return null
  try {
    const info = await t.sendMail({
      from: `"Kairo · Accelerate Your Academics" <${FROM_EMAIL}>`,
      to, subject, html, text,
    })
    console.log(`[welcomeEmail] ✓ ${subject} → ${to} (${info.messageId})`)
    return info
  } catch (err) {
    console.error('[welcomeEmail] FAILED:', err.message)
    return null
  }
}

// ─── Shared base template ───────────────────────────────────────────────────
function shell({ preheader, accentEmoji, heroTitle, heroSubtitle, body, cta, footer }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${heroTitle}</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#fafafa;">
  <span style="display:none;font-size:1px;color:#0a0a0a;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
    ${preheader}
  </span>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0a0a0a;">
    <tr>
      <td align="center" style="padding:40px 16px;">

        <!-- Card -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
          style="max-width:560px;background:#111;border:1px solid #1e1e1e;border-radius:18px;overflow:hidden;">

          <!-- Hero gradient strip -->
          <tr>
            <td style="background:linear-gradient(135deg,#6366f1,#7c3aed);padding:40px 32px;text-align:center;">
              <div style="font-size:48px;line-height:1;margin-bottom:8px;">${accentEmoji}</div>
              <h1 style="margin:0;font-size:28px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;line-height:1.2;">
                ${heroTitle}
              </h1>
              <p style="margin:10px 0 0;font-size:14px;color:rgba(255,255,255,0.85);font-weight:500;">
                ${heroSubtitle}
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 32px 28px;">
              ${body}
              ${cta ? `
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px auto 0;">
                  <tr>
                    <td style="border-radius:11px;background:linear-gradient(135deg,#6366f1,#7c3aed);">
                      <a href="${cta.href}" target="_blank"
                        style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:11px;">
                        ${cta.label} →
                      </a>
                    </td>
                  </tr>
                </table>
              ` : ''}
            </td>
          </tr>

          <!-- Footer in-card -->
          <tr>
            <td style="padding:20px 32px;border-top:1px solid #1e1e1e;background:#0d0d0d;">
              <p style="margin:0;font-size:11px;color:#52525b;line-height:1.6;text-align:center;">
                ${footer || 'You\'re receiving this because you signed up for Kairo.'}
              </p>
            </td>
          </tr>
        </table>

        <!-- Brand strip -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
          style="max-width:560px;margin-top:18px;">
          <tr>
            <td align="center" style="padding:14px 0;">
              <p style="margin:0;font-size:11px;color:#3f3f46;letter-spacing:2px;text-transform:uppercase;font-weight:600;">
                kairo · accelerate your academics
              </p>
              <p style="margin:6px 0 0;font-size:10px;color:#3f3f46;">
                © ${new Date().getFullYear()} Kairo. Built for Indian classrooms.
              </p>
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>
</body>
</html>`
}

// ─── 1. Joined school (student / teacher) ───────────────────────────────────
export function joinedSchoolEmail({ to, name, role, schoolName, requireApproval }) {
  const subject = `Welcome to ${schoolName} · Kairo`
  const cap = role.charAt(0).toUpperCase() + role.slice(1)

  const body = `
    <p style="margin:0 0 16px;font-size:16px;color:#fafafa;line-height:1.6;">
      Hey <strong style="color:#a5b4fc;">${name}</strong>,
    </p>
    <p style="margin:0 0 16px;font-size:15px;color:#d4d4d8;line-height:1.7;">
      You're now part of <strong style="color:#fafafa;">${schoolName}</strong> on Kairo as a <strong style="color:#a5b4fc;">${role}</strong>. 🎉
    </p>
    ${requireApproval && role === 'student' ? `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
        style="background:rgba(251,191,36,0.06);border:1px solid rgba(251,191,36,0.25);border-radius:10px;margin:14px 0;">
        <tr>
          <td style="padding:12px 14px;">
            <p style="margin:0;font-size:12px;color:#fbbf24;font-weight:600;text-transform:uppercase;letter-spacing:1px;">
              ⏳ Awaiting admin approval
            </p>
            <p style="margin:6px 0 0;font-size:13px;color:#a1a1aa;line-height:1.6;">
              Your school admin will approve your account shortly. We'll email you the moment it's ready.
            </p>
          </td>
        </tr>
      </table>
    ` : `
      <p style="margin:0 0 16px;font-size:14px;color:#a1a1aa;line-height:1.7;">
        Your account is <strong style="color:#34d399;">active right now</strong>. Sign in and start using everything Kairo has to offer.
      </p>
    `}
    <p style="margin:18px 0 6px;font-size:13px;color:#71717a;font-weight:600;text-transform:uppercase;letter-spacing:1px;">
      What you can do as a ${cap}
    </p>
    <ul style="margin:0;padding-left:20px;color:#d4d4d8;font-size:14px;line-height:1.9;">
      ${role === 'student' ? `
        <li>Ask any doubt — AI tutor that remembers your weak topics</li>
        <li>Snap homework photos for instant explanations</li>
        <li>Daily Battle Mode + Revision Simulator for practice</li>
        <li>Smart Timetable that adapts as you learn</li>
      ` : role === 'teacher' ? `
        <li>AI Teacher Assistant — generates lesson plans, quizzes, flashcards in one click</li>
        <li>Grader: paste any answer, get structured feedback</li>
        <li>Track student marks + flag at-risk students</li>
        <li>Send announcements with the AI announcement generator</li>
      ` : `
        <li>View your child's marks and performance trends</li>
        <li>AI-generated insights on strong and weak subjects</li>
      `}
    </ul>
  `

  const html = shell({
    preheader: `Welcome to ${schoolName} on Kairo, ${name}.`,
    accentEmoji: '🎓',
    heroTitle: `Welcome to ${schoolName}`,
    heroSubtitle: `You're in. Let's get to work.`,
    body, cta: { href: APP_URL, label: 'Open Kairo' },
    footer: `Joined as ${role} · ${schoolName}`,
  })
  const text = `Welcome to ${schoolName} on Kairo, ${name}!\n\nYou're in as a ${role}.\n${requireApproval && role === 'student' ? 'Your account is awaiting admin approval.\n' : ''}\nOpen Kairo: ${APP_URL}`
  return send(to, subject, html, text)
}

// ─── 2. School created (admin) ──────────────────────────────────────────────
export function schoolCreatedEmail({ to, name, schoolName, joinCode, plan, trial }) {
  const subject = `${schoolName} is live on Kairo`
  const body = `
    <p style="margin:0 0 16px;font-size:16px;color:#fafafa;line-height:1.6;">
      Hey <strong style="color:#a5b4fc;">${name}</strong>,
    </p>
    <p style="margin:0 0 16px;font-size:15px;color:#d4d4d8;line-height:1.7;">
      <strong style="color:#fafafa;">${schoolName}</strong> is now live on Kairo. You're the admin. 🛡️
    </p>

    <p style="margin:18px 0 8px;font-size:11px;color:#71717a;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;">
      Your school join code
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
      style="background:rgba(99,102,241,0.08);border:1px solid rgba(99,102,241,0.3);border-radius:11px;margin-bottom:18px;">
      <tr>
        <td style="padding:18px;text-align:center;">
          <code style="font-family:'Consolas','Monaco',monospace;font-size:22px;font-weight:800;color:#fafafa;letter-spacing:3px;">
            ${joinCode}
          </code>
          <p style="margin:8px 0 0;font-size:11px;color:#a5b4fc;font-weight:600;letter-spacing:0.8px;">
            Share this with your teachers and students
          </p>
        </td>
      </tr>
    </table>

    ${trial ? `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
        style="background:rgba(52,211,153,0.06);border:1px solid rgba(52,211,153,0.3);border-radius:10px;margin:14px 0;">
        <tr>
          <td style="padding:12px 14px;">
            <p style="margin:0;font-size:12px;color:#34d399;font-weight:600;text-transform:uppercase;letter-spacing:1px;">
              ✓ 14-day free trial active
            </p>
            <p style="margin:6px 0 0;font-size:13px;color:#a1a1aa;line-height:1.6;">
              Add payment from Settings before the trial ends to keep your school running.
            </p>
          </td>
        </tr>
      </table>
    ` : `
      <p style="margin:0 0 14px;font-size:13px;color:#a1a1aa;line-height:1.6;">
        Plan: <strong style="color:#fafafa;text-transform:capitalize;">${plan}</strong>
      </p>
    `}

    <p style="margin:18px 0 6px;font-size:13px;color:#71717a;font-weight:600;text-transform:uppercase;letter-spacing:1px;">
      Your next steps
    </p>
    <ol style="margin:0;padding-left:20px;color:#d4d4d8;font-size:14px;line-height:1.9;">
      <li>Share the join code above with your teachers and students</li>
      <li>Set up your admission bot configuration in School Hub → Admission</li>
      <li>Customize school details and require-approval rules in Settings</li>
      <li>Send your first announcement using the AI Announcement Generator</li>
    </ol>
  `
  const html = shell({
    preheader: `${schoolName} is live. Your join code: ${joinCode}`,
    accentEmoji: '🛡️',
    heroTitle: `${schoolName} is live`,
    heroSubtitle: 'You\'re the admin. Welcome to the control center.',
    body, cta: { href: APP_URL, label: 'Open Admin Dashboard' },
    footer: `Admin · ${schoolName} · Save the join code somewhere safe`,
  })
  const text = `${schoolName} is live on Kairo!\n\nYou're the admin.\nJoin code: ${joinCode}\nShare this with your teachers and students.\n\nOpen Kairo: ${APP_URL}`
  return send(to, subject, html, text)
}

// ─── 3. Account approved ────────────────────────────────────────────────────
export function approvedEmail({ to, name, schoolName, role }) {
  const subject = `You're approved · ${schoolName}`
  const body = `
    <p style="margin:0 0 16px;font-size:16px;color:#fafafa;line-height:1.6;">
      Hey <strong style="color:#a5b4fc;">${name}</strong>,
    </p>
    <p style="margin:0 0 16px;font-size:15px;color:#d4d4d8;line-height:1.7;">
      Good news — your <strong style="color:#34d399;">${role}</strong> account at <strong style="color:#fafafa;">${schoolName}</strong> has just been approved. You can sign in now and start using Kairo. ✨
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
      style="background:rgba(52,211,153,0.06);border:1px solid rgba(52,211,153,0.3);border-radius:10px;margin:14px 0;">
      <tr>
        <td style="padding:14px 16px;">
          <p style="margin:0;font-size:12px;color:#34d399;font-weight:700;text-transform:uppercase;letter-spacing:1px;">
            ✓ Account active
          </p>
          <p style="margin:6px 0 0;font-size:13px;color:#a1a1aa;line-height:1.6;">
            Every Kairo feature is now unlocked for you.
          </p>
        </td>
      </tr>
    </table>
  `
  const html = shell({
    preheader: `Your Kairo account at ${schoolName} is approved.`,
    accentEmoji: '✨',
    heroTitle: 'You\'re approved',
    heroSubtitle: `Welcome aboard at ${schoolName}.`,
    body, cta: { href: APP_URL, label: 'Sign in to Kairo' },
    footer: `${role} · ${schoolName}`,
  })
  const text = `Hey ${name}, your ${role} account at ${schoolName} is approved.\n\nSign in: ${APP_URL}`
  return send(to, subject, html, text)
}

// ─── 4. Parent linked ───────────────────────────────────────────────────────
export function parentLinkedEmail({ to, name, studentName, schoolName }) {
  const subject = `You're linked to ${studentName}'s progress`
  const body = `
    <p style="margin:0 0 16px;font-size:16px;color:#fafafa;line-height:1.6;">
      Hey <strong style="color:#a5b4fc;">${name}</strong>,
    </p>
    <p style="margin:0 0 16px;font-size:15px;color:#d4d4d8;line-height:1.7;">
      You're now linked to <strong style="color:#fafafa;">${studentName}</strong>'s academic progress at <strong>${schoolName}</strong>. 👨‍👩‍👧
    </p>
    <p style="margin:16px 0;font-size:14px;color:#a1a1aa;line-height:1.7;">
      Your parent dashboard shows you:
    </p>
    <ul style="margin:0;padding-left:20px;color:#d4d4d8;font-size:14px;line-height:1.9;">
      <li>All marks across subjects</li>
      <li>Performance trends and grade letters</li>
      <li>Strong and weak subject panels</li>
      <li>AI-generated performance insights</li>
    </ul>
    <p style="margin:18px 0 0;font-size:12px;color:#71717a;line-height:1.6;font-style:italic;">
      You won't see homework, AI tools, or other student systems — your dashboard is purpose-built for tracking marks only.
    </p>
  `
  const html = shell({
    preheader: `Your parent account is linked to ${studentName}.`,
    accentEmoji: '👨‍👩‍👧',
    heroTitle: 'You\'re all set',
    heroSubtitle: `Linked to ${studentName} at ${schoolName}.`,
    body, cta: { href: APP_URL, label: 'Open Parent Dashboard' },
    footer: `Parent · linked to ${studentName}`,
  })
  const text = `Hey ${name}, you're now linked to ${studentName}'s progress at ${schoolName}.\n\nOpen Kairo: ${APP_URL}`
  return send(to, subject, html, text)
}

export default {
  joinedSchoolEmail,
  schoolCreatedEmail,
  approvedEmail,
  parentLinkedEmail,
}
