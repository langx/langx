import { z } from 'zod'

/**
 * LangX is 16+.
 *
 * It was 18+ until September 2026, inherited from v1's published Terms and
 * chosen so that COPPA / GDPR-K could not apply — discovery collects location
 * and gender. Then the store questionnaires rated the content 13+ (Apple) and
 * Teen (Google): a rating of the content, not a floor on who may sign up, but
 * it showed 18 was a policy choice rather than a constraint. 16 is the highest
 * digital-consent age any EU state picked under GDPR Article 8, so at 16 no
 * country in the EU or UK needs a parental-consent flow, and COPPA (under-13s)
 * stays irrelevant. 13 would have needed both, which is why the floor stopped
 * here. See docs/decisions.md.
 *
 * Enforced server-side before a profile is written — the client date picker is
 * a convenience, not a gate.
 */
export const MINIMUM_AGE = 16

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
 * Someone born in `now.year - MINIMUM_AGE` reaches the age at some point this
 * year but may not have yet. We accept them: requiring the birthday to have
 * passed would lock out every genuine sixteen-year-old for up to a year, and
 * that was the call when only the year was collected. Collecting the full date makes the strict
 * version *possible*; it does not make it decided.
 */
export function meetsMinimumAge(birthDate: string, now: Date = new Date()): boolean {
  return ageFromBirthDate(birthDate, now) >= MINIMUM_AGE
}

/**
 * The age a surface asks for when it puts a *new* account in front of
 * strangers — "New on LangX" today. A fresh account is the one a stranger is
 * most likely to write to first, and a 16- or 17-year-old should not be shown
 * there, nor be shown it.
 */
export const ADULT_AGE = 18

/**
 * The latest birth date that is {@link ADULT_AGE} or older today (UTC), as
 * `YYYY-MM-DD`, so a Mongo range and a string comparison ask the same thing.
 *
 * The exact day, unlike `meetsMinimumAge`: that one errs towards letting a
 * person in, which is right for a sign-up and wrong for a safety gate. A
 * 29 February birthday reads as 1 March in a year without one — late by a day,
 * which is the direction a gate should be wrong in.
 */
export function adultBornOnOrBefore(now: Date = new Date()): string {
  const day = now.toISOString().slice(4, 10)
  return `${String(now.getUTCFullYear() - ADULT_AGE).padStart(4, '0')}${day}`
}

export function isAdult(birthDate: string, now: Date = new Date()): boolean {
  return birthDate <= adultBornOnOrBefore(now)
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
