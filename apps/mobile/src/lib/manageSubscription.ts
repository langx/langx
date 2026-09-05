/**
 * Where to send someone who wants to cancel or change their plan.
 *
 * There is no cancel endpoint and there should not be one: a subscription lives
 * in the store that sold it, and both stores require the cancel path to be
 * theirs. So the honest affordance is a deep link, and the honest answer where
 * there is no such link is nothing at all.
 *
 * Pure, so `vitest.config.ts` reaches it — the platform branching is the part
 * worth testing, and it would be untestable inside the screen.
 */

/** RevenueCat fills this in for every store it knows, including web checkouts. */
export interface ManageSource {
  managementURL?: string | null
  /** `profiles.entitlement.store` — `promotional` for the v1 loyalty gift. */
  store?: string | null
}

const APP_STORE = 'https://apps.apple.com/account/subscriptions'
const PLAY_STORE = 'https://play.google.com/store/account/subscriptions'

/**
 * `null` when there is nowhere to send them, which the caller must render as
 * *no row* rather than a disabled one — Settings already states that rule for
 * the app-icon section: a row that cannot work is worse than one that is not
 * there.
 *
 * RevenueCat's own `managementURL` wins when present. It is the only one that
 * is right for a web checkout, where neither store URL means anything, and it
 * is already correct for the two native stores.
 */
export function manageSubscriptionUrl(
  source: ManageSource | null | undefined,
  platform: string,
): string | null {
  if (source?.managementURL) return source.managementURL
  // A lifetime grant was never sold by a store, so the store's subscriptions
  // page has nothing on it to manage — and a row that leads to an empty list
  // reads as "your plan is missing".
  if (source?.store === 'promotional') return null
  if (platform === 'ios') return APP_STORE
  if (platform === 'android') return PLAY_STORE
  return null
}
