import { shiftDayKey } from './periods'

/**
 * What "it is working" means, written down once.
 *
 * The redesign is judged against a baseline, and a baseline is only a
 * baseline if the thing it measures stays still. These are the definitions the
 * operator panel's measurement screen computes with; changing one changes what
 * every earlier reading means, so it is a decision with a dated entry in
 * `docs/decisions.md`, not a tweak.
 *
 * Config in `packages/shared` for the reason `PLAN_LIMITS` is: a threshold read
 * at a call site is a threshold that gets copied, and the copy is the one that
 * drifts.
 */

/**
 * Activation: a new member has had two real conversations in their first three
 * days.
 *
 * "Real" is **two-way** — both people have written at least once. A first
 * message that nobody answered is an attempt, and counting attempts would make
 * the number rise when we get better at sending and not when we get better at
 * connecting people. The moment a conversation becomes two-way is when the
 * person who did not open it first writes back, so a conversation counts for
 * the member only if that reply landed inside the window.
 *
 * It does not matter who opened it. Answering a stranger within three days is
 * as much an activation as writing to one: the point is that the member found
 * somebody to talk to, not which of them spoke first.
 */
export const ACTIVATION_RULES = {
  /** Two-way conversations a new member needs. */
  conversations: 2,
  /** Hours after sign-up in which they have to have become two-way. */
  windowHours: 72,
} as const

export interface ActivationRules {
  readonly conversations: number
  readonly windowHours: number
}

const HOUR_MS = 60 * 60 * 1000

/** The instant the activation window closes for somebody who signed up at `signedUpAt`. */
export function activationWindowEnd(
  signedUpAt: Date,
  rules: ActivationRules = ACTIVATION_RULES,
): Date {
  return new Date(signedUpAt.getTime() + rules.windowHours * HOUR_MS)
}

/**
 * Whether the window has closed, which is when "not activated" starts to mean
 * something. Before that a member who has not activated yet may still do it,
 * so they belong in neither the numerator nor the denominator of a rate.
 */
export function isActivationSettled(
  signedUpAt: Date,
  now: Date,
  rules: ActivationRules = ACTIVATION_RULES,
): boolean {
  return now.getTime() >= activationWindowEnd(signedUpAt, rules).getTime()
}

/**
 * Whether a member is activated, given the instants their conversations became
 * two-way. Pure, so the definition can be tested without a database.
 *
 * Both ends of the window are inclusive; a reply before sign-up cannot exist
 * and is ignored rather than trusted.
 */
export function isActivated(
  signedUpAt: Date,
  becameTwoWayAt: readonly Date[],
  rules: ActivationRules = ACTIVATION_RULES,
): boolean {
  const from = signedUpAt.getTime()
  const to = activationWindowEnd(signedUpAt, rules).getTime()
  const inside = becameTwoWayAt.filter((at) => {
    const t = at.getTime()
    return t >= from && t <= to
  })
  return inside.length >= rules.conversations
}

/**
 * The days after sign-up a cohort is read at. Day N means "was in the app on
 * the Nth calendar day after the day they joined" — on that day exactly, not
 * on or before it, which is the usual meaning of D7 and the one a comparison
 * with other products needs.
 */
export const COHORT_RETURN_DAYS = [1, 7, 30] as const
export type CohortReturnDay = (typeof COHORT_RETURN_DAYS)[number]

/**
 * The first local day for which the server holds a record of somebody merely
 * opening the app.
 *
 * Return is read from `streakDays`, the one collection that says which days a
 * person showed up. It has existed since 29 August 2026, but a day with
 * nothing in it but a visit was only written from 1 September ("Let opening
 * the app hold the streak"); before that a day was recorded only when the
 * person did something that counted. A return day earlier than this reads low
 * for a reason that has nothing to do with the person, so it is not measured
 * at all.
 */
export const RETURN_RECORDED_FROM = '2026-09-01'

/**
 * Whether Day N of somebody who joined on `signupDay` (their own local day) can
 * be read yet: that day has fully ended in their zone (`today` is their local
 * today), and the server was recording visits on it.
 */
export function isReturnMeasurable(
  signupDay: string,
  n: number,
  today: string,
  recordedFrom: string = RETURN_RECORDED_FROM,
): boolean {
  const day = shiftDayKey(signupDay, n)
  return day >= recordedFrom && day < today
}

/**
 * First messages that nobody has answered after this long. A day is long
 * enough that "not yet" has become "probably not", and short enough that the
 * sender is still around to be disappointed.
 */
export const FIRST_MESSAGE_RULES = {
  unansweredAfterHours: 24,
} as const

/** `YYYY-MM-DD` of the UTC Monday that starts the week `date` falls in. */
export function weekStartKey(date: Date): string {
  const sinceMonday = (date.getUTCDay() + 6) % 7
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - sinceMonday),
  )
    .toISOString()
    .slice(0, 10)
}
