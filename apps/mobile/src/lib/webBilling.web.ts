import { packageDefinition, type Locale } from '@langx/shared'
// `import type` is erased at compile time, so naming the module here costs
// nothing: the browser package is still only fetched by the dynamic import in
// `loadSdk()`. This file is the web build's, but the rule is the same one
// `purchases.ts` follows for the native SDK.
import type * as PurchasesSdk from '@revenuecat/purchases-js'
import { currentLocale } from '../i18n/runtime'
import { TERMS_URL } from './externalLinks'
import type { PurchaseOffer, PurchaseOutcome } from './purchases'
import type * as WebBillingContract from './webBilling'
import { trialDays } from './trialDays'

/**
 * Buying on the web, through RevenueCat Web Billing.
 *
 * This is the browser half of the module whose native half is `webBilling.ts`;
 * `purchases.ts` calls into whichever one Metro resolved and never learns
 * which. Everything here is therefore shaped by the same two rules that file
 * states, and one more that is only true on the web:
 *
 *  1. **Optional services degrade, they do not crash** (CLAUDE.md). No web key
 *     configured means every call answers "nothing available" and the paywall
 *     says so honestly.
 *  2. **The SDK is imported lazily.** `@revenuecat/purchases-js` carries a
 *     Stripe checkout with it, and a person who never opens the paywall should
 *     not download one.
 *  3. **A different store sells this.** Web Billing is its own RevenueCat app
 *     with its own products, its own offering and its own key — an `rcb_` one,
 *     never the `appl_`/`goog_` pair. What ties the three stores back together
 *     is the `app_user_id`, which is why `identifyForWebBilling` matters here
 *     for exactly the reason `identifyForPurchases` does on a phone: a purchase
 *     under the wrong id is real in Stripe, real in RevenueCat and invisible to
 *     this app forever.
 *
 * The SDK's types do not escape this file. Screens get the same plain
 * `PurchaseOffer` shape the native path produces, and the `Package` objects
 * stay in `packagesById`.
 */

/**
 * The Web Billing SDK key, or `null` when there is none.
 *
 * The Test Store fallback is worth having here in a way it is not on native:
 * `@revenuecat/purchases-js` accepts a `test_` key (it validates `rcb_`,
 * `test_`, `strp_` and `pdl_` prefixes alike), so the whole web paywall —
 * offering, checkout, entitlement, webhook — can be exercised from a laptop
 * before Stripe is connected on RevenueCat's side.
 *
 * `__DEV__` gates it for the reason `fakePurchases.ts` gives: Expo inlines
 * `EXPO_PUBLIC_*` at build time, so a key left set in a shell would otherwise
 * ride a `pnpm build:web` into the published bundle and sell simulated
 * subscriptions to real people.
 */
function apiKey(): string | null {
  const webKey = process.env.EXPO_PUBLIC_REVENUECAT_WEB_KEY
  if (webKey) return webKey
  return __DEV__ ? process.env.EXPO_PUBLIC_REVENUECAT_TEST_STORE_KEY || null : null
}

export function isWebBillingAvailable(): boolean {
  return apiKey() !== null
}

/**
 * The locale to draw RevenueCat's checkout in.
 *
 * `Record<Locale, string>` is the enforcement: a ninth app language stops this
 * file compiling rather than quietly checking out in English. The values are
 * the SDK's own locale keys, which are not always ours — it ships one
 * Portuguese rather than a Brazilian and a European one.
 */
const CHECKOUT_LOCALES: Record<Locale, string> = {
  en: 'en',
  tr: 'tr',
  es: 'es',
  ru: 'ru',
  ar: 'ar',
  fr: 'fr',
  de: 'de',
  'pt-BR': 'pt',
}

type PurchasesModule = typeof PurchasesSdk

let sdk: PurchasesModule | null = null

async function loadSdk(): Promise<PurchasesModule | null> {
  if (!isWebBillingAvailable()) return null
  if (sdk) return sdk
  try {
    sdk = await import('@revenuecat/purchases-js')
    return sdk
  } catch {
    // A chunk that fails to load — a reload while offline, a deploy that moved
    // it mid-session — is billing being unavailable, not an error to throw at
    // whichever screen asked first. `sdk` stays null, so the next call retries.
    return null
  }
}

