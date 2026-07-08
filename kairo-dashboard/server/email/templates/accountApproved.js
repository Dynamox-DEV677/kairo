/**
 * Account Approved — sent when an admin approves a pending student/teacher.
 *
 * Variables: { name, role, schoolName }
 */
import { THEME, appUrl } from '../theme.js'
import { shell } from '../shell.js'
import {
  hero, intro, infoCard, button, divider, escapeHtml,
} from '../components.js'
import { send } from '../transport.js'

export function renderAccountApprovedHtml({ name, role, schoolName }) {
  const safeName   = escapeHtml(name)
  const safeRole   = escapeHtml(role)
  const safeSchool = escapeHtml(schoolName)

  const body = [
    intro({
      greeting: `Hey <span style="color:${THEME.brand.purpleLite};font-weight:700;">${safeName}</span>,`,
      lead: `Good news — your <strong style="color:${THEME.status.success};">${safeRole}</strong> account at <strong style="color:${THEME.text.primary};">${safeSchool}</strong> has just been approved.`,
    }),
    infoCard({
      kind: 'success',
      title: 'Account active',
      body: `Every Kyno feature for ${safeRole}s is now unlocked. Sign in and pick up where you left off.`,
    }),
    button({ href: appUrl(), label: 'Sign in to Kyno' }),
    divider(),
    `<p style="margin:8px 0 0;font-family:${THEME.font.family};font-size:12px;color:${THEME.text.dim};line-height:1.65;text-align:center;">
       Welcome aboard — ${safeSchool} is glad to have you.
     </p>`,
  ].join('')

  return shell({
    title:     `You're approved · ${schoolName}`,
    preheader: `Your Kyno account at ${schoolName} is approved.`,
    hero: hero({
      title:    `You're approved`,
      subtitle: `Welcome aboard at ${schoolName}.`,
      accent:   'logo',
    }),
    body,
    footerNote: `${role} · ${schoolName}`,
    schoolName,
  })
}

export function renderAccountApprovedText({ name, role, schoolName }) {
  return [
    `Hey ${name},`,
    ``,
    `Your ${role} account at ${schoolName} has been approved.`,
    `Every Kyno feature is now unlocked.`,
    ``,
    `Sign in: ${appUrl()}`,
    ``,
    `— Kyno · Accelerate Your Academics`,
  ].join('\n')
}

export function sendAccountApprovedEmail({ to, name, role, schoolName }) {
  return send({
    to,
    subject: `You're approved · ${schoolName}`,
    html:    renderAccountApprovedHtml({ name, role, schoolName }),
    text:    renderAccountApprovedText({ name, role, schoolName }),
  })
}
