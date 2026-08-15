/**
 * Chemical equation balancer — computed, never asked of a model.
 *
 * Balancing is linear algebra over element counts, so it has one right answer
 * that arithmetic finds every time. An LLM asked to balance an equation is
 * guessing at something that could have been calculated, and it guesses wrong
 * often enough that a student would be memorising errors. The vision model's
 * only job here is reading the equation off the page; the maths happens here.
 *
 * Method: build a matrix of element counts (reactants positive, products
 * negative), find the null-space vector by exact rational Gaussian elimination,
 * then scale to the smallest positive integers. Exact fractions throughout —
 * floating point turns 1/3 into 0.33333 and the integer scaling then fails.
 */

/* ── exact rational arithmetic ─────────────────────────────────────────── */

const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) { [a, b] = [b, a % b] } return a || 1 }
const lcm = (a, b) => Math.abs(a * b) / gcd(a, b)

function frac(n, d = 1) {
  if (d === 0) throw new Error('division by zero')
  if (d < 0) { n = -n; d = -d }
  const g = gcd(n, d)
  return { n: n / g, d: d / g }
}
const fAdd = (a, b) => frac(a.n * b.d + b.n * a.d, a.d * b.d)
const fSub = (a, b) => frac(a.n * b.d - b.n * a.d, a.d * b.d)
const fMul = (a, b) => frac(a.n * b.n, a.d * b.d)
const fDiv = (a, b) => frac(a.n * b.d, a.d * b.n)
const fZero = (a) => a.n === 0

/* ── formula parsing ───────────────────────────────────────────────────── */

/**
 * "Ca(OH)2" -> { Ca: 1, O: 2, H: 2 }
 *
 * Handles nested groups, multipliers, and a leading coefficient which is
 * ignored — the student's existing coefficients are exactly what we are
 * recomputing, so honouring them would just re-balance an already-wrong guess.
 */
export function parseFormula(raw) {
  const s = String(raw || '').trim().replace(/^\d+\s*/, '').replace(/·/g, '.')
  if (!s) return null

  let i = 0
  function parseGroup() {
    const counts = {}
    while (i < s.length) {
      const c = s[i]
      if (c === '(' || c === '[') {
        i++
        const inner = parseGroup()
        if (inner === null) return null
        const mult = readNumber()
        for (const [el, n] of Object.entries(inner)) counts[el] = (counts[el] || 0) + n * mult
      } else if (c === ')' || c === ']') {
        i++
        return counts
      } else if (/[A-Z]/.test(c)) {
        let el = c; i++
        while (i < s.length && /[a-z]/.test(s[i])) { el += s[i]; i++ }
        const n = readNumber()
        counts[el] = (counts[el] || 0) + n
      } else if (/\s|\./.test(c)) {
        i++
      } else {
        return null            // unparseable character
      }
    }
    return counts
  }
  function readNumber() {
    let num = ''
    while (i < s.length && /\d/.test(s[i])) { num += s[i]; i++ }
    return num ? parseInt(num, 10) : 1
  }

  const out = parseGroup()
  return out && Object.keys(out).length ? out : null
}

/**
 * Split "H2 + O2 -> H2O" into sides. Accepts ->, =, →, and =>.
 */
export function parseEquation(raw) {
  const s = String(raw || '').replace(/\s+/g, ' ').trim()
  const parts = s.split(/\s*(?:->|=>|→|-->|=)\s*/)
  if (parts.length !== 2) return null

  const side = (t) => t.split(/\s*\+\s*/).map(x => x.trim()).filter(Boolean)
  const left = side(parts[0])
  const right = side(parts[1])
  if (!left.length || !right.length) return null
  return { left, right }
}

/* ── the balance itself ────────────────────────────────────────────────── */

/**
 * @returns {{ok:true, coefficients:number[], left:string[], right:string[], balanced:string, steps:string[]}}
 *        | {ok:false, reason:string}
 */
