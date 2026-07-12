
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
