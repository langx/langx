import * as Device from 'expo-device'
import { useEffect } from 'react'
import { Platform } from 'react-native'
import { api } from '../api/client'

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

    const token = await Notifications.getExpoPushTokenAsync()
    await api.post('/me/devices', {
      pushToken: token.data,
      platform: Platform.OS === 'ios' ? 'ios' : 'android',
    })
  } catch {
    // Never let notification setup break the app it is decorating.
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
