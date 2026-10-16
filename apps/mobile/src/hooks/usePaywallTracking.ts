import type { PlanFeature, PlanTier } from '@langx/shared'
import { useNavigation } from 'expo-router'
import { useEffect, useRef } from 'react'
import { track } from '../lib/analytics'
import type { PaywallSource } from '../lib/analyticsEvents'
import { paywallExitKind, type PaywallOffersState } from '../lib/paywallAnalytics'

interface PaywallTrackingInput {
  feature: PlanFeature | null
  tier: PlanTier
  source: PaywallSource
  gift: boolean
  /** The page has been drawn: the store answered, or the wait for it is over. */
  ready: boolean
  offers: PaywallOffersState
}

/**
 * The paywall's open and close, as two events that cannot disagree.
 *
 * `paywall_viewed` is sent once the page is shown, so it can say what the
 * store had to sell. `paywall_dismissed` is sent once, from the navigator's
 * `beforeRemove`, and that is the whole reason this is a hook: the X, "Continue
 * free", Android's back button and the iOS swipe all remove the screen, and
 * only the navigator sees every one of them. The X has no way to be told apart
 * from the back button by the action alone — both are `GO_BACK` — so it says so
 * with `markClosed()` before it navigates.
 *
 * **The listener never calls `preventDefault`.** Nothing here may delay or
 * intercept leaving: the X, back and the swipe each close the paywall in one
 * gesture, always. It reads the event and returns.
 */
export function usePaywallTracking(input: PaywallTrackingInput): {
  /** The X or "Continue free" is about to navigate away. Call it just before. */
  markClosed: () => void
  /** A purchase went through; the screen is not being dismissed afterwards. */
  markPurchased: () => void
} {
  const navigation = useNavigation()
  const openedAt = useRef(Date.now())
  const viewedSent = useRef(false)
  const dismissedSent = useRef(false)
  const closed = useRef(false)
  const purchased = useRef(false)
  const arrivedOn = useRef(input.tier)
  // The latest of everything the callbacks below read, without making the
  // listener resubscribe — a `beforeRemove` handler swapped mid-navigation is
  // a handler that may miss the event.
  const latest = useRef(input)
  latest.current = input

  function sendViewed(): void {
    if (viewedSent.current) return
    viewedSent.current = true
    const { feature, tier, source, gift, offers } = latest.current
    track({ name: 'paywall_viewed', properties: { feature, tier, source, gift, offers } })
  }

  useEffect(() => {
    if (input.ready) sendViewed()
  }, [input.ready])

  // Leaving with a plan they did not arrive with — bought, restored, a gift
  // code — is a conversion, not a dismissal. The explicit mark covers the
  // seconds before the server has confirmed the purchase.
  useEffect(() => {
    if (arrivedOn.current === 'free' && input.tier !== 'free') purchased.current = true
  }, [input.tier])

  useEffect(() => {
    return navigation.addListener('beforeRemove', (event) => {
      if (dismissedSent.current) return
      dismissedSent.current = true
      // A view the store made wait is still a view: counted now, as `pending`.
      sendViewed()
      if (purchased.current) return
      const { source } = latest.current
      track({
        name: 'paywall_dismissed',
        properties: {
          source,
          seconds_open: Math.round((Date.now() - openedAt.current) / 1000),
          exit: paywallExitKind({
            closed: closed.current,
            action: event.data.action,
            routeKey: event.target,
          }),
        },
      })
    })
  }, [navigation])

  return {
    markClosed: () => {
      closed.current = true
    },
    markPurchased: () => {
      purchased.current = true
    },
  }
}
