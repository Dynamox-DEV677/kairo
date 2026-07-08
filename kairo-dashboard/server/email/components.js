/**
 * Kyno email components — small, composable HTML builders.
 *
 * Every function takes an options object and returns an HTML STRING that is
 * already inlined and email-safe. Compose them inside templates with simple
 * string concatenation:
 *
 *     const html = shell({
 *       hero: hero({ title: 'Welcome', subtitle: '…' }),
 *       body: [
 *         intro({ greeting: 'Hey Darshan', message: '…' }),
 *         infoCard({ kind: 'success', title: 'Account active', body: '…' }),
 *         button({ href: '…', label: 'Open Kyno' }),
 *       ].join(''),
 *     })
 *
 * Layout RULES the components follow so they survive every email client:
 *   - All layout is table-based (Outlook + Gmail mobile both kill flex/grid)
 *   - Styles are inline (most clients drop <style> in <head>)
 *   - Widths use px, never %, except table width="100%"
 *   - No external resources — fonts come from OS, logo is inline SVG
 */

import { THEME } from './theme.js'

// ─── 1. Logo — inline SVG with subtle SMIL animation ─────────────────────────
// Animations work in Apple Mail / iOS / supported Gmail web; everything else
// degrades to a beautiful static rendering. Never breaks layout.
export function logo({ size = 64, glow = true } = {}) {
  const id = `klg${Math.floor(Math.random() * 1e6).toString(36)}`     // unique gradient ids per render
  const orbitR = size * 0.34
  const dotR   = size * 0.04
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64"
         style="display:inline-block;vertical-align:middle;">
      <defs>
        <linearGradient id="${id}-stroke" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#A5B4FC"/>
          <stop offset="40%" stop-color="#66D9FF"/>
          <stop offset="80%" stop-color="#60a5fa"/>
          <stop offset="100%" stop-color="#22d3ee"/>
        </linearGradient>
        ${glow ? `
        <radialGradient id="${id}-halo" cx="50%" cy="50%" r="50%">
          <stop offset="0%"  stop-color="#4F7CFF" stop-opacity="0.55"/>
          <stop offset="60%" stop-color="#2563eb" stop-opacity="0.18"/>
          <stop offset="100%" stop-color="#2563eb" stop-opacity="0"/>
        </radialGradient>` : ''}
      </defs>
      ${glow ? `<circle cx="32" cy="32" r="${size * 0.48}" fill="url(#${id}-halo)"/>` : ''}
      <!-- Orbit ring — rotates slowly in clients that support SMIL -->
      <circle cx="32" cy="32" r="${orbitR}" fill="none"
              stroke="url(#${id}-stroke)" stroke-width="1.2" stroke-opacity="0.55">
        <animateTransform attributeName="transform" type="rotate"
          from="0 32 32" to="360 32 32" dur="22s" repeatCount="indefinite"/>
      </circle>
      <!-- Stylized K monogram -->
      <g stroke="url(#${id}-stroke)" stroke-width="3.2" stroke-linecap="round"
         stroke-linejoin="round" fill="none">
        <path d="M22 17 L22 47"/>
        <path d="M22 32 L36 17"/>
        <path d="M22 32 L36 47"/>
      </g>
      <!-- Spark on the right — pulses when supported -->
      <circle cx="42" cy="32" r="${dotR + 0.6}" fill="#A5B4FC">
        <animate attributeName="opacity" values="0.35;1;0.35" dur="2.4s" repeatCount="indefinite"/>
        <animate attributeName="r" values="${dotR};${dotR + 1.3};${dotR}" dur="2.4s" repeatCount="indefinite"/>
      </circle>
    </svg>
  `
}

// ─── 2. Hero — gradient header strip with logo + headline ────────────────────
export function hero({ title, subtitle, accent = 'logo' }) {
  // `accent`: 'logo' renders the inline SVG mark, or pass any emoji like '🛡️'
  const mark = accent === 'logo'
    ? logo({ size: 64, glow: true })
    : `<div style="font-size:46px;line-height:1;margin-bottom:6px;">${accent}</div>`

  return `
    <tr>
      <td style="position:relative;background:${THEME.gradient.hero};padding:48px 32px 44px;text-align:center;">
        <!-- Background light bloom (CSS-rendered, no images) -->
        <div style="position:absolute;inset:0;background:
          radial-gradient(at 18% 22%, rgba(255,255,255,0.18) 0%, transparent 45%),
          radial-gradient(at 82% 78%, rgba(34,211,238,0.22) 0%, transparent 50%);
          pointer-events:none;"></div>

        <div style="position:relative;z-index:1;">
          <div style="margin-bottom:14px;">${mark}</div>
          <h1 style="margin:0;font-family:${THEME.font.family};font-size:30px;font-weight:800;color:#ffffff;letter-spacing:-0.6px;line-height:1.15;text-shadow:0 2px 14px rgba(0,0,0,0.35);">
            ${title}
          </h1>
          ${subtitle ? `
            <p style="margin:12px 0 0;font-family:${THEME.font.family};font-size:14px;color:rgba(255,255,255,0.88);font-weight:500;line-height:1.5;letter-spacing:0.1px;">
              ${subtitle}
            </p>
          ` : ''}
        </div>
      </td>
    </tr>
  `
}

// ─── 3. CTA Button — glowing pill ────────────────────────────────────────────
export function button({ href, label, kind = 'primary' }) {
  const gradient = kind === 'danger'
    ? 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)'
    : THEME.gradient.cta
  const glow = kind === 'danger'
    ? '0 12px 36px rgba(239,68,68,0.45)'
    : THEME.glow.medium
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:30px auto 6px;">
      <tr>
        <td align="center" style="border-radius:${THEME.radius.lg};background:${gradient};box-shadow:${glow};">
          <a href="${href}" target="_blank" rel="noopener"
             style="display:inline-block;
                    padding:15px 34px;
                    font-family:${THEME.font.family};
                    font-size:15px;font-weight:700;
                    color:#ffffff !important;
                    text-decoration:none;
                    border-radius:${THEME.radius.lg};
                    letter-spacing:0.2px;
                    line-height:1;
                    background:linear-gradient(180deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0) 60%);">
            ${label} <span style="font-weight:800;">→</span>
          </a>
        </td>
      </tr>
    </table>
  `
}

