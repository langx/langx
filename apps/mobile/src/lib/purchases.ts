import { packageDefinition, type BillingPeriod, type PaidPlanTier } from '@langx/shared'
import { Platform } from 'react-native'
// `import type` is erased at compile time, so naming the module here costs
// nothing at runtime — the actual native module is still only pulled in by the
// dynamic import in `loadSdk()`, on the platforms that have it.
import type * as PurchasesSdk from 'react-native-purchases'

/**
 * The app's whole surface onto RevenueCat.
 *
 * Two rules shape everything here, both inherited from conventions this repo
 * already holds:
 *
 *  1. **Optional services degrade, they do not crash** (CLAUDE.md). No key
 *     configured means every call below returns "nothing available" and the
 *     paywall says so honestly. It must never be able to stop a screen from
 *     rendering — a user who cannot buy still has an app to use.
 *  2. **The native module is imported lazily**, for the same reason
 *     `expo-secure-store` is in `localFlags.ts` and `expo-notifications` is in
 *     the push code: a native module resolved at module scope is evaluated on
 *     web too, where it has nothing to bind to.
 *
 * The SDK types deliberately do not escape this file. Screens get the plain
 * shapes below, and the RevenueCat `PurchasesPackage` objects stay in
 * `packagesById` — passing an opaque SDK object through React props is how a
 * UI ends up unable to be tested without the native module present.
 */

/** `react-native-purchases` is native-only; the browser build needs RevenueCat's separate JS SDK, which this app does not ship. */
const isSupportedPlatform = Platform.OS === 'ios' || Platform.OS === 'android'

/**
 * A released build uses the per-platform key for its real store app. Until
 * those exist, the Test Store key is the only one this project has, and it
 * covers both platforms — hence the fallback rather than a second branch.
 */
function apiKey(): string | null {
  if (!isSupportedPlatform) return null
  const platformKey =
    Platform.OS === 'ios'
      ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY
      : process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY
  return platformKey || process.env.EXPO_PUBLIC_REVENUECAT_TEST_STORE_KEY || null
}

export function isPurchasesAvailable(): boolean {
  return apiKey() !== null
}

/** One buyable package, already resolved to the tier it sells. */
export interface PurchaseOffer {
  /** RevenueCat package identifier — also the key into `packagesById`. */
  id: string
  tier: PaidPlanTier
  /** Localised and currency-correct, straight from the store. Never formatted here: store compliance requires the real price, not one we compute. */
  priceString: string
  period: BillingPeriod
}

export type PurchaseOutcome = 'purchased' | 'cancelled' | 'unavailable' | 'failed'

let configuredFor: string | null = null
const packagesById = new Map<string, unknown>()

type PurchasesModule = typeof PurchasesSdk

async function loadSdk(): Promise<PurchasesModule | null> {
  if (!isPurchasesAvailable()) return null
  try {
    return await import('react-native-purchases')
  } catch {
    // A build without the native module linked (Expo Go, an old dev client)
    // should behave exactly like a build with no key — not throw at the first
    // screen that happens to ask about billing.
    return null
  }
}

/**
 * Binds RevenueCat to the signed-in user.
 *
 * **The RevenueCat app user id must equal the Better Auth user id.** The whole
 * server side keys off `app_user_id` — the webhook writes
 * `profiles.entitlement` by it and `/billing/refresh` looks the subscriber up
 * by it — so an anonymous RevenueCat id here means a purchase that is real on
 * the store, real in RevenueCat, and invisible to this app forever.
 *
 * Safe to call repeatedly; it no-ops once the current user is already bound.
 */
export async function identifyForPurchases(userId: string): Promise<void> {
  if (configuredFor === userId) return
  const sdk = await loadSdk()
  if (!sdk) return
  const key = apiKey()
  if (!key) return

  try {
    const Purchases = sdk.default
    // configure() is idempotent per process but logIn() is what re-points an
    // already-configured SDK at a different account — the case that matters
    // when one device is used by two people in turn.
    if (configuredFor === null) Purchases.configure({ apiKey: key, appUserID: userId })
    else await Purchases.logIn(userId)
    configuredFor = userId
  } catch {
    // Billing that cannot start is billing that is unavailable, not a crash.
    configuredFor = null
  }
}

/** Clears the binding on sign-out so the next account does not inherit it. */
export async function forgetPurchasesIdentity(): Promise<void> {
  if (configuredFor === null) return
  const sdk = await loadSdk()
  configuredFor = null
  packagesById.clear()
  try {
    await sdk?.default.logOut()
  } catch {
    // Nothing useful to do: the local binding is already cleared above.
  }
}

/**
 * The current offering's packages, newest-tier-first ordering left to the
 * caller. Returns `[]` for every "cannot sell right now" case — no key, no
 * native module, no offering configured, or the network being down — because
 * the paywall renders the same honest empty state for all of them.
 */
export async function getOffers(): Promise<PurchaseOffer[]> {
  const sdk = await loadSdk()
  if (!sdk) return []

  try {
    const offerings = await sdk.default.getOfferings()
    const available = offerings.current?.availablePackages ?? []
    packagesById.clear()

    const offers: PurchaseOffer[] = []
    for (const pkg of available) {
      // A package the dashboard offers but `PACKAGES` does not know is skipped
      // rather than guessed at: showing it under the wrong tier would sell the
      // wrong thing, and that is worse than not showing it.
      const definition = packageDefinition(pkg.identifier)
      if (definition === null || definition.tier === 'free') continue
      packagesById.set(pkg.identifier, pkg)
      offers.push({
        id: pkg.identifier,
        tier: definition.tier,
        priceString: pkg.product.priceString,
        period: definition.period,
      })
    }
    return offers
  } catch {
    return []
  }
}

/**
 * Buys one package.
 *
 * A user tapping "cancel" in the store sheet arrives here as a thrown error
 * with `userCancelled` set, which is not a failure and must not be reported as
 * one — showing an error toast for a deliberate cancellation is how a paywall
 * teaches people it is broken.
 */
export async function purchaseOffer(offerId: string): Promise<PurchaseOutcome> {
  const sdk = await loadSdk()
  const pkg = packagesById.get(offerId)
  if (!sdk || !pkg) return 'unavailable'

  try {
    await sdk.default.purchasePackage(pkg as Parameters<typeof sdk.default.purchasePackage>[0])
    return 'purchased'
  } catch (error) {
    if (isUserCancelled(error)) return 'cancelled'
    return 'failed'
  }
}

/**
 * Apple requires a restore control on any screen that sells a subscription,
 * and it has to work for someone reinstalling on a new device — hence a real
 * SDK call here, not just the server-side `/billing/refresh` the screen also
 * runs afterwards.
 */
export async function restorePurchases(): Promise<boolean> {
  const sdk = await loadSdk()
  if (!sdk) return false
  try {
    await sdk.default.restorePurchases()
    return true
  } catch {
    return false
  }
}

function isUserCancelled(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'userCancelled' in error &&
    error.userCancelled === true
  )
}
