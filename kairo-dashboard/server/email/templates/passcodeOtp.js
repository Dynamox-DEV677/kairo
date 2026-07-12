import { THEME, formatTimestamp } from '../theme.js'
import { shell } from '../shell.js'
import {
  intro, infoCard, dataPanel, divider, escapeHtml,
} from '../components.js'
import { send } from '../transport.js'

export function renderPasscodeOtpHtml({
  name = '',
  code,
  expiresInMinutes = 10,
  ip,
  userAgent,
  time,
}) {
  const safeName = escapeHtml(name || 'there')
  const safeCode = escapeHtml(code)
  const when     = formatTimestamp(time || new Date())

  const otpBox = `
    <div style="margin:28px 0 22px;text-align:center;">
      <div style="
        display:inline-block;
        font-family:${THEME.font.family};
        font-size:44px;
        font-weight:800;
        letter-spacing:0.42em;
        padding:24px 36px 24px 50px;
        border-radius:18px;
        background:linear-gradient(135deg,
          ${THEME.brand.purpleSoft}1a,
          ${THEME.brand.purpleHi}26);
        border:1px solid ${THEME.brand.purpleLite}55;
        color:${THEME.text.primary};
        box-shadow:0 0 24px ${THEME.brand.purple}33;
      ">
        ${safeCode}
      </div>
    </div>`

  const body = [
    intro({
      greeting: `Hey <span style="color:${THEME.brand.purpleLite};font-weight:700;">${safeName}</span>,`,
      lead: `Use the 6-digit code below to reset your Kyno passcode. Type it into the open Kyno screen on your device.`,
    }),
    otpBox,
    infoCard({
      kind: 'warning',
      title: `Code expires in ${expiresInMinutes} minutes`,
      body: `Keep this code private. Kyno will never ask for it over chat, phone, or any other channel. If you didn't request a passcode reset, ignore this email — your existing passcode stays the same.`,
    }),
    dataPanel({
      title: 'Request details',
      rows: [
        { label: 'Time',   value: when },
        { label: 'IP',     value: escapeHtml(ip || '—') },
        { label: 'Device', value: escapeHtml(userAgent ? userAgent.slice(0, 60) : '—') },
      ],
    }),
    divider(),
    `<p style="margin:8px 0 14px;font-family:${THEME.font.family};font-size:13px;color:${THEME.text.muted};line-height:1.7;">
       <strong style="color:${THEME.text.primary};">Didn't request this?</strong>
       Someone may have entered your email on the Kyno reset screen by mistake. Your account is safe — the code only works alongside your active reset session, and it expires fast.
     </p>`,
  ].join('\n')

  return shell({
    previewText: `Your Kyno passcode reset code: ${code}`,
    title:       'Reset your Kyno passcode',
    body,
  })
}

export function renderPasscodeOtpText({ name = '', code, expiresInMinutes = 10 }) {
  return [
    `Hey ${name || 'there'},`,
    ``,
    `Use this 6-digit code to reset your Kyno passcode:`,
    ``,
    `    ${code}`,
    ``,
    `The code expires in ${expiresInMinutes} minutes. Keep it private — Kyno will never ask for it through any other channel.`,
    ``,
    `If you didn't request this, ignore this email. Your passcode stays the same.`,
    ``,
    `— Kyno`,
  ].join('\n')
}

export async function sendPasscodeOtpEmail({
  to,
  name = '',
  code,
  expiresInMinutes = 10,
  ip,
  userAgent,
}) {
  if (!to || !code) {
    console.warn('[passcode-otp] missing to/code — skipping send')
    return null
  }
  const html = renderPasscodeOtpHtml({ name, code, expiresInMinutes, ip, userAgent })
  const text = renderPasscodeOtpText({ name, code, expiresInMinutes })
  return send({
    to,
    subject: `Your Kyno passcode reset code: ${code}`,
    html,
    text,
  })
}
