import type { Locale } from '@langx/shared'

/**
 * What time it is where the other person is, for the chat header — or `null`
 * when saying so would add nothing.
 *
 * `theirZone` is absent when they hide their city: `toPublicProfile` withholds
 * the timezone with it, so there is no second privacy check to make here.
 * `ownZone` is the reader's profile zone and falls back to the device's, the
 * same way `meetingClock` does.
 *
 * Compared as drawn, not as named, for the reason `meetingTheirWhenFor` in the
 * chat screen gives: a reader with no zone on file compares against the
 * device, and two zones with different names can agree right now
 * (`Europe/London` and `Africa/Abidjan` in winter). Either way "11:14 PM for
 * them" beside a phone that also says 11:14 PM is a line that says nothing.
 *
 * `null` rather than a throw for a zone the runtime does not know. The field is
 * any non-empty string as far as the schema is concerned, Hermes ships its own
 * zone data, and `Intl.DateTimeFormat` answers an unknown one with a
 * `RangeError` — which, inside a header, would take the whole thread down with
 * it over a clock nobody asked for.
 */
export function theirLocalTime(
  now: Date,
  theirZone: string | undefined,
  ownZone: string | undefined,
  locale: Locale,
): string | null {
  if (!theirZone) return null
  try {
    const theirs = wallClock(now, theirZone, locale)
    return theirs === wallClock(now, ownZone, locale) ? null : theirs
  } catch {
    return null
  }
}

/**
 * Hours and minutes only. `meetingClock` writes the weekday and the date as
 * well, which a meeting card needs and a header line that is already sharing
 * its width with "Last seen 3 hours ago" cannot afford.
 */
function wallClock(at: Date, zone: string | undefined, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, {
    hour: 'numeric',
    minute: '2-digit',
    ...(zone ? { timeZone: zone } : {}),
  }).format(at)
}

/** Milliseconds from `nowMs` to the next whole minute; a full minute when on one. */
export function msUntilNextMinute(nowMs: number): number {
  return 60_000 - (nowMs % 60_000)
}

/** The current minute since the epoch — the snapshot `subscribeToMinute` changes. */
export function currentMinute(): number {
  return Math.floor(Date.now() / 60_000)
}

/**
 * Calls `onTick` as each minute turns over, until the returned function is
 * called.
 *
 * A chain of timeouts aimed at the boundary rather than `setInterval(60_000)`.
 * An interval started at :40 changes the displayed minute forty seconds late,
 * every minute, and drifts from there; it also does not recover from the app
 * sitting in the background, where React Native stops running timers. Each
 * link here measures from the real clock, so an overdue one fires once on
 * return and the next is back on the boundary.
 */
export function subscribeToMinute(onTick: () => void): () => void {
  let timer: ReturnType<typeof setTimeout>
  const arm = () => {
    timer = setTimeout(() => {
      onTick()
      arm()
    }, msUntilNextMinute(Date.now()))
  }
  arm()
  return () => clearTimeout(timer)
}
