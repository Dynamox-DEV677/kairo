export const PLAYLIST_CAP: number

export interface ListenItem {
  id: string
  title: string
  sub: string
  due: boolean
  script: string
}

export function speakableText(input: unknown): string
export function texToWords(tex: unknown): string
export function buildPlaylist(deck: unknown, opts?: { max?: number }): ListenItem[]
