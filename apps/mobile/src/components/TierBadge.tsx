import type { PlanTier } from '@langx/shared'
import { Chip } from './ui/Chip'

/**
 * The PRO / PRO+ badge, in one place.
 *
 * Two screens rendered this inline and disagreed about how to decide it — the
 * profile screen compared `tier === 'pro'` while `me` used `useIsPro()` — so
 * adding a third tier would have made one of them silently drop the badge for
 * Pro+ subscribers while the other kept it. Which label and which colour a
 * tier gets is one decision, so it is made once.
 *
 * Unselected on purpose: v3 draws tags as quiet outlines on the shared chip
 * geometry, and the brand colour survives in the label — a filled purple pill
 * next to a row of outlined chips read as a button, not a status.
 *
 * Renders nothing on `free`: an absent badge is the free state, and a chip
 * reading "FREE" is an insult, not information.
 */
export function TierBadge({ tier }: { tier: PlanTier }) {
  if (tier === 'free') return null
  const isPlus = tier === 'pro_plus'
  return <Chip label={isPlus ? 'PRO+' : 'PRO'} tone={isPlus ? 'proPlus' : 'pro'} />
}
