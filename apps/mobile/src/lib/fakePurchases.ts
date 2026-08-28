import { PACKAGES } from '@langx/shared'
import type { PurchaseOffer, PurchaseOutcome } from './purchases'

/**
 * A store that is not a store, so the paywall can be bought from on a laptop.
 *
 * `react-native-purchases` is native-only and every real package needs an App
 * Store or Play product behind it, which together meant the purchase flow
 * could not be run at all outside a device build with store configuration —
 * see `docs/billing-testing.md`. With this on, the paywall lists real packages
 * at obviously fake prices and buying one calls the API's fake-store route,
 * which puts a RevenueCat-shaped event through the real webhook handler.
 *
 * **Off unless two independent things are true**: the explicit environment
 * flag, and `__DEV__`. The second is the one that matters — Expo inlines
 * `EXPO_PUBLIC_*` at build time, so a flag left set in a shell could otherwise
 * follow a `pnpm build:web` all the way into a published bundle, and this is
 * not a mistake that announces itself. Nothing here is reachable from a
 * production build regardless of how the environment is set.
 *
 * The server half is guarded separately and refuses to boot with the flag on
 * under `NODE_ENV=production`, so neither side can be talked into this alone.
 */
export function isFakePurchasesEnabled(): boolean {
  return __DEV__ && process.env.EXPO_PUBLIC_REVENUECAT_FAKE_STORE === '1'
}

/**
 * Prices for packages nobody is charged for.
 *
 * They read `TEST` first and are checked by nothing, because that is the whole
 * job: a paywall showing plausible prices in a state where no money moves is a
 * screenshot waiting to be mistaken for the real one. Real prices are never
 * built here — they come from the store, formatted and in the user's currency,
 * which is a store-compliance requirement and not a preference.
 *
 * `Record<keyof typeof PACKAGES, string>` means a package added to the shared
 * table without a price here stops this file compiling, matching how the
 * paywall's own copy tables are enforced.
 */
const TEST_PRICES: Record<keyof typeof PACKAGES, string> = {
  $rc_monthly: 'TEST $4.99',
  $rc_annual: 'TEST $39.99',
  $rc_lifetime: 'TEST $99.99',
  pro_plus_monthly: 'TEST $9.99',
  pro_plus_yearly: 'TEST $79.99',
}

/**
 * Every package the app sells, in `PACKAGES` order.
 *
 * Read off the shared table rather than a list of its own, so the harness
 * offers exactly what a correctly configured RevenueCat offering would — a
 * package missing from `PACKAGES` is missing here too, which is the failure
 * `getOffers` is written to make visible.
 */
export function fakeOffers(): PurchaseOffer[] {
  // `Object.keys` is typed `string[]` however narrow the object is, and this
  // one is a const table whose keys are exactly `PACKAGES`'s — the assertion
  // recovers what the compiler already knows, and `TEST_PRICES` above is what
  // keeps the two key sets from drifting apart.
  const ids = Object.keys(PACKAGES) as (keyof typeof PACKAGES)[]
  return ids.map((id) => ({
    id,
    tier: PACKAGES[id].tier,
    priceString: TEST_PRICES[id],
    period: PACKAGES[id].period,
  }))
}

/**
 * "Buys" a package by asking the API to run one through its fake store.
 *
 * There is no local success to report: entitlement lives on the server, and a
 * client that said `purchased` off its own bat would be testing nothing. The
 * paywall's existing `POST /billing/refresh` afterwards is what makes the new
 * tier appear, exactly as it does after a real purchase.
 *
 * `unavailable` rather than `failed` when the route is not there, because that
 * is what it means: the API is running without `REVENUECAT_FAKE_STORE`, so
 * this device cannot buy — the same state the paywall already has copy for.
 */
export async function fakePurchase(offerId: string): Promise<PurchaseOutcome> {
  // Imported here rather than at module scope, for the same shape of reason
  // `purchases.ts` loads the RevenueCat SDK lazily: `../api/client` reaches
  // `react-native` through `apiFetch`, and vitest runs in Node, where that
  // module cannot be parsed. At module scope it would take the offer table
  // below down with it and leave the harness itself untestable.
  const { api } = await import('../api/client')
  try {
    await api.post('/billing/test-event', { action: 'purchase', packageId: offerId })
    return 'purchased'
  } catch (error) {
    return isNotFound(error) ? 'unavailable' : 'failed'
  }
}

function isNotFound(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'status' in error && error.status === 404
}
