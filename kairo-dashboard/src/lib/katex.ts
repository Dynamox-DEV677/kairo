/**
 * One KaTeX configuration for the whole app.
 *
 * KaTeX's default strict mode warns on every character it has no TeX command
 * for, and then refuses to render it. Physics and chemistry are made of those
 * characters: Ω, Å, °, ₹, µ, ℃. The console filled with "Unrecognized Unicode
 * character Ω" and the symbol vanished from a student's formula.
 *
 * strict:false renders the character as-is instead of warning and dropping it,
 * which is the right call for student content: an omega that looks like an
 * omega beats a silent gap. throwOnError keeps one malformed expression from
 * taking down the whole answer -- the bad bit shows in red, the rest renders.
 */
export const KATEX_OPTS = {
  strict: false as const,
  throwOnError: false,
  errorColor: '#E0705A',
  trust: false,
}
