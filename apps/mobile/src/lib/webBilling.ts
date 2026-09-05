import type { PurchaseOffer, PurchaseOutcome } from './purchases'

/**
 * The native side of a two-file module. Metro picks `webBilling.web.ts` for
 * the browser build and this one for iOS and Android, exactly as it does for
 * `BirthDateField`.
 *
 * The split is not cosmetic. RevenueCat sells the web through a **separate
 * SDK** — `@revenuecat/purchases-js`, a browser package that reaches for
 * `document` and bundles a Stripe checkout — and a single file branching on
 * `Platform.OS` would still hand that package to Metro for the native bundles,
 * where it can neither run nor be tree-shaken away by a `Platform.OS === 'web'`
 * that is only knowable at runtime. Here there is no import to shake: the
 * native bundle contains this file, and this file contains nothing.
 *
 * Every function answers the way `purchases.ts` already answers when billing
 * is not configured, so a caller that reaches one of these on a phone is not a
 * bug to handle — it is the degradation rule in CLAUDE.md, unchanged.
 *
 * **`react-native-purchases` looks like it makes all of this unnecessary, and
 * it does not.** Since v10 it ships a browser mode that bridges to the same
 * `@revenuecat/purchases-js` through `purchases-js-hybrid-mappings`, so one
 * file branching on `Platform.OS` compiles and very nearly works. What it gets
 * wrong is the case that matters most: the bridge reports a cancelled checkout
 * as the numeric `1` and the wrapper compares it against the string `"1"`
 * (`PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR`), so `userCancelled` comes
 * back `false` and someone who simply closed the payment sheet is told their
 * purchase failed — the exact thing `purchaseOffer`'s doc comment says a
 * paywall must never do. The bridge also drops `customerEmail`,
 * `selectedLocale` and `termsAndConditionsUrl` on the floor. Verified against
 * 10.8.1 / 1.58.0 on 5 September 2026; check both again before collapsing
 * these two files into one.
 */

export function isWebBillingAvailable(): boolean {
  return false
}

export function identifyForWebBilling(_userId: string, _email?: string): Promise<void> {
  return Promise.resolve()
}

export function forgetWebBillingIdentity(): Promise<void> {
  return Promise.resolve()
}

export function getWebBillingOffers(): Promise<PurchaseOffer[]> {
  return Promise.resolve([])
}

export function purchaseWebBillingOffer(_offerId: string): Promise<PurchaseOutcome> {
  return Promise.resolve('unavailable')
}

export function restoreWebBillingPurchases(): Promise<boolean> {
  return Promise.resolve(false)
}

export function webBillingManagementUrl(): Promise<string | null> {
  return Promise.resolve(null)
}