/**
 * The in-flight or finished `identifyForWebBilling`, so that everything else
 * can wait for it.
 *
 * The identity is bound in the root layout's effect and the paywall asks for
 * offerings from its own, which is a race the native path gets away with
 * because a `getOfferings()` before `configure()` merely returns nothing and
 * the screen is re-rendered soon after. Here it would be a paywall that says
 * "no plans" on the first open and lists them on the second — so the two are
 * ordered rather than left to chance.
 */
let binding: Promise<void> | null = null
let configuredFor: string | null = null

/** The email to prefill at checkout, so the buyer types one less thing. */
let customerEmail: string | null = null

const packagesById = new Map<string, PurchasesSdk.Package>()

/**
 * Binds the SDK to the signed-in user, and to nobody else.
 *
 * **The RevenueCat app user id must equal the Better Auth user id**, for the
 * reason spelled out on the native `identifyForPurchases`: the webhook writes
 * `profiles.entitlement` by `app_user_id` and `/billing/refresh` looks the
 * subscriber up by it. A web checkout completed under an anonymous id is money
 * taken for an entitlement this app can never see.
 *
 * Safe to call repeatedly; it no-ops once the current user is already bound.
 */
export function identifyForWebBilling(userId: string, email?: string): Promise<void> {
  if (email) customerEmail = email
  if (configuredFor === userId) return binding ?? Promise.resolve()
  binding = bind(userId)
  return binding
}

async function bind(userId: string): Promise<void> {
  const module = await loadSdk()
  const key = apiKey()
  if (!module || !key) return

  try {
    const { Purchases } = module
    // `configure` warns and replaces the instance when called twice, so the
    // already-configured case goes through `changeUser` instead — the one that
    // exists for a browser two people sign into in turn.
    if (Purchases.isConfigured()) await Purchases.getSharedInstance().changeUser(userId)
    else Purchases.configure({ apiKey: key, appUserId: userId })
    configuredFor = userId
  } catch {
    // Billing that cannot start is billing that is unavailable, not a crash.
    configuredFor = null
  }
}

/**
 * Clears the binding on sign-out so the next account does not inherit it.
 *
 * Deliberately synchronous inside, on the already-loaded module rather than on
 * `loadSdk()`: an SDK that was never loaded has nothing configured to close,
 * and awaiting one here would open a window in which a sign-in that follows
 * quickly configures the SDK and *then* has this close it out from under it.
 */
export function forgetWebBillingIdentity(): Promise<void> {
  if (configuredFor === null) return Promise.resolve()
  configuredFor = null
  customerEmail = null
  binding = null
  packagesById.clear()
  try {
    if (sdk?.Purchases.isConfigured()) sdk.Purchases.getSharedInstance().close()
  } catch {
    // Nothing useful to do: the local binding is already cleared above.
  }
  return Promise.resolve()
}

/** The configured instance, or `null` for every "cannot sell right now" case. */
async function instance(): Promise<PurchasesSdk.Purchases | null> {
  const module = await loadSdk()
  if (!module) return null
  // Ordered against the root layout's binding rather than racing it — see
  // `binding` above.
  if (binding) await binding
  if (!module.Purchases.isConfigured()) return null
  return module.Purchases.getSharedInstance()
}

/**
 * The current offering's packages, filtered to the ones this app knows how to
 * sell. `[]` for every failure, because the paywall renders the same honest
 * empty state for all of them.
 *
 * The identifiers come from the *web* offering in the RevenueCat dashboard and
 * have to match `PACKAGES` — the same table the two native stores are matched
 * against. A package the dashboard offers and `PACKAGES` does not know is
 * skipped rather than guessed at: showing it under the wrong tier would sell
 * the wrong thing.
 */
export async function getWebBillingOffers(): Promise<PurchaseOffer[]> {
  const purchases = await instance()
  if (!purchases) return []

  try {
    const offerings = await purchases.getOfferings()
    const available = offerings.current?.availablePackages ?? []
    packagesById.clear()

    const offers: PurchaseOffer[] = []
    for (const pkg of available) {
      const definition = packageDefinition(pkg.identifier)
      if (definition === null || definition.tier === 'free') continue
      packagesById.set(pkg.identifier, pkg)
      const product = pkg.webBillingProduct
      offers.push({
        id: pkg.identifier,
        tier: definition.tier,
        // The store's own text, in the buyer's currency. Never formatted here:
        // the price a person reads has to be the one the checkout charges.
        priceString: product.price.formattedPrice,
        period: definition.period,
        price: product.price.amountMicros / MICROS_PER_UNIT,
        freeTrialDays: freeTrialDays(product.freeTrialPhase),
      })
    }
    return offers
  } catch {
    return []
  }
}

