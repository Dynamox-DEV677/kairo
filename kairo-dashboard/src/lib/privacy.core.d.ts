export interface DataFlow {
  id: string
  category: string
  what: string
  when: string
  where: string
  appliesWhen: 'always' | 'signed-in' | 'on-use' | 'school-mode' | 'never-personal'
  optional: boolean
  note?: string
}

export interface PrivacyState {
  signedIn?: boolean
  schoolMode?: boolean
  telemetry?: boolean
}

export const ROUTE_CATEGORY: Record<string, string>
export const DATA_FLOWS: DataFlow[]
export function activeFlows(state?: PrivacyState): DataFlow[]
export function privacyHeadline(state?: PrivacyState): string
