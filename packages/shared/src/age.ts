import { z } from 'zod'

/**
 * LangX is 18+. This is already the published policy in the v1 Terms
 * ("You must be at least 18 years old to create an account and use the LangX
 * app") and it keeps the app clear of COPPA / GDPR-K, which matters because
 * discovery collects location and gender.
 *
 * Enforced server-side before a profile is written — the client date picker is
 * a convenience, not a gate.
 */
export const MINIMUM_AGE = 18

/** Oldest birth year we accept, to reject obvious garbage. */
export const EARLIEST_BIRTH_YEAR = 1900

/**
 * A birth date is a **calendar day**, stored as `YYYY-MM-DD`, never a `Date`.
 *
 * A `Date` is an instant, and an instant read in another time zone is a
 * different day — which is how a birthday gets celebrated on the 3rd for
 * everyone west of the person whose birthday it is. The string carries no
 * zone, cannot drift, sorts correctly, and compares with `<` for the range
 * queries discovery needs.
 */
const BIRTH_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

/** True when the string is a day that actually exists — 2001-02-30 is not. */
export function isCalendarDate(value: string): boolean {
  if (!BIRTH_DATE_PATTERN.test(value)) return false
  const [year, month, day] = value.split('-').map(Number) as [number, number, number]
  if (month < 1 || month > 12 || day < 1) return false
  // `Date.UTC` normalises an overflowing day (Feb 30 → Mar 2), so round-trip it
  // and insist the pieces come back unchanged. That is also what rejects a
  // 29 February in a year that has none, without a leap-year rule here.
  const roundTrip = new Date(Date.UTC(year, month - 1, day))
  return (
    roundTrip.getUTCFullYear() === year &&
    roundTrip.getUTCMonth() === month - 1 &&
    roundTrip.getUTCDate() === day
  )
}

export function birthYearOf(birthDate: string): number {
  return Number(birthDate.slice(0, 4))
}

/**
 * Age in whole years, counted from the birth *year* only — so it is the age
 * the person reaches during the current year, and it can overstate by up to a
 * year until their birthday.
 *
 * We now know the day and could be exact. We are not, deliberately: the gate
 * below is the same arithmetic, and an exact age here with a year-based gate
 * there would print "17" on the public profile of somebody the server let in.
 * One rule, applied twice. Tightening both is a product decision, not a
 * refactor — see `meetsMinimumAge`.
 */
export function ageFromBirthDate(birthDate: string, now: Date = new Date()): number {
  return now.getUTCFullYear() - birthYearOf(birthDate)
}

/**
 * True when the user is at least {@link MINIMUM_AGE}.
 *
 * Someone born in `now.year - 18` turns 18 at some point this year but may not
 * have yet. We accept them: requiring the birthday to have passed would lock
 * out every genuine 18-year-old for up to a year, and that was the call when
 * only the year was collected. Collecting the full date makes the strict
 * version *possible*; it does not make it decided.
 */
export function meetsMinimumAge(birthDate: string, now: Date = new Date()): boolean {
  return ageFromBirthDate(birthDate, now) >= MINIMUM_AGE
}

export function birthDateSchema(now: Date = new Date()) {
  return z
    .string()
    .trim()
    .refine(isCalendarDate, { message: 'Use a real date, as YYYY-MM-DD' })
    .refine((date) => birthYearOf(date) >= EARLIEST_BIRTH_YEAR, {
      message: `Birth year must be ${EARLIEST_BIRTH_YEAR} or later`,
    })
    .refine((date) => date <= now.toISOString().slice(0, 10), {
      message: 'A birth date cannot be in the future',
    })
    .refine((date) => meetsMinimumAge(date, now), {
      message: `You must be at least ${MINIMUM_AGE} years old to use LangX`,
    })
}
