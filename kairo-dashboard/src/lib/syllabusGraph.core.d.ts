export const SOLID_BAR: number
export const FADE_BAR: number
export const STATES: string[]

export interface GraphNode {
  id: string
  parent: string | null
  kind: 'subject' | 'unit' | 'chapter'
  name: string
  typical_marks?: number
  pyq_frequency?: number
  est_study_minutes?: number
  prereq?: string[]
  topics?: string[]
}

export interface Graph {
  id: string
  exam: string
  label: string
  byId: Map<string, GraphNode>
  chapters: GraphNode[]
  subjects: GraphNode[]
  units: GraphNode[]
}

export interface NodeState {
  state: 'UNTOUCHED' | 'SEEN' | 'PRACTISED' | 'SOLID' | 'FADING'
  mastery: number
  retention: number
  lastContact: number
}

export function loadGraph(json: unknown): Graph
export function subjectOfNode(graph: Graph, node: GraphNode): GraphNode | null
export function matchChapter(graph: Graph, subject: unknown, topic: unknown): string | null
export function nodeStates(graph: Graph, data: { events?: unknown[]; mastery?: unknown[] }): Map<string, NodeState>
export function coverage(graph: Graph, states: Map<string, NodeState>): {
  total: number
  touched: number
  pct: number
  untouched: GraphNode[]
  marksUntouched: number
}
