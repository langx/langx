import { packageDefinition, type BillingPeriod, type PaidPlanTier } from '@langx/shared'
import { Platform } from 'react-native'
import { fakeOffers, fakePurchase, isFakePurchasesEnabled } from './fakePurchases'
import { trialDays } from './trialDays'
/*
 * The web store, behind a two-file module Metro resolves per platform: this
 * import is the real RevenueCat Web Billing SDK in a browser build and an
 * empty set of "no" answers in the native ones. See `webBilling.ts` for why it
 * cannot be a `Platform.OS` branch in this file.
 */
import {
  forgetWebBillingIdentity,
  getWebBillingOffers,
  identifyForWebBilling,
  isWebBillingAvailable,
  purchaseWebBillingOffer,
  restoreWebBillingPurchases,
  webBillingManagementUrl,
} from './webBilling'
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
 *
 * Each function below opens with the same two checks, in the same order: the
 * local development harness (`./fakePurchases`), then the web store
 * (`./webBilling`), then the native SDK this file wraps directly. Branching
 * here rather than at the call sites is what keeps the promise the paragraph
 * above makes: the paywall still has exactly one surface onto billing and
 * cannot tell which of the three it is talking to, so what the harness
 * exercises is the screen that ships, and the screen that ships is the same one
 * in a browser.
 */

/**
 * `react-native-purchases` is native-only; the browser sells through
 * RevenueCat Web Billing and its own SDK, which is what `./webBilling` wraps.
 * Everything below therefore has three answers, not two, and the fake store
 * still takes precedence over both real ones.
 */
const isNativePlatform = Platform.OS === 'ios' || Platform.OS === 'android'
const isWebPlatform = Platform.OS === 'web'

/**
 * A released build uses the per-platform key for its real store app. Until
 * those exist, the Test Store key is the only one this project has, and it
 * covers both platforms — hence the fallback rather than a second branch.
 *
 * The fallback is **development-only**. The RevenueCat SDK does not treat a
 * Test Store key in a release build as a misconfiguration to report: it calls
 * `fatalError` inside `configure()`, before the `try` around it can catch
 * anything, and the process dies on the first screen that identifies the
 * user. A Release build on a phone with the dev `.env` inlined went down that
 * way on the language screen after sign-in. Without the key the paywall says
 * purchasing is unavailable, which is the degradation rule 1 promises.
 */
function apiKey(): string | null {
  if (!isNativePlatform) return null
  const platformKey =
    Platform.OS === 'ios'
      ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY
      : process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY
  if (platformKey) return platformKey
  return __DEV__ ? process.env.EXPO_PUBLIC_REVENUECAT_TEST_STORE_KEY || null : null
}

export function isPurchasesAvailable(): boolean {
  if (isFakePurchasesEnabled()) return true
  if (isWebPlatform) return isWebBillingAvailable()
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
  /**
   * The same amount as a number, in the storefront's currency.
   *
   * Only ever compared against another offer from the same offering — which is
   * to say the same storefront and the same currency — and never rendered. A
   * price a person reads has to be `priceString`, the store's own text.
   */
  price: number
  /**
   * Days of free trial the store will grant on a first purchase, or `null` when
   * this package has no trial.
   */
  freeTrialDays: number | null
}

/**
 * The free-trial length of an introductory offer, or `null` when there is none.
 *
 * `introPrice` describes *any* introductory offer — pay-as-you-go and
 * pay-up-front discounts included — so the zero price is the whole test. A
 * discounted first period is a real thing the stores can sell and this app
 * currently does not, and calling one a free trial would be a false claim
 * rather than a missing feature.
 *
 * The unit-to-days conversion moved to `./trialDays` when the web store
 * arrived: the two SDKs do not spell `MONTH` the same way, and the paywall's
 * "30 days free" has to mean the same thing whichever one answered.
 */
function freeTrialDays(intro: PurchasesSdk.PurchasesIntroPrice | null): number | null {
  if (intro === null || intro.price !== 0) return null
  return trialDays(intro.periodUnit, intro.periodNumberOfUnits)
}

export type PurchaseOutcome = 'purchased' | 'cancelled' | 'unavailable' | 'failed'

let configuredFor: string | null = null
const packagesById = new Map<string, unknown>()

type PurchasesModule = typeof PurchasesSdk

async function loadSdk(): Promise<PurchasesModule | null> {
  // `apiKey()`, not `isPurchasesAvailable()`: the latter is now also true on
  // web, and this module is the native one. Every caller has already handled
  // the fake store and the web store before it gets here.
  if (apiKey() === null) return null
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
export async function identifyForPurchases(userId: string, email?: string): Promise<void> {
  // Nothing to bind under the harness: its purchases are made by an
  // authenticated API call, so the app user id *is* the session's user id and
  // cannot drift from it — which is the failure this function exists to
  // prevent, made structurally impossible rather than handled.
  if (isFakePurchasesEnabled()) return
  if (isWebPlatform) return identifyForWebBilling(userId, email)
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
  if (isFakePurchasesEnabled()) return
  if (isWebPlatform) return forgetWebBillingIdentity()
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
  if (isFakePurchasesEnabled()) return fakeOffers()
  if (isWebPlatform) return getWebBillingOffers()
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
        price: pkg.product.price,
        freeTrialDays: freeTrialDays(pkg.product.introPrice),
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
  if (isFakePurchasesEnabled()) return fakePurchase(offerId)
  if (isWebPlatform) return purchaseWebBillingOffer(offerId)
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
  // There is no device receipt to restore *from* here, and reporting failure
  // would be misleading: the caller reconciles with the server straight
  // afterwards, and under the harness the server is the only record there was.
  if (isFakePurchasesEnabled()) return true
  if (isWebPlatform) return restoreWebBillingPurchases()
  const sdk = await loadSdk()
  if (!sdk) return false
  try {
    await sdk.default.restorePurchases()
    return true
  } catch {
    return false
  }
}

/**
 * RevenueCat's own link for cancelling or changing a plan, or `null` when it
 * has none to give.
 *
 * Web only, deliberately. A subscription lives in the store that sold it and
 * both native stores publish one address for all of them, which is what
 * `manageSubscription.ts` already returns without asking anybody. Stripe has no
 * such address: the portal is per-customer and RevenueCat hosts it, so this is
 * the *only* way a web subscriber can cancel from inside the app — and a paid
 * plan with no way out is not something to ship.
 */
export async function storeManagementUrl(): Promise<string | null> {
  if (!isWebPlatform) return null
  return webBillingManagementUrl()
}

function isUserCancelled(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'userCancelled' in error &&
    error.userCancelled === true
  )
}
