export interface SearchDoc {
  id: string
  text: string
  [key: string]: unknown
}

/** Plain JSON on purpose: it is stored in IndexedDB and reloaded, not rebuilt. */
export interface SearchIndex {
  version: number
  postings: Record<string, Record<string, number>>
  lengths: number[]
  meta: SearchDoc[]
  docCount: number
  avgLen: number
}

export interface SearchResult {
  score: number
  doc: SearchDoc
  terms: string[]
  /** Share of the query's INFORMATION that was found, weighted by term rarity. */
  coverage: number
}

export interface SnippetPart { text: string; hit: boolean }
export interface Snippet {
  parts: SnippetPart[]
  truncatedStart: boolean
  truncatedEnd: boolean
}

export function stem(word: string): string
export function tokenize(text: string): string[]
export function chunk(text: string, opts?: { min?: number; max?: number }): string[]
export function chunkPages(
  pages: { page: number; text: string }[],
  opts?: { min?: number; max?: number },
): { text: string; page: number }[]
export function buildIndex(docs: SearchDoc[]): SearchIndex
export function mergeIndexes(indexes: SearchIndex[]): SearchIndex
export function search(
  index: SearchIndex,
  query: string,
  opts?: { limit?: number; minScore?: number },
): SearchResult[]
export function isConfident(
  results: SearchResult[],
  opts?: { minCoverage?: number; minLead?: number },
): boolean
export function snippet(
  text: string,
  terms: string[],
  opts?: { width?: number },
): Snippet
