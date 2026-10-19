/**
 * The "New chats left today: 3 of 5" line over People, read off `/me/quota`.
 *
 * Both numbers are the server's: `limit` is the reader's own
 * `PLAN_LIMITS[tier].initiationsPer24h`, so the line can never print a total
 * the plan does not give, and `remaining` is the same count the new-chat
 * screen charges against. Nothing here knows what the free allowance is.
 *
 * Pure and free of `react-native`, so vitest can pin it.
 */

/** Past this many the pips would wrap the row; the sentence still says it. */
export const CHATS_LEFT_MAX_PIPS = 10

export interface ChatsLeft {
  left: number
  total: number
  /** Whether the row of dots is drawn beside the sentence. */
  pips: boolean
}

/**
 * `null` when there is no line to draw: still loading, failed, or no
 * allowance at all — Pro's `limit` is null, and a line that says "∞" is a
 * line about a number that does not exist. Gifted Pro is Pro here too, so
 * nobody on a gift is shown a count that reads as a reason to buy.
 */
export function chatsLeft(
  quota: { limit: number | null; remaining: number | null } | undefined,
): ChatsLeft | null {
  if (!quota || quota.limit === null || quota.remaining === null) return null
  const total = Math.max(0, quota.limit)
  // Clamped: a remaining count above the limit is a plan that just shrank
  // under a counter the server has not recounted yet.
  const left = Math.min(Math.max(0, quota.remaining), total)
  return { left, total, pips: total > 0 && total <= CHATS_LEFT_MAX_PIPS }
}
