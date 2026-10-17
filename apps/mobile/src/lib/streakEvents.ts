import { TOKEN_RULES, type CheckInResult } from '@langx/shared'
import type { AnalyticsEvent } from './analyticsEvents'

/**
 * The analytics events a check-in answer implies, and nothing it does not.
 *
 * Everything here is read off `POST /me/check-in`'s own response — the client
 * never infers a streak it was not told. That is also what limits it: the
 * response says what *this call* did, so a day first credited by something
 * other than a check-in (a message sent before the app's launch request landed)
 * comes back `advanced: false` and sends nothing. These are lower bounds, and
 * the server's activity map is the full record.
 *
 * Pure, so `vitest.config.ts` reaches it; `useDailyCheckIn` only loops `track`.
 */
export function streakEventsFor(
  result: Pick<CheckInResult, 'current' | 'longest' | 'advanced' | 'freezeUsed'>,
): AnalyticsEvent[] {
  // A check-in on a day already credited is the common case and says nothing new.
  if (!result.advanced) return []

  const events: AnalyticsEvent[] = [
    { name: 'streak_checked_in', properties: { days: result.current } },
  ]
  if (result.freezeUsed) events.push({ name: 'freeze_used', properties: { days: result.current } })
  if (isStreakMilestone(result.current)) {
    events.push({ name: 'streak_milestone_reached', properties: { days: result.current } })
  }
  /*
   * A new run starting at one while a longer one is on record: the streak
   * ended and this is the first day of the next. Both facts are in the
   * response. What it cannot say is how long the run that ended was, so it
   * carries the best on record instead — and a first-ever check-in, whose
   * longest is also one, is not a broken streak and sends nothing.
   *
   * It fires on the check-in after a lapse, so it counts people who came back
   * from one; somebody who never returned is not in it.
   */
  if (result.current === 1 && result.longest > 1) {
    events.push({ name: 'streak_broken', properties: { longest: result.longest } })
  }
  return events
}

/** The same table the review prompt and the badges read, never a list typed here. */
function isStreakMilestone(days: number): boolean {
  return Object.keys(TOKEN_RULES.streakMilestones).includes(String(days))
}
