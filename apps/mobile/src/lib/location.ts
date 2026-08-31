import type { MessageKey } from '../i18n/runtime'
import * as Location from 'expo-location'

/**
 * Reading the device's position, and the one decision that makes this file
 * worth having: **we ask for the least accurate fix the platform offers.**
 *
 * The server rounds coordinates to about a kilometre anyway (`location.ts` in
 * `@langx/shared`), so a precise fix would be thrown away — but asking for one
 * still costs the user a GPS warm-up and, on iOS 14+, still shows the
 * "Precise: On" affordance and invites them to turn it off. `Lowest` is
 * satisfied by the network/cell estimate the OS already has, which is both
 * faster and honest about what the feature actually needs.
 */
const ACCURACY = Location.Accuracy.Lowest

/**
 * A fix, or `null` with a reason. Deliberately not a thrown error: every
 * outcome here is an ordinary thing that happens to real users — permission
 * declined, location services switched off at the OS level, indoors with no
 * signal — and the caller has different copy for each.
 */
export type LocationResult =
  | { ok: true; lat: number; lng: number }
  | { ok: false; reason: 'denied' | 'disabled' | 'unavailable' }

export interface CaptureOptions {
  /**
   * Whether an unprompted user may be asked.
   *
   * `false` for anything the app decides to do on its own. A background
   * refresh that can raise the OS permission dialog is a dialog appearing on a
   * timer, at a moment the person did not choose and cannot connect to
   * anything they tapped — which is how a feature teaches people to say no.
   */
  promptIfNeeded?: boolean
}

export async function captureLocation({
  promptIfNeeded = true,
}: CaptureOptions = {}): Promise<LocationResult> {
  // `getForegroundPermissionsAsync` first, so a user who has already granted
  // it is never re-prompted; `request` only runs the first time.
  let permission = await Location.getForegroundPermissionsAsync()
  if (!permission.granted && permission.canAskAgain && promptIfNeeded) {
    permission = await Location.requestForegroundPermissionsAsync()
  }
  if (!permission.granted) return { ok: false, reason: 'denied' }

  // Granting the app permission is not the same as location being on at all:
  // the toggle in the OS settings outranks it, and the call below throws
  // rather than returning anything when it is off.
  if (!(await Location.hasServicesEnabledAsync())) return { ok: false, reason: 'disabled' }

  try {
    // A cached fix is fine and usually instant. `maxAge` of an hour matches
    // how coarse the stored value is — a position from an hour ago and one
    // from now land in the same grid cell unless the user has travelled, and
    // if they have, the next refresh catches it.
    const position = await Location.getLastKnownPositionAsync({ maxAge: 60 * 60 * 1000 })
    const fix = position ?? (await Location.getCurrentPositionAsync({ accuracy: ACCURACY }))
    return { ok: true, lat: fix.coords.latitude, lng: fix.coords.longitude }
  } catch {
    return { ok: false, reason: 'unavailable' }
  }
}

/**
 * What to tell someone when it did not work. One place, so Settings and
 * Discover say the same thing — and keys rather than sentences, so they also
 * say it in the same language the rest of the screen is in.
 */
export const LOCATION_FAILURE_KEY: Record<
  Extract<LocationResult, { ok: false }>['reason'],
  MessageKey
> = {
  denied: 'location.denied',
  disabled: 'location.disabled',
  unavailable: 'location.unavailable',
}
