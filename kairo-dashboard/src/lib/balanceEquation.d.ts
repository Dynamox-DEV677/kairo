/** Types for balanceEquation.js — plain JS so the tests import the real module. */
export function parseFormula(raw: string | null | undefined): Record<string, number> | null
export function parseEquation(raw: string | null | undefined): { left: string[]; right: string[] } | null
export function balance(rawEquation: string | null | undefined):
  | { ok: true; coefficients: number[]; left: string[]; right: string[]; balanced: string; steps: string[] }
  | { ok: false; reason: string }
