/**
 * The three small decisions behind the paywall's analytics, kept pure so a test
 * can reach them — the screen that uses them cannot be loaded without
 * `react-native`.
 */

/**
 * How the paywall was left, as far as the navigation event can say.
 *
 * `close` is ours: the X, or "Continue free", which set a flag before they
 * navigate. The other three are read off the action the navigator was handed.
 * Android's back button and the system back gesture both arrive as `GO_BACK`;
 * the iOS swipe arrives as a `POP` that names this very route as its source,
 * because the native stack dispatches it for the screen the finger moved.
 * `other` is everything else that can take a screen off the stack — a
 * `replace`, a reset, a deep link — and is kept apart rather than folded into
 * one of the others, because a number that quietly includes them would be a
 * back-button count that is not one.
 */
export type PaywallExit = 'close' | 'back' | 'gesture' | 'other'

export function paywallExitKind(input: {
  /** The X or "Continue free" ran just before this navigation. */
  closed: boolean
  /** The action the navigator is acting on: `event.data.action`. */
  action: { type: string; source?: string | undefined }
  /** The route being removed: `event.target`. */
  routeKey: string | undefined
}): PaywallExit {
  if (input.closed) return 'close'
  if (input.action.type === 'GO_BACK') return 'back'
  if (
    input.action.type === 'POP' &&
    input.action.source !== undefined &&
    input.action.source === input.routeKey
  ) {
    return 'gesture'
  }
  return 'other'
}

/**
 * What the paywall had to sell when it was counted as seen.
 *
 * `pending` is the store not having answered yet; the screen waits a second
 * for it and then shows anyway, so it is a real state and not a gap in the
 * data. `plain` is offers with no free week on any of them, which cannot say
 * whether the product has no trial or this account has already had it — the
 * store only tells the app on iOS, and `getOffers` folds both into "no trial".
 */
export type PaywallOffersState = 'pending' | 'none' | 'plain' | 'trial' | 'owned'

export function paywallOffersState(input: {
  /** The plan held already covers Pro, so the page does not depend on the store. */
  owned: boolean
  /** `null` while the store is still being asked. */
  offers: readonly { tier: string; freeTrialDays: number | null }[] | null
}): PaywallOffersState {
  if (input.owned) return 'owned'
  if (input.offers === null) return 'pending'
  // Pro's offers only, like the page: another tier's package is not on it.
  const sold = input.offers.filter((offer) => offer.tier === 'pro')
  if (sold.length === 0) return 'none'
  return sold.some((offer) => offer.freeTrialDays !== null) ? 'trial' : 'plain'
}

/**
 * What "Restore purchases" can honestly be said to have done today.
 *
 * `restorePurchases()` answers one boolean: whether the store call went
 * through. It does not say whether anything was found — the server decides
 * that afterwards, and nobody waits for it. So `completed` is not "restored"
 * and `failed` is not "nothing to restore": the first is a call that returned,
 * the second a call that threw or had no store behind it. A later change to
 * `restorePurchases()` is expected to split `completed` into what it found.
 */
export type RestoreResult = 'completed' | 'failed'

export function restoreResult(ok: boolean): RestoreResult {
  return ok ? 'completed' : 'failed'
}
