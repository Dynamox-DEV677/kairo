export const MIN_PARTS: number
export interface DiagramPart { label: string; clue: string }
export type DiagramParse =
  | { ok: true; diagramType: string; parts: DiagramPart[] }
  | { ok: false; reason: 'unreadable' | 'low-confidence'; diagramType?: string | null }
export function parseDiagramResponse(raw: unknown): DiagramParse
export function cardsFromDiagram(diagramType: string, parts: DiagramPart[]): Array<{ front: string; back: string; subject: null; topic: string }>
