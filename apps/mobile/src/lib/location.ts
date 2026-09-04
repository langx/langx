import type { MessageKey, TranslateFn } from '../i18n/runtime'
import * as Location from 'expo-location'
import { Linking, Platform } from 'react-native'
import { confirmAlert, showAlert } from './alert'

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

/**
 * What the OS currently thinks, as opposed to what the server has stored.
 *
 * The two drift apart in a way that used to be silent: a profile keeps its
 * `location` forever once shared, so a screen that trusts the server's flag
 * skips asking even after the permission has been revoked in OS settings —
 * and then sorts by distance around a point nobody can update.
 *
 * `granted` is the only thing worth returning beyond `canAskAgain`, which is
 * what separates "we can raise the dialog" from "only the Settings app can
 * fix this now".
 */
export async function locationPermissionState(): Promise<{
  granted: boolean
  canAskAgain: boolean
}> {
  try {
    const permission = await Location.getForegroundPermissionsAsync()
    return { granted: permission.granted, canAskAgain: permission.canAskAgain }
  } catch {
    // Web without the API, or a platform that has no such notion. Treat it as
    // askable: `captureLocation` is the thing that actually decides, and it
    // fails cleanly.
    return { granted: false, canAskAgain: true }
  }
}

/**
 * Tells someone why a fix did not arrive, and where the switch is.
 *
 * A refusal is not an error to report, it is a setting somewhere else: iOS
 * never asks twice and Android stops after the second no, so an alert that
 * says "denied" leaves a person holding a control that will not move and no
 * idea why. Settings and the country picker each wrote this block out in full;
 * Discover had only `showAlert(t('location.needed'), …)`, which is why a
 * revoked permission there produced an empty list and nothing else.
 *
 * Only the non-refusal title stays with the caller, because the three screens
 * legitimately word that case differently — Settings says "unavailable", the
 * country picker says "failed", and Discover says what it needed it for.
 */
export async function reportLocationFailure(
  reason: Extract<LocationResult, { ok: false }>['reason'],
  t: TranslateFn,
  /** The title for everything that is not a refusal; the three screens differ. */
  failedTitleKey: MessageKey,
): Promise<void> {
  if (reason === 'denied') {
    const open = await confirmAlert({
      title: t('location.deniedTitle'),
      message: t(Platform.OS === 'ios' ? 'location.deniedBodyIos' : 'location.deniedBodyAndroid'),
      confirmLabel: t('location.openSettings'),
    })
    if (open) await Linking.openSettings()
    return
  }
  await showAlert(t(failedTitleKey), t(LOCATION_FAILURE_KEY[reason]))
}