/** RevenueCat reports web prices in millionths, so $9.99 arrives as 9990000. */
const MICROS_PER_UNIT = 1_000_000

/**
 * The free-trial length of a subscription's trial phase, or `null` when it has
 * none.
 *
 * A phase with no period is not a trial anyone can be told about, and a claim
 * the paywall cannot state precisely is one it must not make at all — the same
 * judgement the native path applies to a discounted first period.
 */
function freeTrialDays(phase: PurchasesSdk.PricingPhase | null): number | null {
  if (!phase?.period) return null
  return trialDays(phase.period.unit, phase.period.number)
}

/**
 * Buys one package, through RevenueCat's own checkout.
 *
 * The SDK renders it over the page and takes the card itself, so no card
 * detail ever reaches this app — which is what `docs/store/privacy-data-safety.md`
 * already claims of the two native stores and now has to stay true of the
 * third.
 *
 * Closing that checkout is a deliberate choice and arrives here as a
 * `UserCancelledError`. It is not a failure and must not be reported as one:
 * showing an error for someone's own decision is how a paywall teaches people
 * it is broken.
 */
export async function purchaseWebBillingOffer(offerId: string): Promise<PurchaseOutcome> {
  const module = await loadSdk()
  const purchases = await instance()
  const rcPackage = packagesById.get(offerId)
  if (!module || !purchases || !rcPackage) return 'unavailable'

  try {
    await purchases.purchase({
      rcPackage,
      // Prefilled from the account rather than asked for again. The checkout
      // collects an email either way — it is how the receipt and the
      // management link are sent — so this saves a field, it does not hand
      // over anything the purchase would not have carried.
      ...(customerEmail ? { customerEmail } : {}),
      selectedLocale: CHECKOUT_LOCALES[currentLocale()],
      defaultLocale: CHECKOUT_LOCALES.en,
      // Required on a screen that sells a subscription, and the checkout is
      // the last screen before the charge — the paywall's own links are behind
      // it at that point.
      termsAndConditionsUrl: TERMS_URL,
    })
    return 'purchased'
  } catch (error) {
    if (error instanceof module.PurchasesError) {
      return error.errorCode === module.ErrorCode.UserCancelledError ? 'cancelled' : 'failed'
    }
    return 'failed'
  }
}

/**
 * There is no device receipt to restore from in a browser: what the button
 * means here is "look again", and the looking is done by RevenueCat's own
 * customer record and then by the server's `/billing/refresh`, which the
 * paywall runs straight afterwards either way.
 *
 * So the honest answer is whether that lookup worked, not whether it found
 * something — `false` is what makes the screen say there was nothing to
 * restore, and a subscription the server is about to report is not nothing.
 */
export async function restoreWebBillingPurchases(): Promise<boolean> {
  const purchases = await instance()
  if (!purchases) return false
  try {
    await purchases.getCustomerInfo()
    return true
  } catch {
    return false
  }
}

/**
 * Where a web subscriber cancels or changes their plan.
 *
 * Neither store URL means anything here, and there is no cancel endpoint of
 * our own — RevenueCat hosts the portal that Stripe's subscription is managed
 * from, and this link is the only way to reach it. `null` when the customer
 * has no active web subscription, which Settings must render as *no row*.
 */
export async function webBillingManagementUrl(): Promise<string | null> {
  const purchases = await instance()
  if (!purchases) return null
  try {
    return (await purchases.getCustomerInfo()).managementURL
  } catch {
    return null
  }
}

/**
 * TypeScript checks every caller against the *native* file — Metro picks this
 * one, `tsc` never does — so nothing but this line makes the two agree. A
 * signature that drifts fails to compile here, rather than at runtime in
 * somebody's browser.
 */
const _sameShape = {
  isWebBillingAvailable,
  identifyForWebBilling,
  forgetWebBillingIdentity,
  getWebBillingOffers,
  purchaseWebBillingOffer,
  restoreWebBillingPurchases,
  webBillingManagementUrl,
} satisfies typeof WebBillingContract
