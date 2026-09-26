export interface ExamDateLike { name?: string | null; date?: string | null }
export interface UpcomingExam { name: string; date: string; ymd: string }

export function icsDate(isoDay: string | null | undefined): string | null
export function nextDay(ymd: string): string
export function escapeText(s: unknown): string
export function foldLine(line: string): string
export function upcomingExams(examDates: ExamDateLike[] | null | undefined, now?: number): UpcomingExam[]
export function buildIcs(examDates: ExamDateLike[] | null | undefined, opts?: { now?: number }): string
export function googleCalendarUrl(exam: ExamDateLike & { ymd?: string }): string | null
