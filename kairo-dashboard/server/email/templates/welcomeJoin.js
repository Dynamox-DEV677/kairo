/**
 * Welcome — sent after a user signs up + joins a school.
 *
 * Variables: { name, role, schoolName, requireApproval }
 */
import { THEME, appUrl } from '../theme.js'
import { shell } from '../shell.js'
import {
  hero, intro, infoCard, button, bulletList, divider, escapeHtml, cap,
} from '../components.js'
import { send } from '../transport.js'

export function renderWelcomeJoinHtml({ name, role, schoolName, requireApproval }) {
  const safeName = escapeHtml(name)
  const safeRole = escapeHtml(role)
  const safeSchool = escapeHtml(schoolName)

  const pendingCard = requireApproval && role === 'student'
    ? infoCard({
        kind: 'warning',
        title: 'Awaiting admin approval',
        body: `Your school admin will approve your account shortly. We'll email you the moment it's ready.`,
      })
    : infoCard({
        kind: 'success',
        title: 'Account active',
        body: `You can sign in right now and start using every Kairo feature available to your role.`,
      })

  const features = role === 'student' ? [
    'Ask any doubt — AI tutor that remembers your weak topics',
    'Snap homework photos for instant step-by-step explanations',
    'Daily Battle Mode + Revision Simulator built to your syllabus',
    'Smart Timetable that adapts as you learn',
  ] : role === 'teacher' ? [
    'AI Teacher Assistant — lesson plans, quizzes, flashcards in one click',
    'Grader: paste any answer, get structured feedback',
    'Track student marks + flag at-risk students automatically',
    'Send announcements with the AI announcement generator',
  ] : [
    'Track your child\'s marks across every subject',
    'Performance trends + grade letters at a glance',
    'AI insights on strong and weak subjects',
  ]

  const body = [
    intro({
      greeting: `Hey <span style="color:${THEME.brand.purpleLite};font-weight:700;">${safeName}</span>,`,
      lead: `Welcome to <strong style="color:${THEME.text.primary};">${safeSchool}</strong> on Kairo as a <strong style="color:${THEME.brand.purpleLite};">${safeRole}</strong>. You're in. Let's get to work.`,
    }),
    pendingCard,
    bulletList({
      title: `What you can do as a ${cap(safeRole)}`,
      items: features,
      style: 'check',
    }),
    button({ href: appUrl(), label: 'Open Kairo' }),
    divider(),
    `<p style="margin:8px 0 0;font-family:${THEME.font.family};font-size:12px;color:${THEME.text.dim};line-height:1.65;text-align:center;">
       Stuck or have questions? Just reply to this email — a real human reads every one.
     </p>`,
  ].join('')

  return shell({
    title:     `Welcome to ${schoolName} · Kairo`,
    preheader: `${name}, you're now part of ${schoolName} on Kairo.`,
    hero: hero({
      title:    `Welcome to ${schoolName}`,
      subtitle: `You're in. Let's get to work.`,
      accent:   'logo',
    }),
    body,
    footerNote: `Joined as ${role} · ${schoolName}`,
    schoolName,
  })
}

export function renderWelcomeJoinText({ name, role, schoolName, requireApproval }) {
  return [
    `Welcome to ${schoolName} on Kairo, ${name}!`,
    ``,
    `You're now part of ${schoolName} as a ${role}.`,
    requireApproval && role === 'student' ? `Your account is awaiting admin approval — we'll email you the moment it's ready.` : `Your account is active. Sign in to get started.`,
    ``,
    `Open Kairo: ${appUrl()}`,
    ``,
    `— Kairo · Accelerate Your Academics`,
  ].filter(Boolean).join('\n')
}

export function sendWelcomeJoinEmail({ to, name, role, schoolName, requireApproval }) {
  return send({
    to,
    subject: `Welcome to ${schoolName} · Kairo`,
    html:    renderWelcomeJoinHtml({ name, role, schoolName, requireApproval }),
    text:    renderWelcomeJoinText({ name, role, schoolName, requireApproval }),
  })
}
