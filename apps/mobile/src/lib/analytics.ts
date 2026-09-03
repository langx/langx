import { Platform } from 'react-native'
import { createAnalyticsCore, type AnalyticsClient } from './analyticsCore'
import { FLAG_KEYS, readBoolFlag, setBoolFlag } from './localFlags'

/**
 * The app's whole surface onto PostHog.
 *
 * Shaped like `purchases.ts`, and for the same two reasons: an optional
 * service degrades rather than crashes (no key means every export below is a
 * no-op and Settings shows no analytics row), and the SDK's types stay in this
 * file — screens call `track()` with an `AnalyticsEvent`, never the client.
 *
 * Three settings here are declarations, not preferences. They are what
 * `docs/store/privacy-data-safety.md` says about analytics, and the store forms
 * are answered from that document; change one and the forms are wrong:
 *
 *  - `disableGeoip: true` — PostHog never turns the IP into a country, so
 *    analytics adds no location, coarse or otherwise, to what the app collects.
 *  - `enableSessionReplay: false` — no recordings. Replay would need a native
 *    module and a new answer on both forms, and this is a messaging app.
 *  - The id is ours: `identify()` is called with the Better Auth user id and
 *    nothing else — no email, no name — so a deleted account's events can be
 *    found and deleted by the same id.
 *
 * EU Cloud by default, because the users are; `docs/decisions.md` → _The
 * analytics dashboard is private_.
 */

const DEFAULT_HOST = 'https://eu.i.posthog.com'

function apiKey(): string | null {
  return process.env.EXPO_PUBLIC_POSTHOG_KEY || null
}

/** False in every build without a key — the Settings row hides itself on this. */
export function isAnalyticsAvailable(): boolean {
  return apiKey() !== null
}

/**
 * On the web the SDK has nothing to persist into — expo-file-system has no
 * browser side — and falls back to memory, which hands every page load a new
 * anonymous id. `localStorage` is what `localFlags.ts` uses there too, guarded
 * the same way: a browser that refuses storage gets memory, not an error.
 */
const webStorage = {
  getItem(key: string): string | null {
    try {
      return globalThis.localStorage?.getItem(key) ?? null
    } catch {
      return null
    }
  },
  setItem(key: string, value: string): void {
    try {
      globalThis.localStorage?.setItem(key, value)
    } catch {
      // Memory it is.
    }
  },
}

let instance: AnalyticsClient | null = null

async function loadClient(): Promise<AnalyticsClient | null> {
  const key = apiKey()
  if (!key) return null
  // One instance per process: opting out and back in must talk to the same
  // storage, or the second instance would inherit the first's refusal.
  if (instance) return instance
  try {
    const { PostHog } = await import('posthog-react-native')
    instance = new PostHog(key, {
      host: process.env.EXPO_PUBLIC_POSTHOG_HOST || DEFAULT_HOST,
      disableGeoip: true,
      enableSessionReplay: false,
      // Installed / Opened / Backgrounded — the start of the funnel, and the
      // only way to count an install that never reached a screen of ours.
      captureAppLifecycleEvents: true,
      persistence: 'file',
      ...(Platform.OS === 'web' ? { customStorage: webStorage } : {}),
      // Nothing here uses flags, surveys or remote config yet; each is a
      // request on boot, on a phone, for an answer nothing reads.
      preloadFeatureFlags: false,
      sendFeatureFlagEvent: false,
      disableSurveys: true,
      disableRemoteConfig: true,
    })
    return instance
  } catch {
    // A build where the module cannot start behaves like one with no key.
    return null
  }
}

const core = createAnalyticsCore({
  loadClient,
  readOptOut: () => readBoolFlag(FLAG_KEYS.analyticsOptOut),
  writeOptOut: (optOut) => setBoolFlag(FLAG_KEYS.analyticsOptOut, optOut),
})

/** Reads the stored answer and, unless it is no, starts the SDK. Idempotent. */
export const startAnalytics = core.start
export const track = core.track
export const trackScreen = core.screen
/** Binds events to the signed-in account. Never for a guest — see the root layout. */
export const identifyForAnalytics = core.identify
export const forgetAnalyticsIdentity = core.forget
export const setAnalyticsEnabled = core.setEnabled
export const isAnalyticsEnabled = core.isEnabled
export const isAnalyticsSettled = core.isSettled
export const subscribeAnalytics = core.subscribe
