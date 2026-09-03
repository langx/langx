import type { BillingPeriod, PaidPlanTier, PlanFeature, PlanTier } from '@langx/shared'
import type { PurchaseOutcome } from './purchases'

/**
 * Every event the app sends, and the only shape `track()` accepts.
 *
 * A closed union rather than `capture(name, props)` at the call sites, for the
 * same reason `PLAN_LIMITS` is a table: an analytics event is a promise about
 * what leaves the device, and the store privacy forms are answered from this
 * file. A property added here is a property to declare; a string typed at a
 * call site is one nobody would know to.
 *
 * The events trace the one funnel `docs/decisions.md` chose the tool for —
 * install → onboarding → first conversation → paywall — and stop there.
 * Screens are captured separately (`$screen`, see `useScreenTracking`), so a
 * step being *seen* needs no event of its own; these are the steps being
 * *done*. Purchases themselves arrive from RevenueCat's server-side
 * integration, so `purchase_finished` is the client's view of the store sheet,
 * not the source of revenue truth.
 *
 * Property names are snake_case because that is what PostHog's own are, and a
 * dashboard reading `$screen_name` next to `learningLanguages` is a dashboard
 * with two conventions.
 */
export type AnalyticsEvent =
  | {
      name: 'onboarding_completed'
      properties: { referred: boolean; native_languages: number; learning_languages: number }
    }
  | {
      /** One message left the composer and the server acknowledged it. Never its body. */
      name: 'message_sent'
      properties: { kind: 'text' | 'correction' | 'image' | 'audio'; reply: boolean }
    }
  | {
      name: 'paywall_viewed'
      properties: { feature: PlanFeature | null; tier: PlanTier }
    }
  | {
      name: 'purchase_started'
      properties: { offer: string; tier: PaidPlanTier | null; period: BillingPeriod | null }
    }
  | {
      name: 'purchase_finished'
      properties: {
        offer: string
        tier: PaidPlanTier | null
        period: BillingPeriod | null
        outcome: PurchaseOutcome
      }
    }

export type AnalyticsEventName = AnalyticsEvent['name']

/** What an event property may hold. Objects and arrays are dropped, not serialised. */
export type AnalyticsPropertyValue = string | number | boolean | null

/**
 * Names a property must never have.
 *
 * The store declaration says message bodies and personal details never reach
 * analytics. This list is that sentence made checkable: the type below fails
 * the build if an event declares one of these, and `sanitizeEventProperties`
 * drops it at runtime in case a value arrives under one by way of a spread.
 * It is a guard against the obvious mistake, not a filter that makes any
 * property safe — a body under the key `note` still goes through, which is
 * why the union above is closed.
 */
export const FORBIDDEN_PROPERTY_KEYS = [
  'body',
  'text',
  'message',
  'content',
  'email',
  'password',
  'handle',
  'display_name',
  'displayName',
  'bio',
  'phone',
  'token',
  'cookie',
] as const

type ForbiddenKey = (typeof FORBIDDEN_PROPERTY_KEYS)[number]
// Distributes over the union, so a forbidden key in *any* event is caught —
// `keyof (A | B)` alone would only see the keys they share.
type ForbiddenKeysIn<E> = E extends { properties: infer P } ? Extract<keyof P, ForbiddenKey> : never
type AssertNone<T> = [T] extends [never] ? true : never
/** Exists to be typed: the build fails if an event above declares a forbidden key. */
export const EVENTS_CARRY_NO_FORBIDDEN_KEYS: AssertNone<ForbiddenKeysIn<AnalyticsEvent>> = true

/** Longer than any legitimate value here; a body arriving by mistake is cut, not carried. */
const MAX_STRING_LENGTH = 200

export function sanitizeEventProperties(
  properties: Record<string, unknown>,
): Record<string, AnalyticsPropertyValue> {
  const forbidden = new Set<string>(FORBIDDEN_PROPERTY_KEYS)
  const clean: Record<string, AnalyticsPropertyValue> = {}
  for (const [key, value] of Object.entries(properties)) {
    if (forbidden.has(key)) continue
    if (value === null) clean[key] = null
    else if (typeof value === 'boolean') clean[key] = value
    else if (typeof value === 'number' && Number.isFinite(value)) clean[key] = value
    else if (typeof value === 'string') clean[key] = value.slice(0, MAX_STRING_LENGTH)
    // undefined, objects, arrays, functions and NaN are dropped.
  }
  return clean
}
