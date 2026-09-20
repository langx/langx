import { requireOptionalNativeModule } from 'expo'

/**
 * The countdown on the Lock Screen for a call two people agreed to.
 *
 * iOS only, and only on a build made since this module existed —
 * `requireOptionalNativeModule` is what lets every call below stay
 * unconditional. On Android, on web, and on an older binary running a newer
 * bundle over the air the native side is `null` and nothing happens.
 *
 * There is no Android half and this is not an oversight. Wear's and Android's
 * equivalent of a Live Activity is an ongoing notification, which is a
 * different design with a different place on the screen; it is phase 5's to
 * decide, not this module's to fake.
 */
interface LiveActivityNativeModule {
  isSupported: () => boolean
  start: (conversationId: string, withName: string, startsAt: number, endsAt: number) => void
  end: (conversationId: string) => void
  endAll: () => void
}

const native = requireOptionalNativeModule<LiveActivityNativeModule>('LiveActivity')

/**
 * Whether this build can draw one at all.
 *
 * A *capability*, and the difference from `isSupported` below matters. This
 * one is fixed for the life of the process — the module is there or it is not
 * — so a caller may read it once. The other is a setting the person can
 * change in Settings while the app is running, so it must be asked again
 * every time rather than remembered.
 */
export function liveActivityIsAvailable(): boolean {
  return native !== null
}

/** Whether a countdown would actually appear. False with the setting off. */
export function liveActivityIsSupported(): boolean {
  return native?.isSupported() ?? false
}

/**
 * Start or move the countdown for one call.
 *
 * Seconds, not milliseconds, and not an ISO string: `Date.getTime()` is what
 * the app has and `timeIntervalSince1970` is what Swift wants, so the one
 * conversion happens at this boundary rather than in both languages.
 */
export function startExchangeActivity(input: {
  conversationId: string
  withName: string
  startsAt: Date
  endsAt: Date
}): void {
  native?.start(
    input.conversationId,
    input.withName,
    input.startsAt.getTime() / 1000,
    input.endsAt.getTime() / 1000,
  )
}

export function endExchangeActivity(conversationId: string): void {
  native?.end(conversationId)
}

/** Sign-out. A card naming somebody must not outlive the session. */
export function endAllExchangeActivities(): void {
  native?.endAll()
}
