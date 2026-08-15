/** Types for cleanupLocalData.js. Pure: returns a NEW state plus a report, so
 *  a dry run is possible and a bug here cannot destroy local history. */
export interface CleanupReport {
  topicsMerged: number
  junkNodesRemoved: number
  subjectsRetagged: number
  doubtsRemoved: number
  formulasMerged: number
  cardsDeduped: number
  masteryRowsMerged: number
  details: string[]
}
export function cleanupLocalData<T>(state: T): { state: T; report: CleanupReport }
export function summarise(report: CleanupReport): string