export function balance(rawEquation) {
  const eq = parseEquation(rawEquation)
  if (!eq) return { ok: false, reason: 'Could not find two sides — check there is a → or = in the equation.' }

  const species = [...eq.left, ...eq.right]
  const parsed = species.map(parseFormula)
  const badIndex = parsed.findIndex(p => !p)
  if (badIndex >= 0) {
    return { ok: false, reason: `Could not read the formula "${species[badIndex]}".` }
  }

  const elements = [...new Set(parsed.flatMap(p => Object.keys(p)))]
  const nLeft = eq.left.length

  // Row per element, column per species. Products are negative so a balanced
  // equation is exactly the null space: sum of (coefficient x count) = 0.
  const matrix = elements.map(el =>
    parsed.map((p, j) => frac((p[el] || 0) * (j < nLeft ? 1 : -1))),
  )

  const steps = []
  steps.push(`Elements involved: ${elements.join(', ')}.`)
  steps.push('Set an unknown coefficient on each formula, then require every element to have equal atoms on both sides.')
  for (const el of elements) {
    const lhs = eq.left.map((f, j) => (parsed[j][el] || 0) ? `${parsed[j][el]}·[${f}]` : null).filter(Boolean)
    const rhs = eq.right.map((f, j) => (parsed[nLeft + j][el] || 0) ? `${parsed[nLeft + j][el]}·[${f}]` : null).filter(Boolean)
    if (lhs.length || rhs.length) steps.push(`${el}:  ${lhs.join(' + ') || '0'}  =  ${rhs.join(' + ') || '0'}`)
  }

  // Gaussian elimination to reduced row echelon form.
  const rows = matrix.length, cols = species.length
  const pivots = []
  let r = 0
  for (let c = 0; c < cols && r < rows; c++) {
    let pick = -1
    for (let k = r; k < rows; k++) if (!fZero(matrix[k][c])) { pick = k; break }
    if (pick < 0) continue
    ;[matrix[r], matrix[pick]] = [matrix[pick], matrix[r]]
    const lead = matrix[r][c]
    for (let j = 0; j < cols; j++) matrix[r][j] = fDiv(matrix[r][j], lead)
    for (let k = 0; k < rows; k++) {
      if (k === r || fZero(matrix[k][c])) continue
      const factor = matrix[k][c]
      for (let j = 0; j < cols; j++) matrix[k][j] = fSub(matrix[k][j], fMul(factor, matrix[r][j]))
    }
    pivots.push(c)
    r++
  }

  const freeCols = []
  for (let c = 0; c < cols; c++) if (!pivots.includes(c)) freeCols.push(c)

  if (freeCols.length === 0) {
    return { ok: false, reason: 'These formulas cannot be balanced — check the equation is written correctly.' }
  }
  if (freeCols.length > 1) {
    // More than one independent solution: the equation as written is ambiguous
    // (usually a species that cancels out entirely).
    return { ok: false, reason: 'This equation has more than one possible balance — it may be missing a product or have an extra species.' }
  }

  // Set the free variable to 1, back-substitute, then clear denominators.
  const sol = new Array(cols).fill(null).map(() => frac(0))
  sol[freeCols[0]] = frac(1)
  for (let k = pivots.length - 1; k >= 0; k--) {
    const c = pivots[k]
    let acc = frac(0)
    for (const fc of freeCols) acc = fAdd(acc, fMul(matrix[k][fc], sol[fc]))
    sol[c] = frac(-acc.n, acc.d)
  }

  const denomLcm = sol.reduce((acc, f) => lcm(acc, f.d), 1)
  let ints = sol.map(f => (f.n * denomLcm) / f.d)
  const g = ints.reduce((a, b) => gcd(a, b), 0)
  ints = ints.map(v => v / g)

  if (ints.some(v => v <= 0)) {
    return { ok: false, reason: 'No positive whole-number balance exists for this equation as written.' }
  }

  const show = (coef, formula) => (coef === 1 ? formula : `${coef}${formula}`)
  const balanced =
    eq.left.map((f, j) => show(ints[j], f)).join(' + ') +
    ' → ' +
    eq.right.map((f, j) => show(ints[nLeft + j], f)).join(' + ')

  steps.push('Solving those equations together gives the smallest whole-number coefficients:')
  steps.push(species.map((f, j) => `[${f}] = ${ints[j]}`).join(',  '))

  // Proof, not assertion: show the student the atom counts now match.
  const check = elements.map(el => {
    const l = eq.left.reduce((s, _f, j) => s + ints[j] * (parsed[j][el] || 0), 0)
    const rr = eq.right.reduce((s, _f, j) => s + ints[nLeft + j] * (parsed[nLeft + j][el] || 0), 0)
    return `${el}: ${l} on the left, ${rr} on the right`
  })
  steps.push(`Check — ${check.join('; ')}.`)

  return { ok: true, coefficients: ints, left: eq.left, right: eq.right, balanced, steps }
}
