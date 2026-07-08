/**
 * Welcome — sent after a personal (no-school) signup.
 *
 * Variables: { name, className, board }
 */
import { THEME, appUrl } from '../theme.js'
import { shell } from '../shell.js'
import {
  hero, intro, infoCard, button, bulletList, divider, dataPanel, escapeHtml,
} from '../components.js'
import { send } from '../transport.js'

export function renderWelcomePersonalHtml({ name, className, board }) {
  const safeName  = escapeHtml(name)
  const safeClass = escapeHtml(className || 'Self-study')
  const safeBoard = escapeHtml(board || 'Custom syllabus')

  const body = [
    intro({
      greeting: `Hey <span style="color:${THEME.brand.purpleLite};font-weight:700;">${safeName}</span>,`,
      lead: `Welcome to Kora. This is your personal AI study companion — built specifically for Indian Class 9–12 students preparing for boards, JEE, NEET, and CUET.`,
    }),
    dataPanel({
      title: 'Your study profile',
      rows: [
        { label: 'Mode',     value: 'Personal · No school' },
        { label: 'Class',    value: safeClass },
        { label: 'Board',    value: safeBoard },
        { label: 'Status',   value: `<span style="color:${THEME.status.success};font-weight:700;">● Active</span>` },
      ],
    }),
    bulletList({
      title: 'Your first 60 seconds in Kora',
      items: [
        'Open Kora Solver and ask your hardest doubt — get an AI explanation tuned to your level',
        'Snap a photo of homework and get a step-by-step walkthrough',
        'Join Battle Mode for a 5-minute daily challenge across your subjects',
        'Build a Smart Timetable that adapts as your strengths shift',
      ],
      style: 'spark',
    }),
    button({ href: appUrl(), label: 'Start Learning' }),
    infoCard({
      kind: 'brand',
      title: 'Pro tip',
      body: `Hit ⌘K (or Ctrl+K) anywhere in Kora to open the AI Solver. It remembers every doubt you ask and quietly builds a map of your weak topics in the background.`,
    }),
    divider(),
    `<p style="margin:8px 0 0;font-family:${THEME.font.family};font-size:12px;color:${THEME.text.dim};line-height:1.65;text-align:center;">
       Made for Class 9–12 in India. Reply to this email if you ever get stuck.
     </p>`,
  ].join('')

  return shell({
    title:     `Welcome to Kora, ${name}`,
    preheader: `Your personal AI study companion is ready, ${name}.`,
    hero: hero({
      title:    `Welcome to Kora`,
      subtitle: `Your personal AI study companion is ready.`,
      accent:   'logo',
    }),
    body,
    footerNote: `Personal account · Mode: ${className || 'Self-study'}`,
  })
}

export function renderWelcomePersonalText({ name, className, board }) {
  return [
    `Welcome to Kora, ${name}!`,
    ``,
    `Your personal AI study companion is ready.`,
    `Class: ${className || 'Self-study'}  ·  Board: ${board || 'Custom syllabus'}`,
    ``,
    `Open Kora: ${appUrl()}`,
    ``,
    `— Kora · Accelerate Your Academics`,
  ].join('\n')
}

export function sendWelcomePersonalEmail({ to, name, className, board }) {
  return send({
    to,
    subject: `Welcome to Kora, ${name}`,
    html:    renderWelcomePersonalHtml({ name, className, board }),
    text:    renderWelcomePersonalText({ name, className, board }),
  })
}
