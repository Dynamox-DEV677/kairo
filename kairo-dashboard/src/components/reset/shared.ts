/** Shared design tokens for the Reset Passcode flow.
 *  Strict palette: deep black + purple gradient + white. */
export const RC = {
  bg:        '#050505',
  bgElev:    '#0c0c14',
  bgGlass:   'rgba(14, 14, 22, 0.62)',
  border:    'rgba(167, 139, 250, 0.18)',
  borderHi:  'rgba(167, 139, 250, 0.45)',
  text:      '#fafafa',
  textDim:   '#a1a1aa',
  textFaint: '#71717a',
  textGhost: '#52525b',
  purpleSoft:'#e9d5ff',
  purpleLite:'#c4b5fd',
  purple:    '#a78bfa',
  purpleHi:  '#7c3aed',
  purpleDeep:'#5b21b6',
  danger:    '#a78bfa',   // strict palette — even errors stay purple
  good:      '#c4b5fd',
}

export const GRAD = {
  primary: 'linear-gradient(135deg, #c4b5fd 0%, #a78bfa 50%, #7c3aed 100%)',
  text:    'linear-gradient(135deg, #e9d5ff 0%, #c4b5fd 40%, #a78bfa 80%, #7c3aed 100%)',
  card:    'linear-gradient(180deg, rgba(167, 139, 250, 0.06) 0%, rgba(14, 14, 22, 0.95) 100%)',
}

export const FONT = '"Inter", "SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'
