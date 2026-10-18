import type { PlanFeature } from '@langx/shared'
import { router } from 'expo-router'
import type { PaywallSource } from './analyticsEvents'

/**
 * What a gate knew that the feature name cannot say: which allowance ran out,
 * and when the server says the next one is free.
 *
 * A quota is not a `PlanFeature` — the new-chat allowance is a number Pro
 * removes, not a capability it unlocks — so until this existed the paywall
 * opened from a spent allowance looked exactly like the one opened from the
 * profile. `retryAt` is the API's own answer from the refusal, passed on
 * rather than recomputed: the screen says when the next chat opens, and the
 * server is the only side that knows.
 */
export interface PaywallContext {
  limit: 'initiations'
  /** ISO time from the refusal's `retryAt`. */
  retryAt?: string | undefined
}

/**
 * Opens the paywall, optionally saying which capability sent the user there.
 *
 * The plan's paywall rules ask for a *contextual* paywall — the server already
 * returns the feature name on `403 UPGRADE_REQUIRED` and `ApiRequestError`
 * already carries it — but every call site pushed the bare route, so a screen
 * that knew exactly what the user had just tried to do threw that away and
 * showed a generic pitch. Routing through one function is what stops the next
 * call site forgetting again.
 *
 * The feature travels as a route param rather than in a store because the
 * paywall is a route: it has to survive a deep link and a back-navigation,
 * and a store would not.
 */
export function openPaywall(
  feature?: PlanFeature,
  from?: string,
  /**
   * Which exposure this is, for `paywall_viewed`. `gate` is the default
   * because it is what almost every call site is — a quota or a locked
   * capability — so a new one that says nothing lands in the bucket it
   * belongs to rather than inventing a category. The two that are not a gate
   * say so.
   */
  source: PaywallSource = 'gate',
  context?: PaywallContext,
): void {
  const params = {
    ...(feature ? { feature } : {}),
    ...(from ? { from } : {}),
    source,
    ...(context ? { limit: context.limit } : {}),
    ...(context?.retryAt ? { retryAt: context.retryAt } : {}),
  }
  router.push({
    pathname: '/(app)/paywall',
    ...(Object.keys(params).length > 0 ? { params } : {}),
  })
}
