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

import { platformOfStore } from '@langx/shared'

/** RevenueCat fills this in for every store it knows, including web checkouts. */
export interface ManageSource {
  managementURL?: string | null
  /**
   * `profiles.entitlement.store` — `promotional` for the v1 loyalty gift,
   * `manual` for one granted straight into the database.
   */
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
  /*
   * A plan no store sold has nothing on the store's subscriptions page to
   * manage, and a row that leads to an empty list reads as "your plan is
   * missing". That was written for the v1 lifetime gift (`promotional`) and
   * is just as true of one granted by hand (`manual`) — so the test is
   * whether a store we sell through is named, not whether it is the one grant
   * we happened to think of.
   *
   * A *missing* store still falls through to the platform page: absent means
   * "not recorded", which is the older rows, not "nobody sold it".
   */
  if (source?.store && platformOfStore(source.store) === null) return null
  if (platform === 'ios') return APP_STORE
  if (platform === 'android') return PLAY_STORE
  return null
}
