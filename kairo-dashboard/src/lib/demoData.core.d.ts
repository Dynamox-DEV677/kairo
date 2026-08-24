export interface DemoEvent {
  type: string
  subject: string
  topic: string
  correct?: boolean
  score?: number
  difficulty?: number
  daysAgo: number
}
export const DEMO_QUIZ_EVENTS: DemoEvent[]
export const DEMO_ACTIVITY_EVENTS: DemoEvent[]
