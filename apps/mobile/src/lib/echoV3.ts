import { completedEchoSessions, TOKEN_RULES, type EchoAward } from '@langx/shared'

/**
 * The redesign's Echo tab and done screen, as decisions rather than drawing:
 * what each line may claim, from what the server has actually said.
 */

/**
 * "About M minutes" for `cards` at this person's own pace, or null when the
 * summary has no pace to give — fewer than a session's answers, or an API
 * older than the field. Never zero: a card or two is still about a minute.
 */
export function reviewMinutes(
  cards: number,
  secondsPerCard: number | null | undefined,
): number | null {
  if (!secondsPerCard || cards <= 0) return null
  return Math.max(1, Math.round((cards * secondsPerCard) / 60))
}

export interface EchoDoneInput {
  /** What the batch paid, as the server answered it; absent from an older API. */
  award: EchoAward | undefined
  /**
   * The summary's `reviewedToday`, read off a summary fetched after the batch
   * landed — undefined while there is none. A rolling twenty-four hours, the
   * same window `settleSessions` counts sessions over (see `docs/decisions.md`
   * → _Echo leads with what is due, and the done screen says what it earned
   * — behind the same flag_ for the day that window is not).
   */
  reviewedToday: number | undefined
  /** Cards still due in this session's language or partner, fetched after the batch. */
  dueNext: number | undefined
}

export interface EchoDonePlan {
  /** Token this batch earned; null when it earned none, and then nothing is said. */
  tokens: number | null
  /** The streak's day after this batch, only when the batch's award reports it. */
  streakDay: number | null
  /**
   * `this`: the batch completed session `done` of `cap`. `all`: it completed
   * none, and today's `cap` are already done — the reason it earned nothing.
   * Null when neither can be said.
   */
  sessions: { kind: 'this' | 'all'; done: number; cap: number } | null
  /** Whether "One more session" leads: a paid session left today, and cards to fill it. */
  more: boolean
}

export function planEchoDone({ award, reviewedToday, dueNext }: EchoDoneInput): EchoDonePlan {
  const tokens = award && award.tokens > 0 ? award.tokens : null
  const streakDay = award?.streak && award.streak.current > 0 ? award.streak.current : null
  const cap = TOKEN_RULES.caps.echoSessionsPerDay
  // The function the server pays by, on the window it counts over, so the
  // number drawn and the sessions paid are one computation.
  const done = reviewedToday === undefined ? undefined : completedEchoSessions(reviewedToday)

  let sessions: EchoDonePlan['sessions'] = null
  if (done !== undefined) {
    if (tokens !== null && done > 0) sessions = { kind: 'this', done, cap }
    else if (done >= cap) sessions = { kind: 'all', done: cap, cap }
  }

  const more = done !== undefined && dueNext !== undefined && done < cap && dueNext > 0
  return { tokens, streakDay, sessions, more }
}
