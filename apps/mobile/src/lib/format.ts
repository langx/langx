import type { Locale } from '@langx/shared'
import type { TranslateFn } from '../i18n/runtime'

export interface FormatOptions {
  t: TranslateFn
  locale: Locale
  now?: Date
}

/**
 * "1 day", not "1 days".
 *
 * A streak of one is the single most common value there is — it is what every
 * user sees on the day they start — so the plural-by-default version is wrong
 * in exactly the place most people meet it. The catalogue carries the plural
 * categories now, which is the same rule stated in a form Russian can answer.
 */
export function days(t: TranslateFn, count: number): string {
  return t('format.days', { count })
}

/** Whole units elapsed, floored, never negative. Shared by both formatters. */
function elapsed(iso: string, now: Date): { seconds: number; at: Date } | null {
  const at = new Date(iso)
  if (Number.isNaN(at.getTime())) return null
  return { seconds: Math.max(0, Math.round((now.getTime() - at.getTime()) / 1000)), at }
}

/**
 * "12 min", "3 h", "2 d" — how stale something is, in one or two characters.
 *
 * Coarse on purpose. A feed post is either fresh enough to still want an answer
 * or it is not, and "12 minutes ago" spends a line saying what "12 min" says in
 * a corner. Anything past a week gets the date, because at that point the age
 * matters less than when it was.
 */
export function relativeTime(iso: string, { t, locale, now = new Date() }: FormatOptions): string {
  const parsed = elapsed(iso, now)
  if (!parsed) return ''
  const { seconds, at } = parsed

  if (seconds < 60) return t('format.now')
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return t('format.minutes', { count: minutes })
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return t('format.hours', { count: hours })
  const elapsedDays = Math.floor(hours / 24)
  if (elapsedDays < 7) return t('format.daysShort', { count: elapsedDays })
  return at.toLocaleDateString(locale, { day: 'numeric', month: 'short' })
}

/**
 * The same steps with no space — "12m", "3h" — for the conversation list,
 * where the timestamp shares a row with a name that deserves the width.
 */
export function relativeTimeCompact(
  iso: string,
  { t, locale, now = new Date() }: FormatOptions,
): string {
  const parsed = elapsed(iso, now)
  if (!parsed) return ''
  const { seconds, at } = parsed

  if (seconds < 60) return t('format.now')
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return t('format.minutesCompact', { count: minutes })
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return t('format.hoursCompact', { count: hours })
  const elapsedDays = Math.floor(hours / 24)
  if (elapsedDays < 7) return t('format.daysCompact', { count: elapsedDays })
  return at.toLocaleDateString(locale)
}

/**
 * How long until something is due — `10m`, `3h`, `4d` — or `null` once it is.
 *
 * The mirror of `relativeTimeCompact`, which only ever looks backwards: its
 * `elapsed` floors at zero, so a future date reads as "now" there. An Echo
 * card's next review is the one thing in the app that is genuinely ahead of
 * the clock, and a schedule that says "now" for tomorrow would be a lie about
 * the only number on the row.
 *
 * Rounded rather than floored, unlike the ages above: 23 hours away is a day,
 * not "23h", and a card that comes back in 90 seconds is "2m", not "1m".
 * `null` for a card already due — the caller has a word for that and it is not
 * a duration.
 */
export function dueInCompact(
  iso: string,
  { t, now = new Date() }: Omit<FormatOptions, 'locale'>,
): string | null {
  const at = new Date(iso)
  if (Number.isNaN(at.getTime())) return null
  const minutes = Math.round((at.getTime() - now.getTime()) / 60_000)
  if (minutes <= 0) return null
  return compactDuration(t, minutes)
}

/**
 * A span of minutes as one or two characters, for a schedule rather than an
 * age: the grade buttons in a review say what each answer costs in exactly
 * this shape, and the row in the card list says the same thing about the card.
 * Floored at a minute, because every caller is describing something that will
 * happen and "0m" describes nothing.
 */
export function compactDuration(t: TranslateFn, minutes: number): string {
  if (minutes < 60) return t('format.minutesCompact', { count: Math.max(1, minutes) })
  if (minutes < 60 * 24) return t('format.hoursCompact', { count: Math.round(minutes / 60) })
  return t('format.daysCompact', { count: Math.round(minutes / (60 * 24)) })
}

/**
 * A count that has to fit in a tile: `845`, `1.1k`, `19k`, `2.3M`.
 *
 * Below a thousand it is the number, grouped for the locale. From a thousand
 * up it is shortened, with one decimal only while the leading figure is a
 * single digit — `1.1k` says something `1k` does not, `19.4k` says nothing
 * `19k` does not. Rounded down, never up: a balance that reads `2k` when it
 * is 1,950 is a promise the wallet cannot keep. The decimal separator is the
 * locale's; the letter is not translated, `k` and `M` being what every
 * locale here already reads on a screen.
 */
export function compactCount(value: number, locale: string): string {
  const abs = Math.abs(value)
  if (abs < 1000) return value.toLocaleString(locale)
  const [divisor, suffix] = abs < 1_000_000 ? [1000, 'k'] : [1_000_000, 'M']
  const scaled = abs / divisor
  const digits = scaled < 10 ? 1 : 0
  const factor = 10 ** digits
  const floored = Math.floor(scaled * factor) / factor
  const sign = value < 0 ? '-' : ''
  return `${sign}${floored.toLocaleString(locale, { maximumFractionDigits: digits })}${suffix}`
}
