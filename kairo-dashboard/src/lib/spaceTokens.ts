/**
 * Design tokens for the seven-spaces redesign.
 *
 * One file, imported by every new space. Doubt Solving shipped with these
 * inlined; Practice is the second consumer, and two copies of a palette is how
 * two screens drift a shade apart without anyone deciding they should.
 *
 * Values are the brief's, verbatim. Change them here or not at all.
 */

export const T = {
  bg:        '#0B0B14',
  bgAlt:     '#0F0F1A',
  exam:      '#101018',   // mock chrome — sober, no purple
  surface:   '#15151F',
  raised:    '#1A1A26',
  sheet:     '#131320',
  well:      '#101019',   // equation blocks, lockout notice

  border:    '#262636',
  borderCtl: '#2A2A3C',
  divider:   '#1E1E2C',
  borderExam:'#22222E',
  dashed:    '#2E2E42',

  text:      '#EDEDF5',
  text2:     '#C9C9DC',
  muted:     '#9494AD',
  dim:       '#7E7E96',
  faint:     '#5E5E78',
  fainter:   '#4A4A60',
  flat:      '#6B6B80',   // "no change" label

  accent:        '#7C5CFF',
  accentLite:    '#9B82FF',
  accentPale:    '#C4B4FF',
  accentSurface: '#2A1F52',

  success:       '#3DD68C',
  successBg:     '#123D2B',
  successBorder: '#235C42',
  successDim:    '#2E5C46',
  successInk:    '#5E8C74',   // the "/5" beside a big score

  warning:       '#F2A65A',
  warningBg:     '#3A2E18',
  warningBorder: '#4A3A20',

  error:         '#E0705A',
  errorBg:       '#3A1E18',
  errorBorder:   '#4A2434',

  info:          '#6FA8DC',
  infoBorder:    '#2A3A5A',

  paper:    '#F4F1E8',   // photographed answers
  paperInk: '#2A2620',
  markLost: '#C1442E',
  markWon:  '#2E8B57',

  barFlat:  '#3A3A50',
  unseen:   '#26263A',
} as const

export const FONT = "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif"
export const MONO = "ui-monospace, 'SF Mono', Menlo, monospace"

/** lucide props that satisfy "inline SVG, 1.75 stroke, round caps". */
export const ICON = { strokeWidth: 1.75, absoluteStrokeWidth: false } as const

export const R = { pill: 100, session: 22, card: 16, button: 14, sheet: 26 } as const
