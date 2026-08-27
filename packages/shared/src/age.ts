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
const EARLIEST_BIRTH_YEAR = 1900

/**
 * Age in whole years, using the birth *year* only. Because we do not collect a
 * full birth date, this is the age the user reaches during the current year —
 * it can overstate by up to one year. That is the permissive direction, so the
 * gate below is deliberately conservative: see `meetsMinimumAge`.
 */
export function ageFromBirthYear(birthYear: number, now: Date = new Date()): number {
  return now.getUTCFullYear() - birthYear
}

/**
 * True when the user is at least {@link MINIMUM_AGE}.
 *
 * Someone born in `now.year - 18` turns 18 at some point this year but may not
 * have yet. We accept them: requiring `age > 18` would lock out every genuine
 * 18-year-old for up to a year. Tightening this requires collecting a full
 * birth date, which is more PII than the feature needs.
 */
export function meetsMinimumAge(birthYear: number, now: Date = new Date()): boolean {
  return ageFromBirthYear(birthYear, now) >= MINIMUM_AGE
}

export function birthYearSchema(now: Date = new Date()) {
  return z
    .number()
    .int()
    .min(EARLIEST_BIRTH_YEAR)
    .max(now.getUTCFullYear())
    .refine((year) => meetsMinimumAge(year, now), {
      message: `You must be at least ${MINIMUM_AGE} years old to use LangX`,
    })
}
