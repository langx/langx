/**
 * The queue behind `RewardToast`: "+15 · you both wrote today", one at a time.
 *
 * Pure, and apart from the component, for the reason `toast.ts` gives: this
 * directory is the only one the tests can reach, and every decision about
 * which reward shows when is a function of the queue.
 *
 * Three rules, decided once:
 *
 *   - **One at a time, in order.** The head is the one on screen; the rest
 *     wait. Two rewards landing together must not leave the person having
 *     seen only one of them.
 *   - **Same reason, one toast.** A reward that arrives while another for the
 *     same reason is still waiting is added to it, so five quick Echo cards
 *     read "+5" once rather than "+1" five times in a row. Never into the
 *     head: the number on a toast already showing does not change under the
 *     reader's eyes.
 *   - **Nothing for nothing.** An amount that is not a positive whole number
 *     is dropped — a "+0" or a "+NaN" is a toast claiming a reward that did
 *     not happen.
 *
 * Whether it buzzes is the caller's to ask for (`haptic`), never the queue's
 * to decide, and a merged reward buzzes if either half asked.
 */

export interface Reward {
  amount: number
  /** Already translated: what the reward was for. */
  reason: string
  haptic?: boolean
}

export interface QueuedReward {
  id: number
  amount: number
  reason: string
  haptic: boolean
}

/**
 * How long one stays up once it has arrived. Shorter than a toast's four
 * seconds: there is no sentence to read, only a number and a few words, and
 * the next one may be waiting.
 */
export const REWARD_TOAST_MS = 2400

export function enqueueReward(
  queue: readonly QueuedReward[],
  reward: Reward,
  id: number,
): QueuedReward[] {
  if (!Number.isInteger(reward.amount) || reward.amount <= 0) return [...queue]
  const haptic = reward.haptic ?? false
  const waiting = queue.findIndex((item, index) => index > 0 && item.reason === reward.reason)
  if (waiting === -1) return [...queue, { id, amount: reward.amount, reason: reward.reason, haptic }]
  return queue.map((item, index) =>
    index === waiting
      ? { ...item, amount: item.amount + reward.amount, haptic: item.haptic || haptic }
      : item,
  )
}

/** Takes a reward off the queue once it has left the screen, or was tapped away. */
export function finishReward(queue: readonly QueuedReward[], id: number): QueuedReward[] {
  return queue.filter((item) => item.id !== id)
}
