import { describe, expect, it } from 'vitest'
import { meetingIcs } from './icsFile'

const NOW = new Date('2026-09-07T10:00:00.000Z')
const START = new Date('2026-09-10T18:00:00.000Z')

describe('meetingIcs', () => {
  it('writes the instant in UTC, so both calendars render their own local time', () => {
    const ics = meetingIcs(
      { uid: 'm1', startsAt: START, durationMinutes: 30, summary: 'LangX' },
      NOW,
    )
    expect(ics).toContain('DTSTART:20260910T180000Z')
    expect(ics).toContain('DTEND:20260910T183000Z')
    expect(ics).toContain('DTSTAMP:20260907T100000Z')
    // No TZID anywhere: one file, right for both people, wherever they are.
    expect(ics).not.toContain('TZID')
  })

  it('ends the duration where the meeting does, not where the day does', () => {
    const ics = meetingIcs(
      { uid: 'm1', startsAt: START, durationMinutes: 60, summary: 'LangX' },
      NOW,
    )
    expect(ics).toContain('DTEND:20260910T190000Z')
  })

  it('keys the event so accepting twice updates one entry', () => {
    expect(
      meetingIcs({ uid: 'abc', startsAt: START, durationMinutes: 15, summary: 'x' }, NOW),
    ).toContain('UID:abc@langx.io')
  })

  /** An unescaped comma or newline ends the property and eats the rest of the sentence. */
  it('escapes what RFC 5545 treats as punctuation', () => {
    const ics = meetingIcs(
      {
        uid: 'm1',
        startsAt: START,
        durationMinutes: 30,
        summary: 'Talk',
        note: 'Bring a, b; and\nc',
      },
      NOW,
    )
    expect(ics).toContain(String.raw`DESCRIPTION:Bring a\, b\; and\nc`)
  })

  it('omits the description when there is no note, rather than writing an empty one', () => {
    expect(
      meetingIcs({ uid: 'm1', startsAt: START, durationMinutes: 30, summary: 'x' }, NOW),
    ).not.toContain('DESCRIPTION')
  })

  it('separates lines with CRLF, which is the one Outlook enforces', () => {
    const ics = meetingIcs({ uid: 'm1', startsAt: START, durationMinutes: 30, summary: 'x' }, NOW)
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true)
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true)
  })

  /**
   * Both fields, because no client shows both. Google renders `URL`, Apple
   * hides it behind an edit view, and several Android clients drop it — all
   * of them show the description.
   */
  it('carries the link back to the conversation in URL and in the description', () => {
    const ics = meetingIcs(
      {
        uid: 'm1',
        startsAt: START,
        durationMinutes: 30,
        summary: 'LangX',
        url: 'https://app.langx.io/chat/abc',
      },
      NOW,
    )
    expect(ics).toContain('URL:https://app.langx.io/chat/abc')
    expect(ics).toContain('DESCRIPTION:https://app.langx.io/chat/abc')
  })

  it('puts the note above the link when there is both', () => {
    const ics = meetingIcs(
      {
        uid: 'm1',
        startsAt: START,
        durationMinutes: 30,
        summary: 'LangX',
        note: 'Past tense',
        url: 'https://app.langx.io/chat/abc',
      },
      NOW,
    )
    expect(ics).toContain(String.raw`DESCRIPTION:Past tense\nhttps://app.langx.io/chat/abc`)
  })
})
