import Constants from 'expo-constants'
import * as Device from 'expo-device'
import { useEffect } from 'react'
import { Platform } from 'react-native'
import { api } from '../api/client'
import { currentLocale } from '../i18n/runtime'

/**
 * Expo needs to know which project a push token belongs to. It can usually
 * work this out from the app config on its own, but when it cannot it throws —
 * and every caller here swallows errors, so the failure would show up as
 * notifications simply never arriving, with nothing logged anywhere. Passing
 * it explicitly costs one line and removes that failure mode.
 */
function pushTokenOptions(): { projectId?: string } {
  const eas = Constants.expoConfig?.extra?.eas as { projectId?: string } | undefined
  // Omitted rather than passed as undefined, which `exactOptionalPropertyTypes`
  // rejects — and omitting it leaves Expo to work it out, the old behaviour.
  return eas?.projectId ? { projectId: eas.projectId } : {}
}

/**
 * Registers this device's Expo push token with the API.
 *
 * Assumes permission is already granted; the caller checks. Safe to call more
 * than once — `/me/devices` upserts on the token.
 */
export async function registerPushToken(): Promise<void> {
  try {
    if (Platform.OS === 'web' || !Device.isDevice) return

    // Imported here, not at module scope. Inside Expo Go on Android,
    // `expo-notifications` throws the moment it is imported — remote push was
    // removed from Expo Go there in SDK 53. At module scope that throw takes
    // down the layout importing this hook, and every signed-in screen with it;
    // expo-router surfaces it as the very misleading "Route (app)/_layout.tsx
    // is missing the required default export". A development build has the
    // native module and works normally.
    const Notifications = await import('expo-notifications')

    const token = await Notifications.getExpoPushTokenAsync(pushTokenOptions())
    await api.post('/me/devices', {
      // The device's language, not the account's: a streak reminder arrives
      // when the app is closed, so nothing else can decide what it says.
      locale: currentLocale(),
      pushToken: token.data,
      platform: Platform.OS === 'ios' ? 'ios' : 'android',
    })
  } catch {
    // Never let notification setup break the app it is decorating.
  }
}

/**
 * Removes this device's push token from the account it is currently signed
 * into. Call before ending the session.
 *
 * Without it a signed-out device keeps receiving that account's message and
 * streak notifications until the token happens to be reassigned — someone
 * signs out on a borrowed or sold phone and their messages keep arriving on
 * it. `DELETE /me/devices/:token` existed for this from the beginning and
 * nothing called it.
 *
 * Every failure is swallowed. A token that cannot be removed must never be
 * able to trap someone in a signed-in state: being unable to sign out is a
 * worse outcome than a stale token, and the server drops the token anyway the
 * moment it is claimed by another account.
 */
export async function unregisterPushToken(): Promise<void> {
  try {
    if (Platform.OS === 'web' || !Device.isDevice) return
    const Notifications = await import('expo-notifications')
    const existing = await Notifications.getPermissionsAsync()
    // No permission means no token was ever registered from this device.
    if (!existing.granted) return

    const token = await Notifications.getExpoPushTokenAsync(pushTokenOptions())
    await api.delete(`/me/devices/${encodeURIComponent(token.data)}`)
  } catch {
    // See above: never block a sign-out.
  }
}

/**
 * Registers the push token on launch — and **does not ask for permission**.
 *
 * It used to ask, the moment the signed-in layout mounted: a system dialog
 * before the app had shown anything, about a product the user had not used
 * yet. That is the highest-refusal pattern there is, and on iOS the refusal is
 * permanent — the OS never asks again, so a "no" collected in the first two
 * seconds costs every future message notification.
 *
 * Asking now belongs to `NotificationPriming`, on a screen the user arrived at
 * deliberately and which says what the notifications are for. This hook only
 * registers the token for someone who has *already* granted permission, so
 * everyone who said yes before is entirely unaffected.
 */
export function usePushRegistration(): void {
  useEffect(() => {
    void (async () => {
      try {
        if (Platform.OS === 'web' || !Device.isDevice) return
        const Notifications = await import('expo-notifications')

        // `granted` is read through expo's own field rather than comparing the
        // status to a string literal — the two are not the same type, and the
        // literal comparison silently never matches.
        const existing = await Notifications.getPermissionsAsync()
        if (!existing.granted) return

        await registerPushToken()
      } catch {
        // Never let notification setup break the app it is decorating.
      }
    })()
  }, [])
}
