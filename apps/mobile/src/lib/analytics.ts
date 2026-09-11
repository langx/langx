import { Platform } from 'react-native'
import { createAnalyticsCore, type AnalyticsClient } from './analyticsCore'
import { FLAG_KEYS, readBoolFlag, setBoolFlag } from './localFlags'
import { stampSurface, surfaceName } from './analyticsEvents'

/**
 * The app's whole surface onto PostHog.
 *
 * Shaped like `purchases.ts`, and for the same two reasons: an optional
 * service degrades rather than crashes (no key means every export below is a
 * no-op and Settings shows no analytics row), and the SDK's types stay in this
 * file — screens call `track()` with an `AnalyticsEvent`, never the client.
 *
 * Four settings here are declarations, not preferences. They are what
 * `docs/store/privacy-data-safety.md` says about analytics, and the store forms
 * are answered from that document; change one and the forms are wrong:
 *
 *  - `disableGeoip: true` — PostHog never turns the IP into a country, so
 *    analytics adds no location, coarse or otherwise, to what the app collects.
 *  - `enableSessionReplay` — on, on a phone, with everything readable masked
 *    before the frame leaves the device. This file used to say no recordings
 *    on the grounds that this is a messaging app; what changed is the answer
 *    to *that*, not the objection, and the masking below is the whole of it.
 *  - No push capture. The native plugin would hand PostHog the device's push
 *    token and count opens, both on by default, which is a second copy of
 *    `devices` for something `notification_opened` already measures.
 *  - The id is ours: `identify()` is called with the Better Auth user id and
 *    nothing else — no email, no name — so a deleted account's events can be
 *    found and deleted by the same id.
 *
 * EU Cloud by default, because the users are; `docs/decisions.md` → _The
 * analytics dashboard is private_.
 */

const DEFAULT_HOST = 'https://eu.i.posthog.com'

/** Which LangX this build is, stamped on every event. See `analyticsEvents.ts`. */
const SURFACE = surfaceName(Platform.OS)

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
      /*
       * Recordings, of a messaging app — so none of what makes that
       * defensible is left to a default. The three masking options are the
       * SDK's own defaults written out, because a dependency bump that
       * changed one would change what leaves the phone without changing a
       * line here, and a promise on a store form cannot rest on that.
       *
       * `maskAllTextInputs` is named for fields but covers all text, which is
       * what makes replay possible at all: a message bubble is a grey block
       * in the recording, and so are a handle, a bio and a display name.
       * `maskAllImages` does the same for avatars and photos.
       *
       * The other two are defaults *inverted*, and they are the two ways a
       * body would reach a recording past the masking: a console line is
       * whatever the app logged, and a request URL carries the chat and
       * profile ids that every event here deliberately leaves on the device.
       *
       * No `sampleRate`. Set here it would win over the project's, and then
       * recording fewer sessions would mean a store release; left out, the
       * dial is in PostHog — which is what `disableRemoteConfig` below is
       * now for.
       *
       * Native only. The plugin is skipped on web, so `true` there would buy
       * a warning on every page load and record nothing either way.
       */
      enableSessionReplay: Platform.OS !== 'web',
      sessionReplayConfig: {
        maskAllTextInputs: true,
        maskAllImages: true,
        maskAllSandboxedViews: true,
        captureLog: false,
        captureNetworkTelemetry: false,
      },
      // Both are on by default the moment the native plugin exists; see above.
      capturePushNotificationSubscriptions: false,
      capturePushNotificationOpened: false,
      // Installed / Opened / Backgrounded — the start of the funnel, and the
      // only way to count an install that never reached a screen of ours.
      captureAppLifecycleEvents: true,
      persistence: 'file',
      // Set here rather than through `register()` so the lifecycle events
      // captured during construction carry it too.
      before_send: (event) => stampSurface(event, SURFACE),
      ...(Platform.OS === 'web' ? { customStorage: webStorage } : {}),
      // Flags and surveys are still a request on boot, on a phone, for an
      // answer nothing reads. Remote config stopped being one when replay
      // arrived: it carries the project's sample rate, and it is cached, so a
      // rate set today reaches a phone on its next launch rather than this one.
      preloadFeatureFlags: false,
      sendFeatureFlagEvent: false,
      disableSurveys: true,
      disableRemoteConfig: false,
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
