/**
 * Exams into the student's own calendar -- offline, no account, no API.
 *
 * Two outputs from the same stored exam dates:
 *   - an .ics file (RFC 5545) holding every upcoming exam, for any calendar;
 *   - a Google Calendar "add event" link per exam. That one matters most: in
 *     the Android app there is no file plugin, so saving an .ics may simply not
 *     be possible there, while a link always opens.
 *
 * Exams are ALL-DAY events. The student gave a date, not a start time, and an
 * invented "9:00" would be a wrong fact sitting in their calendar.
 *
 * Pure. No React, no storage. node --test runs it.
 */

const pad = n => String(n).padStart(2, '0')

/** 'YYYY-MM-DD' -> 'YYYYMMDD', or null unless it is a real calendar date. */
export function icsDate(isoDay) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(isoDay ?? '').trim())
  if (!m) return null
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3])
  const dt = new Date(y, mo - 1, d)
  // 2026-02-30 would silently roll into March; reject it instead.
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null
  return `${m[1]}${m[2]}${m[3]}`
}

const toDate = ymd => new Date(Number(ymd.slice(0, 4)), Number(ymd.slice(4, 6)) - 1, Number(ymd.slice(6, 8)))

/** The day after, for an all-day event's exclusive DTEND. Handles month and year ends. */
export function nextDay(ymd) {
  const d = toDate(ymd)
  d.setDate(d.getDate() + 1)
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`
}

/** RFC 5545 TEXT escaping: backslash first, then ; , and newlines. */
export function escapeText(s) {
  return String(s ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

/**
 * Fold a content line at 75 OCTETS (RFC 5545 §3.1), not 75 characters.
 *
 * An exam name in Tamil or Hindi is several bytes per character; folding by
 * character count produces over-long lines, and folding by bytes without care
 * splits a character in half -- which some calendar apps show as garbage.
 * Continuation lines start with a space, which counts against their 75.
 */
export function foldLine(line) {
  const enc = new TextEncoder()
  if (enc.encode(line).length <= 75) return line
  const parts = []
  let cur = '', bytes = 0, limit = 75
  for (const ch of line) { // iterates whole code points
    const b = enc.encode(ch).length
    if (bytes + b > limit) { parts.push(cur); cur = ''; bytes = 0; limit = 74 }
    cur += ch; bytes += b
  }
  if (cur) parts.push(cur)
  return parts.join('\r\n ')
}

/** Upcoming exams only (today counts), soonest first, bad dates dropped. */
export function upcomingExams(examDates, now = Date.now()) {
  const today = new Date(now); today.setHours(0, 0, 0, 0)
  return (Array.isArray(examDates) ? examDates : [])
    .map(e => ({ name: String(e?.name ?? '').trim() || 'Exam', date: String(e?.date ?? '').trim(), ymd: icsDate(e?.date) }))
    .filter(e => e.ymd && toDate(e.ymd) >= today)
    .sort((a, b) => a.ymd.localeCompare(b.ymd))
}

function utcStamp(now) {
  const d = new Date(now)
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
}

/**
 * A UID that is the same every export, so importing the file twice updates the
 * events instead of doubling every exam in the student's calendar.
 */
function uid(e) {
  const slug = e.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'exam'
  return `${e.ymd}-${slug}@kyno.kairo`
}

/**
 * The .ics text for every upcoming exam, CRLF line endings as the RFC requires.
 * Each exam gets a reminder at 9 am the day before: -PT15H from the midnight
 * the all-day event starts at. (-P1D would ring at midnight.)
 */
export function buildIcs(examDates, { now = Date.now() } = {}) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Kairo Industries//Kyno//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Kyno exams',
  ]
  for (const e of upcomingExams(examDates, now)) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${uid(e)}`,
      `DTSTAMP:${utcStamp(now)}`,
      `DTSTART;VALUE=DATE:${e.ymd}`,
      `DTEND;VALUE=DATE:${nextDay(e.ymd)}`,
      `SUMMARY:${escapeText(e.name)}`,
      `DESCRIPTION:${escapeText('Added from Kyno.')}`,
      'TRANSP:TRANSPARENT',
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${escapeText(`${e.name} is tomorrow`)}`,
      'TRIGGER:-PT15H',
      'END:VALARM',
      'END:VEVENT',
    )
  }
  lines.push('END:VCALENDAR')
  return lines.map(foldLine).join('\r\n') + '\r\n'
}

/** Google Calendar's prefilled "add event" page for one exam, or null for a bad date. */
export function googleCalendarUrl(exam) {
  const ymd = exam?.ymd || icsDate(exam?.date)
  if (!ymd) return null
  const q = new URLSearchParams({
    action: 'TEMPLATE',
    text: String(exam?.name ?? '').trim() || 'Exam',
    dates: `${ymd}/${nextDay(ymd)}`,
    details: 'Added from Kyno.',
  })
  return `https://calendar.google.com/calendar/render?${q.toString()}`
}