// ─── 4. Intro paragraph — "Hey {name}, …" ────────────────────────────────────
export function intro({ greeting, lead }) {
  return `
    <p style="margin:0 0 14px;font-family:${THEME.font.family};font-size:16.5px;color:${THEME.text.primary};line-height:1.55;font-weight:500;">
      ${greeting}
    </p>
    ${lead ? `
      <p style="margin:0 0 18px;font-family:${THEME.font.family};font-size:15px;color:${THEME.text.secondary};line-height:1.7;">
        ${lead}
      </p>
    ` : ''}
  `
}

// ─── 5. Info card — colored side-band callout ────────────────────────────────
// kind: 'success' | 'warning' | 'info' | 'danger' | 'brand'
export function infoCard({ kind = 'brand', title, body, icon }) {
  const colorMap = {
    success: { tint: 'rgba(52,211,153,0.06)',  border: 'rgba(52,211,153,0.32)',  ink: THEME.status.success, fallbackIcon: '✓' },
    warning: { tint: 'rgba(199, 210, 232, 0.06)',  border: 'rgba(199, 210, 232, 0.32)',  ink: THEME.status.warning, fallbackIcon: '⏳' },
    info:    { tint: 'rgba(96,165,250,0.06)',  border: 'rgba(96,165,250,0.32)',  ink: THEME.status.info,    fallbackIcon: 'ⓘ' },
    danger:  { tint: 'rgba(248,113,113,0.06)', border: 'rgba(248,113,113,0.32)', ink: THEME.status.danger,  fallbackIcon: '⚠' },
    brand:   { tint: 'rgba(79, 124, 255, 0.08)',  border: 'rgba(79, 124, 255, 0.38)',  ink: THEME.brand.purpleLite, fallbackIcon: '✦' },
  }
  const c = colorMap[kind] || colorMap.brand
  const usedIcon = icon ?? c.fallbackIcon
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
      style="background:${c.tint};border:1px solid ${c.border};border-radius:${THEME.radius.md};margin:14px 0;">
      <tr>
        <td style="padding:14px 16px;">
          <p style="margin:0;font-family:${THEME.font.family};font-size:11px;color:${c.ink};font-weight:700;text-transform:uppercase;letter-spacing:1.2px;">
            <span style="font-size:13px;line-height:1;">${usedIcon}</span>&nbsp;&nbsp;${title}
          </p>
          ${body ? `
            <p style="margin:6px 0 0;font-family:${THEME.font.family};font-size:13.5px;color:${THEME.text.muted};line-height:1.65;">
              ${body}
            </p>
          ` : ''}
        </td>
      </tr>
    </table>
  `
}

// ─── 6. Data row — label / value pair in a glassy panel ──────────────────────
// Use for sign-in details (device, time, IP, location).
export function dataPanel({ rows = [], title }) {
  const rowsHtml = rows.map((r, i) => `
    <tr>
      <td style="padding:${i === 0 ? '12px 16px 8px' : '8px 16px'};border-top:${i === 0 ? '0' : `1px solid ${THEME.bg.borderSoft}`};">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="font-family:${THEME.font.family};font-size:11.5px;color:${THEME.text.dim};font-weight:600;text-transform:uppercase;letter-spacing:1px;width:42%;vertical-align:top;padding-top:1px;">
              ${r.label}
            </td>
            <td style="font-family:${THEME.font.family};font-size:13.5px;color:${THEME.text.primary};font-weight:500;line-height:1.5;text-align:right;">
              ${r.value}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `).join('')
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
      style="background:${THEME.gradient.surface};border:1px solid ${THEME.bg.border};border-radius:${THEME.radius.md};margin:18px 0;">
      ${title ? `
        <tr>
          <td style="padding:12px 16px 0;">
            <p style="margin:0;font-family:${THEME.font.family};font-size:10.5px;color:${THEME.brand.purpleLite};font-weight:700;text-transform:uppercase;letter-spacing:1.5px;">
              ${title}
            </p>
          </td>
        </tr>
      ` : ''}
      ${rowsHtml}
    </table>
  `
}

