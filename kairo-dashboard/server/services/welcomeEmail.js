/**
 * Compatibility shim — preserves the old `welcomeEmail.js` import surface
 * while delegating to the new modular email system in `server/email/`.
 *
 * Old API → New API mapping:
 *   joinedSchoolEmail({ to, name, role, schoolName, requireApproval })
 *     → sendWelcomeJoinEmail({ ... })
 *   schoolCreatedEmail({ to, name, schoolName, joinCode, plan, trial })
 *     → sendSchoolCreatedEmail({ ... })
 *   approvedEmail({ to, name, schoolName, role })
 *     → sendAccountApprovedEmail({ ... })
 *   parentLinkedEmail({ to, name, studentName, schoolName })
 *     → sendParentLinkedEmail({ ... })
 *
 * For NEW code, import directly from `../email/index.js` so you get access
 * to the full set of senders (sign-in security, password reset, personal
 * welcome, etc.).
 */

import {
  sendWelcomeJoinEmail,
  sendSchoolCreatedEmail,
  sendAccountApprovedEmail,
  sendParentLinkedEmail,
} from '../email/index.js'

export function joinedSchoolEmail({ to, name, role, schoolName, requireApproval }) {
  return sendWelcomeJoinEmail({ to, name, role, schoolName, requireApproval })
}

export function schoolCreatedEmail({ to, name, schoolName, joinCode, plan, trial }) {
  return sendSchoolCreatedEmail({ to, name, schoolName, joinCode, plan, trial })
}

export function approvedEmail({ to, name, role, schoolName }) {
  return sendAccountApprovedEmail({ to, name, role, schoolName })
}

export function parentLinkedEmail({ to, name, studentName, schoolName }) {
  return sendParentLinkedEmail({ to, name, studentName, schoolName })
}

export default {
  joinedSchoolEmail,
  schoolCreatedEmail,
  approvedEmail,
  parentLinkedEmail,
}
