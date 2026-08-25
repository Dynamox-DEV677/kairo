export interface DiagnosticQ {
  q: string
  options: string[]
  correctIndex: number
  topic: string
  difficulty: number
  subject: string
}
export const DIAGNOSTIC_BANK: Record<string, Omit<DiagnosticQ, 'subject'>[]>
export const DIAGNOSTIC_SIZE: number
export function pickDiagnostic(args?: { weak?: string[]; max?: number }): DiagnosticQ[]
