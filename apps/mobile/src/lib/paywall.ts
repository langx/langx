import type { PlanFeature } from '@langx/shared'
import { router } from 'expo-router'

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
export function openPaywall(feature?: PlanFeature, from?: string): void {
  const params = { ...(feature ? { feature } : {}), ...(from ? { from } : {}) }
  router.push({
    pathname: '/(app)/paywall',
    ...(Object.keys(params).length > 0 ? { params } : {}),
  })
}
