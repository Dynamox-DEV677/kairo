/**
 * Twin module — single entry point.
 *
 *   import {
 *     logEvent, recordEvent,           // ingest events
 *     applyToMastery,                  // update per-topic mastery
 *     recomputeTwin, getTwin,          // snapshot
 *     recomputeRecommendations,        // adaptive suggestions
 *     recomputeObservations,           // supportive insights
 *     refreshTwinAll,                  // orchestrate everything for a user
 *   } from '../services/twin/index.js'
 */
export { logEvent, recordEvent, EVENT_TYPES, normalizeTopic } from './events.js'
export { applyToMastery, retentionFor }                       from './mastery.js'
export { recomputeTwin, getTwin }                             from './compute.js'
export { recomputeRecommendations }                           from './recommend.js'
export { recomputeObservations }                              from './observe.js'

import { recomputeTwin }              from './compute.js'
import { recomputeRecommendations }   from './recommend.js'
import { recomputeObservations }      from './observe.js'

/**
 * Full pipeline: recompute twin → recompute recommendations → recompute
 * observations. Use after a significant event (e.g. quiz completed) or
 * periodically. Returns the fresh snapshot.
 *
 * Total runtime is ~150–400 ms on warm Supabase. Safe to await in a request
 * handler, but for hot paths (every mark recorded) prefer firing in the
 * background with `refreshTwinAll(userId).catch(()=>{})`.
 */
export async function refreshTwinAll(userId) {
  if (!userId) return null
  const twin = await recomputeTwin(userId)
  await Promise.all([
    recomputeRecommendations(userId, { twin }),
    recomputeObservations(userId),
  ])
  return twin
}
