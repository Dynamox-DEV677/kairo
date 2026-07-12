import { THEME, appUrl } from '../theme.js'
import { shell } from '../shell.js'
import {
  hero, intro, infoCard, button, bulletList, divider, escapeHtml,
} from '../components.js'
import { send } from '../transport.js'

export function renderParentLinkedHtml({ name, studentName, schoolName }) {
  const safeName    = escapeHtml(name)
  const safeStudent = escapeHtml(studentName)
  const safeSchool  = escapeHtml(schoolName)

  const body = [
    intro({
      greeting: `Hey <span style="color:${THEME.brand.purpleLite};font-weight:700;">${safeName}</span>,`,
      lead: `You're now linked to <strong style="color:${THEME.text.primary};">${safeStudent}</strong>'s academic progress at <strong>${safeSchool}</strong>.`,
    }),
    bulletList({
      title: 'Your parent dashboard shows',
      items: [
        'All marks across subjects',
        'Performance trends and grade letters',
        'Strong and weak subject panels',
        'AI-generated performance insights',
      ],
      style: 'check',
    }),
    button({ href: `${appUrl()}/parent`, label: 'Open Parent Dashboard' }),
    infoCard({
      kind: 'info',
      title: 'Privacy-first by design',
      body: `You won't see homework, AI chats, or other student systems. Your dashboard is purpose-built for tracking marks and progress only.`,
    }),
    divider(),
  ].join('')

  return shell({
    title:     `You're linked to ${studentName}`,
    preheader: `Your parent account is linked to ${studentName}.`,
    hero: hero({
      title:    `You're all set`,
      subtitle: `Linked to ${studentName} at ${schoolName}.`,
      accent:   '👨‍👩‍👧',
    }),
    body,
    footerNote: `Parent · linked to ${studentName}`,
    schoolName,
  })
}

export function renderParentLinkedText({ name, studentName, schoolName }) {
  return [
    `Hey ${name},`,
    ``,
    `You're now linked to ${studentName}'s progress at ${schoolName}.`,
    ``,
    `Open Parent Dashboard: ${appUrl()}/parent`,
    ``,
    `— Kyno · Accelerate Your Academics`,
  ].join('\n')
}

export function sendParentLinkedEmail({ to, name, studentName, schoolName }) {
  return send({
    to,
    subject: `You're linked to ${studentName}'s progress`,
    html:    renderParentLinkedHtml({ name, studentName, schoolName }),
    text:    renderParentLinkedText({ name, studentName, schoolName }),
  })
}
