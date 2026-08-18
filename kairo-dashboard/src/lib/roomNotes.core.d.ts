export const MAX_NOTES: number
export const MAX_LEN: number
export interface RoomNote { id: string; byKey: string; byName: string; text: string; ts: number }
export function makeNoteId(byKey: string, ts: number): string
export function makeNote(a: { byKey: string; byName: string; text: string; ts: number }): RoomNote | null
export function mergeNotes(current: RoomNote[] | unknown, incoming: RoomNote | RoomNote[] | unknown): RoomNote[]
export function removeNote(current: RoomNote[] | unknown, id: string): RoomNote[]
export function noteToNotebook(note: RoomNote, roomCode?: string): { kind: 'note'; title: string; content: string; subject: null; tags: string[]; source: string }
