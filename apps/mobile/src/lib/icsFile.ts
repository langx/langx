/**
 * An accepted meeting, as a calendar file.
 *
 * **Everything is in UTC**, with the `Z` suffix RFC 5545 calls a UTC date-time.
 * That is what makes one file right for both people: the pair agreed on an
 * *instant*, and every calendar app renders an instant in whatever zone the
 * person reading it is in. Writing local times with a `TZID` would mean two
 * different files, a timezone database in the bundle, and a wrong answer for
 * anybody who travels between accepting and arriving.
 *
 * Pure, so the tests can reach it — the file writing and the share sheet
 * cannot be tested here, and none of the interesting part is in them.
 */

/** RFC 5545's basic-format UTC stamp: `20260910T180000Z`. */
function stamp(at: Date): string {
  return `${at.toISOString().replace(/[-:]/g, '').split('.')[0]}Z`
}

/**
 * Line folding and escaping, which are not optional.
 *
 * `,`, `;` and `\` are separators in a property value and have to be escaped,
 * and a newline is written as a literal `\n` — an unescaped one ends the
 * property and makes the rest of the sentence an unknown field, which Apple
 * Calendar drops silently and Google refuses the whole file for.
 */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/[,;]/g, (c) => `\\${c}`)
}

export interface MeetingEvent {
  /** Stable per meeting, so accepting twice updates one entry rather than adding two. */
  uid: string
  startsAt: Date
  durationMinutes: number
  summary: string
  note?: string | undefined
  /**
   * Back to the conversation this was agreed in.
   *
   * The reminder fires an hour before, on a device that may not be the one
   * the app is on, and without this the entry is a time with no way back to
   * the person. `webUrl` paths are claimed by the app through
   * `/.well-known/*`, so on a phone with LangX installed the tap opens the
   * thread rather than a browser.
   */
  url?: string | undefined
}

export function meetingIcs(event: MeetingEvent, now = new Date()): string {
  const end = new Date(event.startsAt.getTime() + event.durationMinutes * 60_000)
  const description = [event.note, event.url].filter(Boolean).join('\n')
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    // Required by the spec, and the one place the app names itself in a file
    // somebody else's calendar will keep.
    'PRODID:-//LangX//Language exchange//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${event.uid}@langx.io`,
    `DTSTAMP:${stamp(now)}`,
    `DTSTART:${stamp(event.startsAt)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${escapeText(event.summary)}`,
    /*
     * The link goes in both places on purpose. `URL` is the correct field and
     * Google Calendar renders it; Apple Calendar shows it only in an edit
     * view, and several Android clients ignore it entirely — all of them show
     * the description. One of the two is always visible.
     */
    ...(description ? [`DESCRIPTION:${escapeText(description)}`] : []),
    ...(event.url ? [`URL:${event.url}`] : []),
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  // CRLF, not LF. RFC 5545 says so, and Outlook is the one that enforces it.
  return `${lines.join('\r\n')}\r\n`
}
