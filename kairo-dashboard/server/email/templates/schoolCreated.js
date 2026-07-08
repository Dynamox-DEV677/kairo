/**
 * School Created — sent to the founding admin when their school goes live.
 *
 * Variables: { name, schoolName, joinCode, plan?, trial? }
 */
import { THEME, appUrl } from '../theme.js'
import { shell } from '../shell.js'
import {
  hero, intro, infoCard, codeBlock, button, bulletList, divider, escapeHtml,
} from '../components.js'
import { send } from '../transport.js'

export function renderSchoolCreatedHtml({ name, schoolName, joinCode, plan, trial }) {
  const safeName   = escapeHtml(name)
  const safeSchool = escapeHtml(schoolName)
  const safeCode   = escapeHtml(joinCode)

  const planBlock = trial
    ? infoCard({
        kind: 'success',
        title: '14-day free trial active',
        body: `Add payment from Settings before the trial ends to keep your school running without interruption.`,
      })
    : plan
    ? infoCard({
        kind: 'brand',
        title: 'Plan',
        body: `<strong style="color:${THEME.text.primary};text-transform:capitalize;">${escapeHtml(plan)}</strong>`,
      })
    : ''

  const body = [
    intro({
      greeting: `Hey <span style="color:${THEME.brand.purpleLite};font-weight:700;">${safeName}</span>,`,
      lead: `<strong style="color:${THEME.text.primary};">${safeSchool}</strong> is now live on Kyno. You're the admin — this is your control center.`,
    }),
    codeBlock({
      value: safeCode,
      hint: 'School join code · share this with your teachers and students',
    }),
    planBlock,
    bulletList({
      title: 'Your next steps',
      items: [
        'Share the join code above with your teachers and students',
        'Set up the admission bot in School Hub → Admission',
        'Configure your require-approval rules in Settings',
        'Send your first announcement using the AI Announcement Generator',
      ],
      style: 'spark',
    }),
    button({ href: `${appUrl()}/admin`, label: 'Open Admin Dashboard' }),
    divider(),
    `<p style="margin:8px 0 0;font-family:${THEME.font.family};font-size:12px;color:${THEME.text.dim};line-height:1.65;text-align:center;">
       Save your join code somewhere safe — it's how new members find your school.
     </p>`,
  ].filter(Boolean).join('')

  return shell({
    title:     `${schoolName} is live on Kyno`,
    preheader: `${schoolName} is live. Your join code: ${joinCode}`,
    hero: hero({
      title:    `${schoolName} is live`,
      subtitle: `You're the admin. Welcome to the control center.`,
      accent:   'logo',
    }),
    body,
    footerNote: `Admin · ${schoolName}`,
    schoolName,
  })
}

export function renderSchoolCreatedText({ name, schoolName, joinCode, plan, trial }) {
  return [
    `${schoolName} is live on Kyno!`,
    ``,
    `Hey ${name}, you're the admin.`,
    `Join code: ${joinCode}`,
    `Share this with your teachers and students.`,
    ``,
    trial ? `14-day free trial is active. Add payment before the trial ends.` : (plan ? `Plan: ${plan}` : null),
    ``,
    `Open Admin Dashboard: ${appUrl()}/admin`,
    ``,
    `— Kyno · Accelerate Your Academics`,
  ].filter(Boolean).join('\n')
}

export function sendSchoolCreatedEmail({ to, name, schoolName, joinCode, plan, trial }) {
  return send({
    to,
    subject: `${schoolName} is live on Kyno`,
    html:    renderSchoolCreatedHtml({ name, schoolName, joinCode, plan, trial }),
    text:    renderSchoolCreatedText({ name, schoolName, joinCode, plan, trial }),
  })
}
