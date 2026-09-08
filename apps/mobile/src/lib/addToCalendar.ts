import { Platform } from 'react-native'
import { FLAG_KEYS, readJsonFlag, writeJsonFlag } from './localFlags'
import { saveMeetingIcs } from './saveFile'
import type { MeetingEvent } from './icsFile'
// Types only — erased at compile time, so this does not resolve the module.
import type { ExpoCalendar } from 'expo-calendar'

/**
 * What happened, rather than a boolean.
 *
 * The four failures want four different sentences — a refused prompt is not a
 * broken one, and a phone with no writable calendar is neither. `saved` is the
 * web's answer: a file was downloaded, because a browser has no calendar to
 * write to.
 */
export type CalendarResult = 'added' | 'updated' | 'saved' | 'denied' | 'noCalendar' | 'failed'

/**
 * Puts an agreed meeting straight into the calendar.
 *
 * It used to write an `.ics` and open the share sheet, on the reasoning that
 * both platforms offer "Add to Calendar" in there. They do, several taps down,
 * under a file named after a database id — so what the button actually did was
 * hand somebody a file and wish them luck.
 *
 * The web still gets the file. There is no calendar API in a browser, and an
 * `.ics` is what every calendar app has imported for twenty years.
 */
export async function addMeetingToCalendar(event: MeetingEvent): Promise<CalendarResult> {
  if (Platform.OS === 'web') {
    return (await saveMeetingIcs(event)) ? 'saved' : 'failed'
  }

  try {
    /*
     * Imported here, not at the top of the file. A native module resolved at
     * module scope is evaluated wherever this file is — on the web, where it
     * has nothing to bind to, and in any build made before it was added, where
     * it throws `Cannot find native module` on *import* and takes the whole
     * chat screen down with it. Same reason `localFlags` reaches for
     * `expo-secure-store` inside each call; see docs/decisions.md.
     */
    const Calendar = await import('expo-calendar')
    // Write-only: this adds one event and never reads what else is in
    // somebody's day. iOS 17 has a narrower prompt for exactly that, and it is
    // the one the config plugin writes the string for.
    const permission = await Calendar.requestCalendarPermissions(true)
    if (!permission.granted) return 'denied'

    const calendar = await writableCalendar()
    if (!calendar) return 'noCalendar'

    const end = new Date(event.startsAt.getTime() + event.durationMinutes * 60_000)
    /*
     * The link goes in the notes as well as in `url`. Google Calendar renders
     * `url`, Apple Calendar shows it only in an edit view and several Android
     * clients ignore it — all of them show the notes. Same reasoning as the
     * `.ics`, which writes it into both fields for the same reason.
     */
    const details = {
      title: event.summary,
      startDate: event.startsAt,
      endDate: end,
      notes: [event.note, event.url].filter(Boolean).join('\n'),
      ...(event.url ? { url: event.url } : {}),
      // An hour before, which is what the meeting card promises and what the
      // reminder was always meant to be.
      alarms: [{ relativeOffset: -60 }],
    }

    const known = await knownEventId(event.uid)
    if (known) {
      try {
        const existing = await Calendar.ExpoCalendarEvent.get(known)
        await existing.update(details)
        return 'updated'
      } catch {
        // Deleted by hand since we wrote it. Fall through and make a new one
        // rather than reporting a failure for something the user did on
        // purpose.
      }
    }

    const created = await calendar.createEvent(details)
    await remember(event.uid, created.id)
    return 'added'
  } catch {
    // The file is the fallback, so the button is never a no-op: a share sheet
    // is a worse answer than a calendar entry and a better one than nothing.
    return (await saveMeetingIcs(event)) ? 'saved' : 'failed'
  }
}

/**
 * Where to write.
 *
 * iOS has one default calendar and it is the right answer. Android has no such
 * thing — `getDefaultCalendarSync` is iOS-only — so the first writable one is
 * the best guess, preferring an account's primary.
 */
async function writableCalendar(): Promise<ExpoCalendar | null> {
  const Calendar = await import('expo-calendar')
  if (Platform.OS === 'ios') {
    try {
      return Calendar.getDefaultCalendarSync()
    } catch {
      // No default set. The list below is still worth trying.
    }
  }
  const calendars = await Calendar.getCalendars(Calendar.EntityTypes.EVENT)
  const writable = calendars.filter((c) => c.allowsModifications)
  return writable.find((c) => c.isPrimary) ?? writable[0] ?? null
}

/** `meetingId -> event id`, so accepting twice does not stack up two entries. */
async function knownEventId(uid: string): Promise<string | null> {
  const map = await readJsonFlag<Record<string, string>>(FLAG_KEYS.calendarEvents)
  return map?.[uid] ?? null
}

async function remember(uid: string, eventId: string): Promise<void> {
  const map = (await readJsonFlag<Record<string, string>>(FLAG_KEYS.calendarEvents)) ?? {}
  await writeJsonFlag(FLAG_KEYS.calendarEvents, { ...map, [uid]: eventId })
}
