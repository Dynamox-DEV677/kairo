import type { Graph, GraphNode, NodeState } from './syllabusGraph.core'

export interface RankedRow {
  node: GraphNode
  score: number
  state: NodeState['state']
  substitutedFor: GraphNode | null
  reason: string
}

export function riskScore(node: GraphNode, st: NodeState | undefined): number
export function rankNodes(graph: Graph, states: Map<string, NodeState>, opts?: { max?: number }): RankedRow[]
export function reasonFor(node: GraphNode, st: NodeState | undefined, substitutedFor?: GraphNode | null): string
