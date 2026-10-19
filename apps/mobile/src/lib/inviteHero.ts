import { effectivePlanTier, planChangeFor, type HeldPlan } from '@langx/shared'

/**
 * What the invite screen leads with while "give a week, get a week"
 * (`flags.giveAWeek`) is on — and `null`, the screen as it always was, while
 * it is off or before the config has arrived.
 *
 * - `guest`: nothing to invite from yet. The deal is shown, and the hero's
 *   button makes the account an invite link needs.
 * - `earn`: the free plan — a week each.
 * - `earnOnGift`: Pro from a gift that ends. A week each, and the referrer's
 *   goes on the end of the gift they hold (gift ends stack on the server).
 * - `give`: Pro that nothing of ours ends — a store subscription or a
 *   lifetime. The hero offers the friend's week and promises the referrer
 *   nothing: a lifetime has no end to add to, and a promotional week cannot
 *   move a store's renewal, so it would only show if the subscription lapsed
 *   inside it. Nothing here sells Pro to somebody who has it.
 *
 * Pure so the choice is tested; `planChangeFor` is the paywall's own reading
 * of the same entitlement, so the two screens agree on who is "covered".
 */
export type InviteHero = 'guest' | 'earn' | 'earnOnGift' | 'give'

export function inviteHeroFor({
  giveAWeek,
  guest,
  held,
}: {
  giveAWeek: boolean
  guest: boolean
  held: HeldPlan | null | undefined
}): InviteHero | null {
  if (!giveAWeek) return null
  if (guest) return 'guest'
  if (!held) return 'earn'
  if (planChangeFor(held) === 'covered') return 'give'
  return effectivePlanTier(held.tier, held.expiresAt) === 'free' ? 'earn' : 'earnOnGift'
}
