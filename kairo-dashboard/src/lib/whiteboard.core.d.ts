export interface Stroke { mode: 'pen'; points: Array<[number, number]> }
export interface BoardLine { n: number; text: string; ok: boolean }
export interface BoardResult {
  status: 'correct' | 'mistake' | 'inprogress' | 'unclear'
  lines: BoardLine[]
  firstWrongLine: number | null
  feedback: string
  done: boolean
}

export function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number
export function eraseHits(strokes: Stroke[], x: number, y: number, r: number): number[]
export function inkBounds(strokes: Stroke[]): { minX: number; minY: number; maxX: number; maxY: number } | null
export function normalizeBoardResult(raw: unknown): BoardResult
export function boardVerdict(r: BoardResult): { tone: 'good' | 'warn' | 'info'; title: string }