// ─── 7. Code block — show a passcode / one-time token prominently ────────────
export function codeBlock({ value, hint }) {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
      style="background:rgba(79, 124, 255, 0.10);border:1px solid rgba(79, 124, 255, 0.14);border-radius:${THEME.radius.md};margin:20px 0;box-shadow:inset 0 1px 0 rgba(255,255,255,0.04);">
      <tr>
        <td style="padding:22px 16px;text-align:center;">
          <code style="font-family:${THEME.font.mono};font-size:24px;font-weight:800;color:${THEME.text.primary};letter-spacing:4px;line-height:1;">
            ${value}
          </code>
          ${hint ? `
            <p style="margin:10px 0 0;font-family:${THEME.font.family};font-size:11.5px;color:${THEME.brand.purpleLite};font-weight:600;letter-spacing:0.6px;">
              ${hint}
            </p>
          ` : ''}
        </td>
      </tr>
    </table>
  `
}

// ─── 8. Gradient divider — animated glow where supported ─────────────────────
export function divider() {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td style="padding:18px 0;">
          <div style="height:1px;background:${THEME.gradient.divider};"></div>
        </td>
      </tr>
    </table>
  `
}

// ─── 9. Bullet list — branded markers ────────────────────────────────────────
export function bulletList({ title, items = [], style = 'check' }) {
  const marker = style === 'check' ? '✓' : style === 'spark' ? '◆' : '•'
  const markerColor = style === 'check' ? THEME.status.success : THEME.brand.purpleLite

  const rows = items.map(item => `
    <tr>
      <td style="padding:6px 0;vertical-align:top;font-family:${THEME.font.family};font-size:14px;color:${THEME.text.secondary};line-height:1.65;">
        <span style="color:${markerColor};font-weight:800;margin-right:10px;display:inline-block;width:14px;">${marker}</span>
        ${item}
      </td>
    </tr>
  `).join('')

  return `
    ${title ? `
      <p style="margin:22px 0 6px;font-family:${THEME.font.family};font-size:12px;color:${THEME.text.dim};font-weight:700;text-transform:uppercase;letter-spacing:1.4px;">
        ${title}
      </p>
    ` : ''}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      ${rows}
    </table>
  `
}

// ─── 10. Footer — brand strip + legal ────────────────────────────────────────
export function footer({ note, schoolName } = {}) {
  const tag = schoolName ? `· ${escapeHtml(schoolName)}` : ''
  return `
    <tr>
      <td style="padding:22px 32px;border-top:1px solid ${THEME.bg.border};background:${THEME.bg.cardDeep};">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td align="center">
              ${note ? `
                <p style="margin:0 0 8px;font-family:${THEME.font.family};font-size:11.5px;color:${THEME.text.dim};line-height:1.65;">
                  ${note}
                </p>
              ` : ''}
              <p style="margin:0;font-family:${THEME.font.family};font-size:11.5px;color:${THEME.text.faint};line-height:1.55;">
                You received this because you have a Kyno account ${tag}.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `
}

// ─── 11. Brand strip — sits below the card ───────────────────────────────────
export function brandStrip() {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
      style="max-width:${THEME.maxWidth}px;margin-top:20px;">
      <tr>
        <td align="center" style="padding:14px 0 30px;">
          <p style="margin:0;font-family:${THEME.font.family};font-size:10.5px;color:${THEME.text.faint};letter-spacing:2.2px;text-transform:uppercase;font-weight:700;">
            <span style="background:${THEME.gradient.cta};-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;">
              KYNO
            </span>
            &nbsp;·&nbsp;Accelerate Your Academics
          </p>
          <p style="margin:8px 0 0;font-family:${THEME.font.family};font-size:10px;color:${THEME.text.faint};">
            © ${new Date().getFullYear()} Kyno · Built for Indian classrooms.
          </p>
        </td>
      </tr>
    </table>
  `
}

// ─── 12. Preheader — hidden inbox preview text ───────────────────────────────
export function preheader(text) {
  return `
    <span style="display:none;font-size:1px;color:#050505;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">
      ${escapeHtml(text)}
    </span>
  `
}

// ─── 13. Plain helpers ───────────────────────────────────────────────────────
export function escapeHtml(s = '') {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Capitalize first letter — useful for "role" labels in templates. */
export function cap(s = '') {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
