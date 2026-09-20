import { type WatchPayload } from '@langx/shared'
import { requireOptionalNativeModule } from 'expo'

/**
 * The one door between the app and a Wear OS watch.
 *
 * The Android twin of `modules/watch-link`, and deliberately the same shape:
 * the two platforms differ in transport and in nothing else, so a call site
 * that has a payload calls both and lets each be a no-op where it does not
 * apply. `packages/shared/src/watch.ts` is the one definition of what travels.
 *
 * `requireOptionalNativeModule` rather than `requireNativeModule`, for the
 * reason the other modules give: web, iOS, and any binary built before this
 * module existed get `null` and every function below stays a no-op. An OTA
 * update reaches older binaries, so this is the ordinary case and not a guard
 * against a mistake.
 */
interface WearLinkNativeModule {
  isSupported: () => boolean
  send: (json: string) => void
  clear: () => void
  setCredentials: (baseUrl: string, cookie: string) => void
}

const native = requireOptionalNativeModule<WearLinkNativeModule>('WearLink')

/**
 * Whether this device could have a Wear OS watch listening.
 *
 * True wherever Play services are present, which is not a claim that a watch
 * is paired — nothing on the phone gets to know that reliably. It is used to
 * skip *building* a payload on a device with no Wear support at all.
 */
export function wearIsSupported(): boolean {
  return native?.isSupported() ?? false
}

/** Hand the watch the current unread list. */
export function sendWearPayload(payload: WatchPayload): void {
  native?.send(JSON.stringify(payload))
}

/** Sign-out: empty the watch and forget the cookie, in one call. */
export function clearWear(): void {
  native?.clear()
}

/** Give Kotlin what it needs to send a reply while the app is not running. */
export function setWearCredentials(baseUrl: string, cookie: string): void {
  native?.setCredentials(baseUrl, cookie)
}
