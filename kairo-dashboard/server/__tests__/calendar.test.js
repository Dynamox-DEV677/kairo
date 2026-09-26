/**
 * Exams into the student's calendar.
 *
 * What these pin: a file every calendar app accepts (CRLF, all-day dates,
 * lines folded by BYTES so an Indian-language exam name isn't corrupted), a
 * reminder that rings the morning before instead of at midnight, and a UID
 * that stays the same so importing twice never doubles every exam.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { icsDate, nextDay, escapeText, foldLine, upcomingExams, buildIcs, googleCalendarUrl } from '../../src/lib/calendar.core.js'

const NOW = new Date(2026, 8, 26, 10, 0, 0).getTime() // 26 Sep 2026

test('real dates convert; impossible ones are refused, not rolled over', () => {
  assert.equal(icsDate('2027-03-02'), '20270302')
  assert.equal(icsDate('2026-02-30'), null) // would silently become 2 March
  assert.equal(icsDate('2026-13-01'), null)
  assert.equal(icsDate('02/03/2027'), null)
  assert.equal(icsDate(''), null)
  assert.equal(icsDate(undefined), null)
})

test('an all-day exam ends the next day, across month, leap and year ends', () => {
  assert.equal(nextDay('20270302'), '20270303')
  assert.equal(nextDay('20270228'), '20270301')
  assert.equal(nextDay('20280228'), '20280229')
  assert.equal(nextDay('20261231'), '20270101')
})

test('only upcoming exams, soonest first; today counts, bad dates are dropped', () => {
  const ex = upcomingExams([
    { name: 'Maths', date: '2027-03-10' },
    { name: 'Past', date: '2026-09-01' },
    { name: 'Science', date: '2027-03-02' },
    { name: 'Today', date: '2026-09-26' },
    { name: 'Broken', date: '2027-02-30' },
    { name: '', date: '2027-04-01' },
  ], NOW)
  assert.deepEqual(ex.map(e => e.name), ['Today', 'Science', 'Maths', 'Exam'])
})

test('the .ics has the shape every calendar app expects', () => {
  const ics = buildIcs([{ name: 'Science', date: '2027-03-02' }], { now: NOW })
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n'))
  assert.ok(ics.endsWith('END:VCALENDAR\r\n'))
  assert.ok(!/[^\r]\n/.test(ics), 'every line ending is CRLF')
  assert.match(ics, /DTSTART;VALUE=DATE:20270302\r\n/)
  assert.match(ics, /DTEND;VALUE=DATE:20270303\r\n/)
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 1)
})

test('the reminder rings the morning before, not at midnight', () => {
  const ics = buildIcs([{ name: 'Science', date: '2027-03-02' }], { now: NOW })
  assert.match(ics, /TRIGGER:-PT15H\r\n/) // 00:00 on exam day minus 15h = 09:00 the day before
  assert.match(ics, /DESCRIPTION:Science is tomorrow\r\n/)
})

test('exporting twice gives the same UID, so re-importing never doubles an exam', () => {
  const uid = s => s.match(/UID:(.*)\r\n/)[1]
  const a = buildIcs([{ name: 'Science', date: '2027-03-02' }], { now: NOW })
  const b = buildIcs([{ name: 'Science', date: '2027-03-02' }], { now: NOW + 3_600_000 })
  assert.equal(uid(a), uid(b))
})

test('commas, semicolons and newlines in a name are escaped', () => {
  assert.equal(escapeText('Maths; Paper 1, Part A\nRoom 4'), 'Maths\\; Paper 1\\, Part A\\nRoom 4')
  const ics = buildIcs([{ name: 'Maths; Paper 1, Part A', date: '2027-03-10' }], { now: NOW })
  assert.match(ics, /SUMMARY:Maths\\; Paper 1\\, Part A\r\n/)
})

test('long lines fold at 75 bytes and never split a character', () => {
  const name = 'கணிதம் '.repeat(12) // Tamil: several bytes per character
  const folded = foldLine('SUMMARY:' + name)
  const enc = new TextEncoder()
  for (const line of folded.split('\r\n')) {
    assert.ok(enc.encode(line).length <= 75, `line is ${enc.encode(line).length} bytes`)
  }
  assert.equal(folded.replace(/\r\n /g, ''), 'SUMMARY:' + name, 'unfolding restores it exactly')
})

test('the Google Calendar link carries the exam as an all-day event', () => {
  const u = new URL(googleCalendarUrl({ name: 'Science', date: '2027-03-02' }))
  assert.equal(u.hostname, 'calendar.google.com')
  assert.equal(u.searchParams.get('action'), 'TEMPLATE')
  assert.equal(u.searchParams.get('text'), 'Science')
  assert.equal(u.searchParams.get('dates'), '20270302/20270303')
  assert.equal(googleCalendarUrl({ name: 'X', date: 'nope' }), null)
})
