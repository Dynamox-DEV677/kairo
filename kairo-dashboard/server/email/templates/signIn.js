/**
 * Sign-in security alert — sent when a user logs in successfully.
 *
 * Variables: { name, deviceLabel, ip, location, time }
 *
 *   deviceLabel — best-effort from User-Agent (e.g. "Chrome on Windows")
 *   ip          — client IP (optional)
 *   location    — best-effort geo (e.g. "Mumbai, IN") or null
 *   time        — Date object or ISO string
 */
import { THEME, appUrl, formatTimestamp } from '../theme.js'
import { shell } from '../shell.js'
import {
  hero, intro, infoCard, button, dataPanel, divider, escapeHtml,
} from '../components.js'
import { send } from '../transport.js'

function parseDevice(userAgent = '') {
  if (!userAgent) return 'Unknown device'
  const ua = userAgent
  // Cheap user-agent sniff. Good enough for an email summary line.
  const browser =
    /Edg\//.test(ua)         ? 'Edge' :
    /Chrome\//.test(ua)      ? 'Chrome' :
    /Firefox\//.test(ua)     ? 'Firefox' :
    /Safari\//.test(ua)      ? 'Safari' :
    /Opera|OPR\//.test(ua)   ? 'Opera' :
    'Browser'
  const os =
    /Windows NT/.test(ua)    ? 'Windows' :
    /Mac OS X/.test(ua)      ? 'macOS' :
    /Android/.test(ua)       ? 'Android' :
    /iPhone|iPad|iOS/.test(ua) ? 'iOS' :
    /Linux/.test(ua)         ? 'Linux' :
    'Unknown OS'
  return `${browser} on ${os}`
}

export function renderSignInHtml({ name, userAgent, deviceLabel, ip, location, time }) {
  const safeName = escapeHtml(name || 'there')
  const device   = escapeHtml(deviceLabel || parseDevice(userAgent))
  const ipShown  = ip ? escapeHtml(ip) : '—'
  const loc      = location ? escapeHtml(location) : null
  const when     = formatTimestamp(time || new Date())

  const rows = [
    { label: 'Time',     value: when },
    { label: 'Device',   value: device },
    { label: 'IP address', value: ipShown },
  ]
  if (loc) rows.push({ label: 'Approx. location', value: loc })

  const body = [
    intro({
      greeting: `Hey <span style="color:${THEME.brand.purpleLite};font-weight:700;">${safeName}</span>,`,
      lead: `A new sign-in to your Kairo account was just recorded. If this was you, you're good — there's nothing to do.`,
    }),
    dataPanel({ title: 'Sign-in details', rows }),
    infoCard({
      kind: 'danger',
      title: 'If this wasn\'t you',
      body: `Reset your password right now and revoke active sessions from Settings → Security. Then write to us — we'll lock down your account.`,
    }),
    button({ href: `${appUrl()}/settings/security`, label: 'Review security' }),
    divider(),
    `<p style="margin:8px 0 0;font-family:${THEME.font.family};font-size:11.5px;color:${THEME.text.dim};line-height:1.65;text-align:center;">
       We send a sign-in email every time someone logs in to your account.
       This is your early-warning system.
     </p>`,
  ].join('')

  return shell({
    title:     'New sign-in to your Kairo account',
    preheader: `New sign-in detected · ${device} · ${when}`,
    hero: hero({
      title:    'New sign-in detected',
      subtitle: `${device} · ${when}`,
      accent:   '🛡️',
    }),
    body,
    footerNote: 'Security alert · sent for every new sign-in',
  })
}

export function renderSignInText({ name, userAgent, deviceLabel, ip, location, time }) {
  const device = deviceLabel || parseDevice(userAgent)
  const when   = formatTimestamp(time || new Date())
  return [
    `Hey ${name || 'there'},`,
    ``,
    `A new sign-in to your Kairo account was just recorded.`,
    ``,
    `Time:   ${when}`,
    `Device: ${device}`,
    `IP:     ${ip || '—'}`,
    location ? `Location: ${location}` : null,
    ``,
    `If this wasn't you: reset your password and revoke sessions immediately.`,
    `Review security: ${appUrl()}/settings/security`,
    ``,
    `— Kairo Security`,
  ].filter(Boolean).join('\n')
}

export function sendSignInEmail({ to, name, userAgent, ip, location, time, deviceLabel }) {
  return send({
    to,
    subject: 'New sign-in to your Kairo account',
    html:    renderSignInHtml({ name, userAgent, deviceLabel, ip, location, time }),
    text:    renderSignInText({ name, userAgent, deviceLabel, ip, location, time }),
  })
}
