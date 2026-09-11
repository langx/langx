import type {
  BillingPeriod,
  CosmeticKind,
  MessageType,
  PaidPlanTier,
  PlanChange,
  PlanFeature,
  PlanTier,
  PushKind,
} from '@langx/shared'
import type { OnboardingStep } from './onboardingStep'
import type { TourTargetId } from './tour'
import type { PurchaseOutcome } from './purchases'

/** How an account was created. The mailed link is what makes `email` two steps. */
export type SignUpMethod = 'email' | 'google' | 'apple'

/** What a guest was trying to do when the account gate stopped them. */
export type GuestGateAction = 'message' | 'like' | 'follow' | 'post' | 'other'

/**
 * Which exposure a paywall view is.
 *
 * `onboarding` is the one shown once at the end of the wizard; `gate` is a
 * quota or a locked feature, the only moment the pitch answers a question the
 * person just asked. Keeping them apart is the whole point — mixed together,
 * a conversion rate says nothing about either.
 */
export const PAYWALL_SOURCES = ['onboarding', 'gate', 'me', 'deeplink', 'first_reply'] as const
export type PaywallSource = (typeof PAYWALL_SOURCES)[number]

/**
 * Every event the app sends, and the only shape `track()` accepts.
 *
 * A closed union rather than `capture(name, props)` at the call sites, for the
 * same reason `PLAN_LIMITS` is a table: an analytics event is a promise about
 * what leaves the device, and the store privacy forms are answered from this
 * file. A property added here is a property to declare; a string typed at a
 * call site is one nobody would know to.
 *
 * The events traced the one funnel `docs/decisions.md` chose the tool for —
 * install → onboarding → first conversation → paywall — and for a while they
 * stopped there. They no longer do, and the reason is worth stating once: that
 * funnel ends at the moment somebody pays, and every question about whether
 * they *stay* lives after it. The Boosted strip is a placement people pay for;
 * a message that is never answered, a send that quietly fails, a push nobody
 * taps and a feature nobody uses are the four ways this app can be failing
 * while the funnel looks fine. Each event below past `review_prompted` earns
 * its place by answering one of those, and the list is still closed.
 * Screens are captured separately
 * (`$screen`, see `useScreenTracking`), so a step being *seen* needs no event
 * of its own; these are the steps being *done*. Purchases themselves arrive
 * from RevenueCat's server-side integration, so `purchase_finished` is the
 * client's view of the store sheet, not the source of revenue truth.
 *
 * Property names are snake_case because that is what PostHog's own are, and a
 * dashboard reading `$screen_name` next to `learningLanguages` is a dashboard
 * with two conventions.
 */
