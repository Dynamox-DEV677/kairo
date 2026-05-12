/**
 * Email preview registry.
 *
 * Maps each template id → { label, sample, renderHtml, renderText }.
 *
 * Used by the dev preview route (server/routes/devEmailPreview.js) to render
 * any template in the browser. Also handy for tests and snapshot diffs.
 */

import {
  renderWelcomeJoinHtml,      renderWelcomeJoinText,
  renderWelcomePersonalHtml,  renderWelcomePersonalText,
  renderSignInHtml,           renderSignInText,
  renderSchoolCreatedHtml,    renderSchoolCreatedText,
  renderAccountApprovedHtml,  renderAccountApprovedText,
  renderPasswordResetHtml,    renderPasswordResetText,
  renderParentLinkedHtml,     renderParentLinkedText,
} from './index.js'

export const PREVIEW = {
  'welcome-join': {
    label:  'Welcome (joined a school)',
    sample: { name: 'Darshan Rao', role: 'student', schoolName: 'Greenwood Public School', requireApproval: false },
    renderHtml: renderWelcomeJoinHtml,
    renderText: renderWelcomeJoinText,
  },

  'welcome-join-pending': {
    label:  'Welcome (joined a school · awaiting approval)',
    sample: { name: 'Aarav Mehta', role: 'student', schoolName: 'Greenwood Public School', requireApproval: true },
    renderHtml: renderWelcomeJoinHtml,
    renderText: renderWelcomeJoinText,
  },

  'welcome-join-teacher': {
    label:  'Welcome (teacher joined a school)',
    sample: { name: 'Priya Sharma', role: 'teacher', schoolName: 'Greenwood Public School', requireApproval: false },
    renderHtml: renderWelcomeJoinHtml,
    renderText: renderWelcomeJoinText,
  },

  'welcome-personal': {
    label:  'Welcome (personal · no school)',
    sample: { name: 'Sathya', className: 'Class 9', board: 'CBSE' },
    renderHtml: renderWelcomePersonalHtml,
    renderText: renderWelcomePersonalText,
  },

  'signin': {
    label:  'Sign-in security alert',
    sample: {
      name: 'Darshan Rao',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      ip: '49.36.142.18',
      location: 'Mumbai, IN',
      time: new Date(),
    },
    renderHtml: renderSignInHtml,
    renderText: renderSignInText,
  },

  'school-created': {
    label:  'School created (admin)',
    sample: {
      name: 'Anjali Verma',
      schoolName: 'Greenwood Public School',
      joinCode:   'GW-7K2X-94',
      plan:       'Pro',
      trial:      true,
    },
    renderHtml: renderSchoolCreatedHtml,
    renderText: renderSchoolCreatedText,
  },

  'account-approved': {
    label:  'Account approved',
    sample: { name: 'Aarav Mehta', role: 'student', schoolName: 'Greenwood Public School' },
    renderHtml: renderAccountApprovedHtml,
    renderText: renderAccountApprovedText,
  },

  'password-reset': {
    label:  'Password reset',
    sample: {
      name: 'Darshan Rao',
      resetUrl: 'https://kairo-daily-edu.vercel.app/reset-password?token=demo-token-please-replace',
      expiresInMinutes: 30,
      ip: '49.36.142.18',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0',
      time: new Date(),
    },
    renderHtml: renderPasswordResetHtml,
    renderText: renderPasswordResetText,
  },

  'parent-linked': {
    label:  'Parent linked',
    sample: { name: 'Mr. Rao', studentName: 'Darshan Rao', schoolName: 'Greenwood Public School' },
    renderHtml: renderParentLinkedHtml,
    renderText: renderParentLinkedText,
  },
}

/** List of available preview ids — useful for the index page. */
export function listPreviews() {
  return Object.entries(PREVIEW).map(([id, p]) => ({ id, label: p.label }))
}

/** Render a specific preview id to HTML, applying an optional data overlay. */
export function renderPreviewHtml(id, overrides = {}) {
  const p = PREVIEW[id]
  if (!p) return null
  return p.renderHtml({ ...p.sample, ...overrides })
}

/** Render a specific preview id to plain-text. */
export function renderPreviewText(id, overrides = {}) {
  const p = PREVIEW[id]
  if (!p) return null
  return p.renderText({ ...p.sample, ...overrides })
}
