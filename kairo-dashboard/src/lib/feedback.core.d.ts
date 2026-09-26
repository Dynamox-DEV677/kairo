export type FeedbackCategory = 'bug' | 'idea' | 'question' | 'answer'

export const FEEDBACK_CATEGORIES: { id: FeedbackCategory; label: string }[]
export const FEEDBACK_SCREENS: { id: string; label: string }[]
export const MESSAGE_MIN: number
export const MESSAGE_MAX: number

export interface DeviceSummary { platform: 'android' | 'ios' | 'web'; viewport: string | null; online: boolean }
export function deviceSummary(env?: { platform?: string; width?: number; height?: number; online?: boolean }): DeviceSummary

export interface FeedbackValue {
  category: FeedbackCategory
  message: string
  screen: string
  appVersion: string | null
  device: DeviceSummary
}
export function normalizeFeedback(input: unknown): { ok: true; value: FeedbackValue } | { ok: false; error: string }
