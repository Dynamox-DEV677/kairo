export { logEvent, recordEvent, EVENT_TYPES, normalizeTopic } from './events.js'
export { applyToMastery, retentionFor }                       from './mastery.js'
export { recomputeTwin, getTwin }                             from './compute.js'
export { recomputeRecommendations }                           from './recommend.js'
export { recomputeObservations }                              from './observe.js'

import { recomputeTwin }              from './compute.js'
import { recomputeRecommendations }   from './recommend.js'
import { recomputeObservations }      from './observe.js'

export async function refreshTwinAll(userId) {
  if (!userId) return null
  const twin = await recomputeTwin(userId)
  await Promise.all([
    recomputeRecommendations(userId, { twin }),
    recomputeObservations(userId),
  ])
  return twin
}
