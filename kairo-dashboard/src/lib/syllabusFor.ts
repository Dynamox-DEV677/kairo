/**
 * Which syllabus graph applies to this student. Two graphs so far -- CBSE 12
 * PCM and CBSE 10 Science + Mathematics (seeded for the Plan space); the rest
 * arrive as data files and register here. Null = no map for this class yet, and the UI says so
 * honestly instead of showing someone else's syllabus.
 */
import { loadGraph, type Graph } from './syllabusGraph.core'
import cbse12pcm from '../data/syllabusGraph/cbse12-pcm.json'
import cbse10 from '../data/syllabusGraph/cbse10.json'

let cache: Map<string, Graph> | null = null

function registry(): Map<string, Graph> {
  if (!cache) {
    cache = new Map()
    cache.set('cbse12-pcm', loadGraph(cbse12pcm))
    cache.set('cbse10', loadGraph(cbse10))
  }
  return cache
}

export function graphForProfile(profile: { board?: string; cls?: string } | null | undefined): Graph | null {
  const board = String(profile?.board || '').toLowerCase()
  const cls = String(profile?.cls || '').replace(/\D/g, '')
  if (board.includes('cbse') && cls === '12') return registry().get('cbse12-pcm') || null
  if (board.includes('cbse') && cls === '10') return registry().get('cbse10') || null
  return null
}
