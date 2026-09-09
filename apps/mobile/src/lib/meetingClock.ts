import type { Locale } from '@langx/shared'

/**
 * A meeting's instant, written in one particular person's zone.
 *
 * Read off a profile's `timezone`, not the device's: the device clock follows
 * wherever the phone is, and somebody reading this on a trip would be shown a
 * time that is right for the airport and wrong for the call. `undefined` falls
 * back to the device, which is the best guess left.
 *
 * Lived as a closure inside the chat screen until the starred list had to draw
 * the same card in one line — two callers, so it is genuinely shared rather
 * than extracted for its own sake, and being in `src/lib` is what makes it
 * testable at all (`vitest.config.ts` collects only this directory and the
 * catalogues).
 */
export function meetingClock(at: Date, zone: string | undefined, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    ...(zone ? { timeZone: zone } : {}),
  }).format(at)
}
