import { TOKEN_RULES, type SendAward } from '@langx/shared'

/**
 * One chip under a sent message: "+10 · you corrected Anna".
 *
 *   - `corrected`: the correction's own pay.
 *   - `bothWrote`: the reciprocity bonus, paid once per conversation, the
 *     first time both people have written.
 *   - `streak`: a streak milestone this send crossed; `days` is the streak.
 */
export type ThreadReward =
  | { kind: 'corrected'; amount: number }
  | { kind: 'bothWrote'; amount: number }
  | { kind: 'streak'; amount: number; days: number }

/**
 * The chips a send's award is drawn as, in the order they sit under it.
 *
 * Every amount is the server's. `award.tokens` is the whole payout and
 * `streak.milestoneXp` the milestone's share of it; what remains is the send's
 * own pay plus the reciprocity bonus when it was paid. The split between those
 * two is the one place `TOKEN_RULES` is read, and only as a ceiling — the
 * send's own share is at most its rate (nothing once `capped`), so a send
 * never shows a bonus it did not get, and an award of zero, a frozen
 * sender's, draws nothing at all.
 *
 * A plain message's own point gets no chip. It is paid on nearly every send,
 * and a "+1" under every bubble would be a counter in the thread rather than
 * news; the chip is kept for the payouts that mean something happened.
 */
export function threadRewards(
  award: SendAward | undefined,
  kind: 'message' | 'correction',
): ThreadReward[] {
  if (!award || award.tokens <= 0) return []
  const milestone = Math.min(award.streak?.milestoneXp ?? 0, award.tokens)
  const rest = award.tokens - milestone
  // A capped message was paid nothing for itself; a correction is never capped.
  const ownRate =
    kind === 'correction'
      ? TOKEN_RULES.award.correction
      : award.capped
        ? 0
        : TOKEN_RULES.award.message
  const own = Math.min(rest, ownRate)
  const both = rest - own

  const chips: ThreadReward[] = []
  if (kind === 'correction' && own > 0) chips.push({ kind: 'corrected', amount: own })
  if (both > 0) chips.push({ kind: 'bothWrote', amount: both })
  if (milestone > 0 && award.streak) {
    chips.push({ kind: 'streak', amount: milestone, days: award.streak.current })
  }
  return chips
}
