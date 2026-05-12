/**
 * Email document shell.
 *
 * Every template builds its `body` HTML and passes it through `shell()` to
 * get the final document — head, dark page background, outer table, hero,
 * inner card, footer, brand strip.
 *
 *   shell({
 *     title:       'You\'re in',           // <title> + fallback subject
 *     preheader:   'Welcome to Kairo.',     // inbox preview
 *     hero:        hero({ title, subtitle }),  // pre-built <tr>
 *     body:        '<!-- inner HTML -->',
 *     footerNote:  'Joined as student · Greenwood Public School',
 *     schoolName:  'Greenwood Public School',  // optional brand line
 *   })
 *
 * Why a <style> block AND inline styles?
 *   Inline styles are mandatory for compatibility. The <style> block adds
 *   ambient micro-animations (gradient shimmer on dividers, button glow
 *   pulse) for clients that DO support <style> — primarily Apple Mail and
 *   newer Gmail web. Clients that strip <style> still see the perfectly
 *   composed static email.
 */

import { THEME } from './theme.js'
import { footer, brandStrip, preheader } from './components.js'

export function shell({
  title       = 'Kairo',
  preheader: prehead = '',
  hero,
  body,
  footerNote,
  schoolName,
}) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no">
  <title>${title}</title>
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings>
    <o:PixelsPerInch>96</o:PixelsPerInch>
  </o:OfficeDocumentSettings></xml></noscript>
  <![endif]-->
  <style>
    /* === Progressive-enhancement only — clients that strip <style>
           still get a beautiful static email from the inline rules. === */
    @media (prefers-color-scheme: light) {
      body, table { background:${THEME.bg.page} !important; }
    }
    /* Mobile tweaks */
    @media (max-width: 620px) {
      .kr-card     { border-radius:14px !important; }
      .kr-hero td  { padding:38px 22px 34px !important; }
      .kr-body td  { padding:26px 22px 22px !important; }
      .kr-h1       { font-size:26px !important; }
      .kr-cta a    { padding:14px 26px !important; font-size:14px !important; }
    }
    /* Ambient animations (silently ignored in Outlook + Gmail mobile) */
    @keyframes kr-shimmer {
      0%   { opacity:0.55; transform:translateX(-10%); }
      50%  { opacity:1;    transform:translateX(0); }
      100% { opacity:0.55; transform:translateX(10%); }
    }
    @keyframes kr-pulse {
      0%, 100% { box-shadow:0 12px 36px rgba(124,58,237,0.30), 0 4px 14px rgba(37,99,235,0.18); }
      50%      { box-shadow:0 18px 56px rgba(124,58,237,0.55), 0 6px 22px rgba(37,99,235,0.36); }
    }
    .kr-divider-line { animation: kr-shimmer 5s ease-in-out infinite; }
    .kr-cta-pulse    { animation: kr-pulse    3.6s ease-in-out infinite; }
    /* Anti-Gmail blue links on auto-detected text */
    a { color:${THEME.brand.purpleLite}; text-decoration:none; }
    a:hover { color:#c4b5fd; }
  </style>
</head>
<body style="margin:0;padding:0;background:${THEME.bg.page};font-family:${THEME.font.family};color:${THEME.text.primary};-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;">

  ${preheader(prehead)}

  <!-- Outer page table ────────────────────────────────────────────────── -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
    style="background:${THEME.bg.page};background-image:
      radial-gradient(at 8% 0%,  rgba(124,58,237,0.10) 0%, transparent 35%),
      radial-gradient(at 92% 100%, rgba(37,99,235,0.10) 0%, transparent 40%);">
    <tr>
      <td align="center" style="padding:48px 16px 8px;">

        <!-- Card ──────────────────────────────────────────────────────── -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
          class="kr-card"
          style="max-width:${THEME.maxWidth}px;
                 background:${THEME.bg.card};
                 border:1px solid ${THEME.bg.border};
                 border-radius:${THEME.radius.xl};
                 overflow:hidden;
                 box-shadow:${THEME.glow.soft};">

          <!-- Hero ─────────────────────────────────────────────────── -->
          ${hero}

          <!-- Body ─────────────────────────────────────────────────── -->
          <tr class="kr-body">
            <td style="padding:32px 32px 26px;">
              ${body}
            </td>
          </tr>

          <!-- Footer ───────────────────────────────────────────────── -->
          ${footer({ note: footerNote, schoolName })}

        </table>

        <!-- Brand strip ──────────────────────────────────────────────── -->
        ${brandStrip()}

      </td>
    </tr>
  </table>
</body>
</html>`
}
