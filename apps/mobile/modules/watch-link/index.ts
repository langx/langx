import { type WatchPayload } from '@langx/shared'
import { requireOptionalNativeModule } from 'expo'

/**
 * The one door between the app and the Apple Watch.
 *
 * Narrower than `companion-snapshot`, which serves both platforms: there is
 * no Android half of this at all. Wear OS is a separate plan with separate
 * constraints — see `docs/plans/iphone-watch-and-carplay.md` → _Not in this
 * plan_ — so every call here is a no-op off iOS rather than a second road to
 * the same place.
 *
 * `requireOptionalNativeModule` rather than `requireNativeModule`, for the
 * reason the widget module gives: web and any binary built before this module
 * existed get `null`, and every function below stays a no-op. An OTA update
 * reaches older binaries, so this is the ordinary case and not a guard
 * against a mistake.
 */
interface WatchLinkNativeModule {
  isSupported: () => boolean
  send: (json: string) => void
  clear: () => void
  setCredentials: (baseUrl: string, cookie: string) => void
}

const native = requireOptionalNativeModule<WatchLinkNativeModule>('WatchLink')

/**
 * Whether this device could have a watch listening.
 *
 * False on web, on a build without the module, on an iPad, and on the great
 * majority of iPhones — whose owners have no Apple Watch. The caller uses it
 * to skip *building* a payload, which costs a profile-cache read and a walk
 * over the conversation list on every change. It is not a claim that a watch
 * is paired or awake; nothing on the phone gets to know that, and the watch
 * itself draws the honest answer when the phone goes quiet.
 */
export function watchIsSupported(): boolean {
  return native?.isSupported() ?? false
}

/** Hand the watch the current unread list. */
export function sendWatchPayload(payload: WatchPayload): void {
  native?.send(JSON.stringify(payload))
}

/**
 * Sign-out, in one call because the two halves must not come apart.
 *
 * It empties the watch *and* forgets the cookie. Either one alone is a bug
 * with a face: a watch still listing the previous account's threads, or an
 * emptied watch that can still send as them.
 */
export function clearWatch(): void {
  native?.clear()
}

/**
 * Give Swift what it needs to send a reply while the app is not running.
 *
 * Called on sign-in and whenever the cookie is refreshed. It goes into the
 * Keychain rather than the App Group container the widget snapshot uses,
 * because this is a credential and that is a set of counts.
 */
export function setWatchCredentials(baseUrl: string, cookie: string): void {
  native?.setCredentials(baseUrl, cookie)
}
