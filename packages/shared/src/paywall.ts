/**
 * The numbers the paywall decides by that are not plan limits.
 *
 * Config rather than literals in the screen, for the reason every threshold in
 * this package is: a number that changes what somebody is shown should be
 * changed in one place and read in every other.
 */
export const PAYWALL_RULES = {
  /**
   * The fewest distinct people who viewed somebody's profile this week before
   * the paywall, opened from the viewer list, says how many there were.
   *
   * Below it the line is left out rather than shown small. A count next to a
   * price is social proof, and a small one reads as a quiet app to exactly the
   * person being asked to pay (_The analytics dashboard is private, and that
   * decides the tool_ in `docs/decisions.md`). The count is the person's own —
   * the same number the viewer list already shows them — never anybody's
   * identity and never a figure about other accounts.
   */
  viewerCountMin: 3,
} as const

/**
 * The paywall roads that start outside the app: a promotional nudge whose
 * sentence is about the plans, by mail and by push.
 *
 * Declared here rather than beside the app's own roads (`PAYWALL_SOURCES` in
 * the app's `analyticsEvents.ts`, which spreads this list) because the server
 * writes them into links and push payloads, and the app reads them back off
 * those. One list for both ends is what keeps a link the API builds from
 * naming a road the paywall does not know — which it would read as `gate`,
 * the one bucket these must never land in.
 *
 * One value per message, not per channel: the push and the mail of a nudge
 * are the same sentence on the same evening, and `notification_opened`
 * already tells a tapped push from a followed link.
 */
export const PROMOTION_PAYWALL_SOURCES = ['nudge_limits', 'nudge_win_back'] as const
export type PromotionPaywallSource = (typeof PROMOTION_PAYWALL_SOURCES)[number]

export function isPromotionPaywallSource(value: unknown): value is PromotionPaywallSource {
  return (PROMOTION_PAYWALL_SOURCES as readonly unknown[]).includes(value)
}

/**
 * The paywall's path, naming the road. The same path on the web build and in
 * the app — `app/(app)/paywall.tsx` answers `/paywall` on both, and the web
 * host's links open the app where it is installed.
 */
export function paywallPath(source: PromotionPaywallSource): string {
  return `/paywall?source=${source}`
}
