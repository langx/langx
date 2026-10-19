import { normalizePlanTier, proWeekRecapWindowOpen, type ProWeekWire } from '@langx/shared'

/**
 * What the app reads off the Pro Week (`docs/decisions.md` → _The Pro Week: a
 * week of Pro at sign-up, behind a switch_). Pure, so the three questions the
 * screens ask are answered once and tested here rather than in a component.
 *
 * All three are answered from the person's own profile, never from a flag:
 * with `flags.proWeek` off nobody has a `proWeek`, and every answer below is
 * "no" — which is what keeps the app exactly as it was.
 */

/** The parts of the owner's profile these read. */
export interface ProWeekSubject {
  entitlement: { tier: string; expiresAt?: string; store?: string }
  proWeek?: ProWeekWire
}

/**
 * Whether this Pro is the week's: a gift, still running, on an account that
 * was given a Pro Week. A subscription or a lifetime is not — somebody who
 * subscribed during the week is a subscriber, and a subscriber is never told
 * their Pro has an end date it does not have.
 */
function onTheWeek(me: ProWeekSubject, now: Date): boolean {
  if (!me.proWeek) return false
  const { tier, expiresAt, store } = me.entitlement
  if (store?.toLowerCase() !== 'gift' || !expiresAt) return false
  return isPro(tier, expiresAt, now)
}

/**
 * `effectivePlanTier`'s rule with the clock passed in, so the tests can stand
 * on either side of an end date: Pro until `expiresAt`, and an unreadable date
 * is not evidence of expiry.
 */
function isPro(tier: string, expiresAt: string | undefined, now: Date): boolean {
  if (normalizePlanTier(tier) === 'free') return false
  if (!expiresAt) return true
  const at = Date.parse(expiresAt)
  return Number.isNaN(at) || at > now.getTime()
}

/**
 * The day "Pro · yours until {date}" names, or `null` when Pro features wear
 * nothing. The end of Pro as RevenueCat holds it, not the week's own end: a
 * code or a streak's gift stacked on the week moves the day Pro really ends,
 * and that is the day worth saying.
 */
export function proWeekUntil(me: ProWeekSubject | undefined, now: Date = new Date()): Date | null {
  if (!me || !onTheWeek(me, now)) return null
  return new Date(me.entitlement.expiresAt as string)
}

/**
 * Whether the end of onboarding is the Pro Week's moment rather than the
 * paywall's. Asked of the profile the server answered `POST /profiles` with,
 * so it is true from the first frame of the screen: a week that has started,
 * granted or still pending at RevenueCat, on an account that is not paying.
 */
export function proWeekStarted(me: ProWeekSubject | undefined): boolean {
  return me?.proWeek !== undefined && !holdsPaidPlan(me.entitlement)
}

/**
 * Whether to ask the server for the recap: the window is open, it has not
 * been seen, and the account is not on a plan somebody pays for or holds for
 * life — the recap ends in "Keep Pro", and nothing is sold to either. The
 * server asks again, with the gifts in hand.
 */
export function proWeekRecapDue(me: ProWeekSubject | undefined, now: Date = new Date()): boolean {
  const week = me?.proWeek
  if (!me || !week?.endsAt || week.recapSeenAt) return false
  if (holdsPaidPlan(me.entitlement, now)) return false
  return proWeekRecapWindowOpen(new Date(week.endsAt), now)
}

/** Pro that is not a gift: a store subscription, a free week from a store, or a lifetime. */
function holdsPaidPlan(
  entitlement: ProWeekSubject['entitlement'],
  now: Date = new Date(),
): boolean {
  if (!isPro(entitlement.tier, entitlement.expiresAt, now)) return false
  return entitlement.store?.toLowerCase() !== 'gift'
}
