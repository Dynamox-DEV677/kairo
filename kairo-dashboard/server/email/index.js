/**
 * Kairo email module — single entry point.
 *
 * Import these named functions to send emails:
 *
 *   import {
 *     sendWelcomeJoinEmail,
 *     sendWelcomePersonalEmail,
 *     sendSignInEmail,
 *     sendSchoolCreatedEmail,
 *     sendAccountApprovedEmail,
 *     sendPasswordResetEmail,
 *     sendParentLinkedEmail,
 *   } from '../email/index.js'
 *
 * Every `send*` returns a Promise. Use `.catch(() => {})` to fire-and-forget
 * — the transport layer already swallows failures and logs them.
 *
 * To render HTML without sending (preview, tests), use the matching
 * `render*Html` / `render*Text` functions exported from each template.
 */

// ── Senders (do I/O) ────────────────────────────────────────────────────────
export { sendWelcomeJoinEmail }      from './templates/welcomeJoin.js'
export { sendWelcomePersonalEmail }  from './templates/welcomePersonal.js'
export { sendSignInEmail }           from './templates/signIn.js'
export { sendSchoolCreatedEmail }    from './templates/schoolCreated.js'
export { sendAccountApprovedEmail }  from './templates/accountApproved.js'
export { sendPasswordResetEmail }    from './templates/passwordReset.js'
export { sendParentLinkedEmail }     from './templates/parentLinked.js'
export { sendPasscodeOtpEmail }      from './templates/passcodeOtp.js'

// ── Renderers (pure, return HTML/text strings) ──────────────────────────────
export { renderWelcomeJoinHtml,      renderWelcomeJoinText }      from './templates/welcomeJoin.js'
export { renderWelcomePersonalHtml,  renderWelcomePersonalText }  from './templates/welcomePersonal.js'
export { renderSignInHtml,           renderSignInText }           from './templates/signIn.js'
export { renderSchoolCreatedHtml,    renderSchoolCreatedText }    from './templates/schoolCreated.js'
export { renderAccountApprovedHtml,  renderAccountApprovedText }  from './templates/accountApproved.js'
export { renderPasswordResetHtml,    renderPasswordResetText }    from './templates/passwordReset.js'
export { renderParentLinkedHtml,     renderParentLinkedText }     from './templates/parentLinked.js'
export { renderPasscodeOtpHtml,      renderPasscodeOtpText }      from './templates/passcodeOtp.js'

// ── Infrastructure helpers ──────────────────────────────────────────────────
export { send, getTransporter, getFromAddress } from './transport.js'
export { THEME, appUrl, formatTimestamp }       from './theme.js'
