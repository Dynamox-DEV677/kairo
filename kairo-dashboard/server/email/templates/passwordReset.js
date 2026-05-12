/**
 * Password Reset — secure one-time reset link.
 *
 * Variables: { name, resetUrl, expiresInMinutes, ip, userAgent }
 *
 *   resetUrl — fully-built URL that includes the one-time token as a query
 *              param, e.g. `${appUrl()}/reset-password?token=xxx`
 */
import { THEME, formatTimestamp } from '../theme.js'
import { shell } from '../shell.js'
import {
  hero, intro, infoCard, button, dataPanel, divider, escapeHtml,
} from '../components.js'
import { send } from '../transport.js'

export function renderPasswordResetHtml({
  name, resetUrl,
  expiresInMinutes = 30,
  ip, userAgent, time,
}) {
  const safeName = escapeHtml(name || 'there')
  const safeUrl  = escapeHtml(resetUrl)
  const when     = formatTimestamp(time || new Date())

  const body = [
    intro({
      greeting: `Hey <span style="color:${THEME.brand.purpleLite};font-weight:700;">${safeName}</span>,`,
      lead: `Someone — probably you — requested a password reset for your Kairo account. Click the button below to set a new password.`,
    }),
    button({ href: resetUrl, label: 'Reset your password' }),
    infoCard({
      kind: 'warning',
      title: `Link expires in ${expiresInMinutes} minutes`,
      body: `For security the link works only once. If it expires, request a new reset email from the sign-in page.`,
    }),
    dataPanel({
      title: 'Request details',
      rows: [
        { label: 'Time',     value: when },
        { label: 'IP',       value: escapeHtml(ip || '—') },
        { label: 'Device',   value: escapeHtml(userAgent ? userAgent.slice(0, 60) : '—') },
      ],
    }),
    divider(),
    `<p style="margin:8px 0 14px;font-family:${THEME.font.family};font-size:13px;color:${THEME.text.muted};line-height:1.7;">
       <strong style="color:${THEME.text.primary};">Didn't request this?</strong>
       Ignore this email. Your password stays as it is, and the link will expire on its own.
       If you start seeing reset emails you didn't request, write to us — we'll lock down your account.
     </p>`,
    `<p style="margin:14px 0 0;font-family:${THEME.font.family};font-size:11.5px;color:${THEME.text.dim};line-height:1.7;word-break:break-all;">
       Or paste this link in your browser:<br>
       <a href="${safeUrl}" target="_blank" style="color:${THEME.brand.purpleLite};text-decoration:underline;word-break:break-all;">${safeUrl}</a>
     </p>`,
  ].join('')

  return shell({
    title:     'Reset your Kairo password',
    preheader: `Reset your password — link expires in ${expiresInMinutes} minutes.`,
    hero: hero({
      title:    `Reset your password`,
      subtitle: `Use the link below to set a new password securely.`,
      accent:   '🔐',
    }),
    body,
    footerNote: 'Security · password reset',
  })
}

export function renderPasswordResetText({ name, resetUrl, expiresInMinutes = 30, ip, userAgent, time }) {
  const when = formatTimestamp(time || new Date())
  return [
    `Hey ${name || 'there'},`,
    ``,
    `Someone requested a password reset for your Kairo account.`,
    `Click the link below to set a new password (expires in ${expiresInMinutes} minutes):`,
    ``,
    resetUrl,
    ``,
    `Request details:`,
    `  Time:   ${when}`,
    `  IP:     ${ip || '—'}`,
    `  Device: ${(userAgent || '—').slice(0, 80)}`,
    ``,
    `Didn't request this? Ignore the email — the link will expire on its own.`,
    ``,
    `— Kairo Security`,
  ].join('\n')
}

export function sendPasswordResetEmail({ to, name, resetUrl, expiresInMinutes, ip, userAgent, time }) {
  return send({
    to,
    subject: 'Reset your Kairo password',
    html:    renderPasswordResetHtml({ name, resetUrl, expiresInMinutes, ip, userAgent, time }),
    text:    renderPasswordResetText({ name, resetUrl, expiresInMinutes, ip, userAgent, time }),
  })
}