export type AnalyticsEvent =
  | {
      name: 'welcome_chosen'
      properties: { choice: 'browse' | 'create' | 'sign_in' }
    }
  | {
      /** The sign-up request left the device. Not that it succeeded. */
      name: 'signup_submitted'
      properties: { method: SignUpMethod; from_guest: boolean }
    }
  | {
      /**
       * The mailed link was opened and spent by the app. Email only: the
       * social paths have no address to prove.
       */
      name: 'signup_verified'
      properties: { method: SignUpMethod }
    }
  | {
      name: 'guest_gate_hit'
      properties: { action: GuestGateAction }
    }
  | {
      /**
       * One wizard step was finished — which `$screen` cannot say. A view of
       * `levels` counts somebody going backwards, and counts somebody who
       * abandoned the screen the same as somebody who finished it.
       *
       * `resumed` means the draft already held that step's answers when the
       * screen mounted: a returning device, or a guest who registered.
       */
      name: 'onboarding_step_completed'
      properties: { step: OnboardingStep; guest: boolean; resumed: boolean }
    }
  | {
      name: 'onboarding_completed'
      properties: {
        referred: boolean
        native_languages: number
        learning_languages: number
        method: SignUpMethod | null
        from_guest: boolean
        /**
         * How long the whole first minute actually took, from the first
         * launch of this install. `null` on a device that was already
         * running the app before the counter existed.
         */
        seconds_since_install: number | null
      }
    }
  | {
      /** One message left the composer and the server acknowledged it. Never its body. */
      name: 'message_sent'
      properties: { kind: 'text' | 'correction' | 'image' | 'audio' | 'video'; reply: boolean }
    }
  | {
      name: 'paywall_viewed'
      properties: { feature: PlanFeature | null; tier: PlanTier; source: PaywallSource }
    }
  | {
      /** The paywall was closed without a purchase — the X, back, or "Continue free". */
      name: 'paywall_dismissed'
      properties: { source: PaywallSource; seconds_open: number }
    }
  | {
      name: 'purchase_started'
      properties: {
        offer: string
        tier: PaidPlanTier | null
        period: BillingPeriod | null
        /**
         * What the tap meant for the plan already held — a first purchase or
         * an upgrade — and `portal` for the web, where an upgrade leaves for
         * RevenueCat's portal and no `purchase_finished` follows.
         */
        change: PlanChange | 'portal'
      }
    }
  | {
      name: 'purchase_finished'
      properties: {
        offer: string
        tier: PaidPlanTier | null
        period: BillingPeriod | null
        change: PlanChange
        outcome: PurchaseOutcome
      }
    }
  | {
      /**
       * The store's review sheet was requested. Whether the OS then showed it
       * is not knowable, so this counts asks, not sheets.
       */
      name: 'review_prompted'
      properties: { trigger: 'streakMilestone' | 'correction' }
    }
  | {
      /**
       * Discover was focused with a non-empty Boosted strip.
       *
       * The denominator, and the app's first high-frequency event — every
       * other one here is a once-per-account milestone. It says the strip was
       * in the list, not that pixels reached an eye: there is deliberately no
       * viewability maths on a horizontal scroller of at most twelve cards.
       *
       * It re-fires on every refocus, which is what makes it comparable with
       * `$screen` for the same route. So the denominator is strip *shows*, not
       * tab visits.
       */
      name: 'boosted_strip_shown'
      properties: { count: number }
    }
  | {
      /**
       * A Boosted card was tapped. `slot` is the zero-based position, so the
       * click-through rate at slot *i* is this over `boosted_strip_shown`
       * where `count > i`.
       *
       * Carries no identifier for the person in the card, and `tier` is the
       * only thing it says about them. That is not squeamishness: an id of
       * theirs sitting in thousands of other people's events would outlive
       * their own account deletion, which `purgeExpiredAccounts` cannot reach.
       * The price is that this measures placement, never one subscriber's
       * delivery — that number belongs on the server, where it survives an
       * analytics opt-out.
       */
      name: 'boosted_strip_tapped'
      properties: { slot: number; tier: PaidPlanTier }
    }
  | {
      /**
       * A row in the discovery list below was tapped, `slot` zero-based.
       *
       * The baseline the strip is read against: "boosted slot 0 gets 4%" says
       * nothing until an ordinary row's number sits next to it. Both are taken
       * per Discover `$screen`, which is why neither needs a denominator event
       * of its own. Unlike the strip's, this `slot` is unbounded — the list
       * pages forever.
       */
      name: 'discovery_card_tapped'
      properties: { slot: number }
    }
  | {
      /**
       * A message arrived from somebody else while the socket was up.
       *
       * The one thing `message_sent` cannot tell you: whether anybody answers.
       * A language exchange where everyone writes and nobody replies looks,
       * from the sent side alone, exactly like one that works — and `reply` on
       * the sent event describes the *sender's* intent, not the fact of an
       * answer arriving.
       *
       * Deliberately narrower than "messages received". It fires where the
       * socket delivers, so a message that arrived as a push while the app was
       * closed is not counted, and neither is one read from a cold start's
       * first fetch. That makes it a lower bound on received traffic and an
       * honest count of conversations that were live while somebody was
       * looking. `kind` is the full `MessageType`, not the composer's shorter
       * list: what can be received is wider than what this app can send.
       */
      name: 'message_received'
      properties: { kind: MessageType }
    }
  | {
      /**
       * A send that did not land. `reason` is the server's error code where
       * there was one, `null` for a socket that never answered.
       *
       * The counterpart to `message_sent`, and the reason it is worth its own
       * event rather than a property: a failure rate is invisible in a funnel
       * built from successes. Both failure paths in the composer are quiet by
       * design — the text one leaves an unsent row, the media one a retry row —
       * so nothing anywhere counts them today.
       */
      name: 'message_send_failed'
      properties: { kind: 'text' | 'media'; reason: string | null }
    }
  | {
      /**
       * A push notification was tapped and the app opened on it.
       *
       * Eleven kinds of message go out and not one of them was measured, so
       * "does the streak reminder bring anybody back" had no answer. `kind` is
       * what the payload declared; `cold_start` separates a tap that launched
       * the app from one that came to it already running, which are different
       * amounts of interruption and convert differently.
       *
       * Counts taps, never sends — the server knows what it sent, and a push
       * that was delivered and ignored leaves no trace on the device.
       */
      name: 'notification_opened'
      properties: { kind: PushKind | 'unknown'; cold_start: boolean }
    }
  | {
      /**
       * The discovery filter sheet was applied.
       *
       * `pro` is the question: the advanced filters are a paid feature, and
       * `paywall_viewed` already says how many people are *refused* them.
       * Nothing said how many people who have them use them, which is the
       * other half of whether they are worth selling.
       *
       * `count` is how many filters the search carries, never which — a filter
       * set is a description of who somebody is looking for, and that is a
       * sharper thing to keep than this needs.
       */
      name: 'filters_applied'
      properties: { count: number; pro: boolean }
    }
  | {
      /**
       * Tokens left the balance for something in the wallet store.
       *
       * The token economy is a whole screen of the app and a whole sibling
       * site, and nothing measured whether anybody spends. `sku` is the
       * catalogue id, which is a product name and not a person; `kind` is the
       * catalogue it came from, with `consumable` for the streak freeze and
       * the day repair, which have none.
       *
       * Spending only. Earning is the server's business — it happens in cron
       * jobs and gifts the device never sees — so a balance cannot be
       * reconstructed from this, and is not meant to be.
       */
      name: 'tokens_spent'
      properties: { sku: string; kind: CosmeticKind | 'consumable'; amount: number }
    }
  | {
      /** The first-run tour opened. Once per install, so this counts installs toured. */
      name: 'tour_started'
      properties: { is_guest: boolean }
    }
  | {
      /**
       * One step was drawn against a measured element. A step whose target
       * could not be measured is skipped and never counted — otherwise the
       * drop-off would read as people refusing a step they were never shown.
       */
      name: 'tour_step_viewed'
      properties: { step: TourTargetId; index: number }
    }
  | {
      /** Sent away part-way through, by the Skip button or the back button. */
      name: 'tour_skipped'
      properties: { step: TourTargetId; index: number }
    }
  | {
      /**
       * The last step was passed. Against `tour_started`, this is the funnel —
       * and `opened_profile` splits the two ways it ends: the offer taken, or
       * the run simply finished.
       */
      name: 'tour_completed'
      properties: { is_guest: boolean; opened_profile: boolean }
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

/**
 * Which LangX an event came from, stamped on every event the SDK sends.
 *
 * PostHog's free plan allows one project, so langx.io and token.langx.io write
 * into this one too — their own `analytics` modules stamp `'website'` and
 * `'token-website'` the same way. Without this the app's insights silently
 * include marketing page views.
 *
 * `$os_name` already separates iOS from Android, but not the Expo web build:
 * there it reports the browser's operating system, so app.langx.io would read
 * as macOS or Windows rather than as us. Naming the three ourselves is one
 * property to filter on instead of two to reason about.
 *
 * It does not remove the need for an `is not set` filter on the dashboards that
 * already exist: every event captured before this shipped, and every event from
 * a build already on a phone, carries no `langx_surface` at all.
 *
 * Lives here rather than in `analytics.ts` for the reason `analyticsCore.ts`
 * does — that file imports React Native, and a test cannot.
 */
export function surfaceName(platformOS: string): string {
  return `app-${platformOS}`
}

/**
 * Stamps one outgoing event with its surface, for the SDK's `before_send`.
 *
 * The trap it exists for: `properties` is optional on the SDK's `CaptureEvent`,
 * so a lifecycle event can arrive without one and assigning into it would
 * throw. `null` passes through because `before_send` may be handed one.
 */
export function stampSurface<T extends { properties?: Record<string, unknown> } | null>(
  event: T,
  surface: string,
): T {
  if (event) event.properties = { ...event.properties, langx_surface: surface }
  return event
}
