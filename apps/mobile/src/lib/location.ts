import type { MessageKey, TranslateFn } from '../i18n/runtime'
import * as Location from 'expo-location'
import { router } from 'expo-router'
import { confirmAlert, showAlert } from './alert'

/**
 * Reading the device's position, and the one decision that makes this file
 * worth having: **we ask for a fix finer than the grid we store it on.**
 *
 * The server rounds every coordinate to about a kilometre (`location.ts` in
 * `@langx/shared`) and throws the rest away, so nothing precise survives the
 * boundary. What the rounding cannot do is fix a reading that was already
 * wrong by more than a cell. `Lowest` was: it is `kCLLocationAccuracyThree-
 * Kilometers` on iOS, three times coarser than the cell it feeds, so a fix
 * could round into a neighbouring cell and sort somebody against the wrong
 * side of their city — the argument for it measured the request against the
 * feature's needs and never against the grid. `Balanced` is a hundred metres,
 * comfortably inside the cell, which is the whole requirement.
 *
 * It buys nothing at the permission boundary and costs nothing there either.
 * This constant is `desiredAccuracy`; it is not what the dialog asks for.
 * Android requests `ACCESS_FINE_LOCATION` beside the coarse one whatever we
 * put here, and iOS 14+ opens on "Precise: On" — so the person was already
 * choosing between precise and approximate, and `coarsen` rounds whichever
 * they chose.
 */
const ACCURACY = Location.Accuracy.Balanced

/**
 * A fix, or `null` with a reason. Deliberately not a thrown error: every
 * outcome here is an ordinary thing that happens to real users — permission
 * declined, location services switched off at the OS level, indoors with no
 * signal — and the caller has different copy for each.
 */
export type LocationResult =
  | { ok: true; lat: number; lng: number }
  | { ok: false; reason: 'denied' | 'disabled' | 'unavailable' }

/** Why there is no fix — the three cases every caller has separate copy for. */
export type LocationFailure = Extract<LocationResult, { ok: false }>['reason']

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
  /**
   * Skip the cached fix and ask the OS for a position now.
   *
   * `true` only when the user did something that *means* "where am I" — the
   * Nearby button. A cached fix is the right default everywhere else, but a
   * person who taps Nearby after moving expects the list to have moved with
   * them, and being handed an hour-old position looks like the feature is
   * broken rather than thrifty.
   */
  fresh?: boolean
}

export async function captureLocation({
  promptIfNeeded = true,
  fresh = false,
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
    // A cached fix is fine and usually instant, and `maxAge` of an hour
    // matches how coarse the stored value is: a position from an hour ago and
    // one from now land in the same grid cell unless the user has travelled,
    // and if they have, the next refresh catches it. `fresh` is the caller
    // saying it cannot wait for that next refresh.
    const position = fresh
      ? null
      : await Location.getLastKnownPositionAsync({
          maxAge: 60 * 60 * 1000,
          // The same rule as `ACCURACY`, applied to the fix we did not ask
          // for. Without it the cache can hand back the three-kilometre
          // network estimate some other app left behind, which is the reading
          // `Lowest` used to produce and the one the grid cannot absorb.
          // Rejecting it returns `null`, and the line below asks properly.
          requiredAccuracy: 1000,
        })
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
export const LOCATION_FAILURE_KEY: Record<LocationFailure, MessageKey> = {
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
 * Tells someone why a fix did not arrive, and offers the way out.
 *
 * A refusal is not an error to report, it is a setting somewhere else: iOS
 * never asks twice and Android stops after the second no, so an alert that
 * says "denied" leaves a person holding a control that will not move and no
 * idea why. Settings and the country picker each wrote the instructions out in
 * full, in a two-button dialog whose confirm ran `Linking.openSettings()` —
 * which react-native-web does not have, so on the web both buttons threw a
 * `TypeError` into a `void`ed promise and did nothing at all.
 *
 * So the button routes to `settings/location` instead. That screen is the only
 * place the instructions live now, it knows which of the four states this
 * device is actually in, and it exists on the web.
 *
 * Only the non-refusal title stays with the caller, because the screens
 * legitimately word that case differently — Settings says "unavailable" and
 * the country picker says "failed".
 */
export async function reportLocationFailure(
  reason: LocationFailure,
  t: TranslateFn,
  /** The title for everything that is not a refusal; the screens differ. */
  failedTitleKey: MessageKey,
): Promise<void> {
  // Weather, not configuration. There is no switch to send anyone to, and
  // offering the guide would be offering to fix something that is not broken.
  if (reason === 'unavailable') {
    await showAlert(t(failedTitleKey), t(LOCATION_FAILURE_KEY[reason]))
    return
  }

  const open = await confirmAlert({
    title: reason === 'denied' ? t('location.deniedTitle') : t(failedTitleKey),
    message: t(LOCATION_FAILURE_KEY[reason]),
    confirmLabel: t('location.guide.howTo'),
  })
  // No `from`: every caller pushes this from a screen it is already standing
  // on, so `goBackTo` pops rather than needing to be told where to land.
  if (open) router.push('/(app)/settings/location')
}
