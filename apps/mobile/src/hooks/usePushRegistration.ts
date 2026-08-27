import * as Device from 'expo-device'
import { useEffect } from 'react'
import { Platform } from 'react-native'
import { api } from '../api/client'

/**
 * Asks for notification permission once and registers the Expo token.
 *
 * Simulators cannot receive push, so asking there trains the developer to
 * dismiss a prompt that can never lead anywhere — `Device.isDevice` skips it.
 * Failures are swallowed on purpose: a declined permission is a normal choice,
 * not an error state worth interrupting the app for.
 */
export function usePushRegistration(): void {
  useEffect(() => {
    void (async () => {
      try {
        if (Platform.OS === 'web' || !Device.isDevice) return

        // Imported here, not at module scope. Inside Expo Go on Android,
        // `expo-notifications` throws the moment it is imported — remote push
        // was removed from Expo Go there in SDK 53. At module scope that throw
        // takes down the layout importing this hook, and every signed-in
        // screen with it; expo-router surfaces it as the very misleading
        // "Route (app)/_layout.tsx is missing the required default export".
        // A development build has the native module and works normally.
        const Notifications = await import('expo-notifications')

        // `granted` is compared through expo's own enum rather than the string
        // literal — the two are not the same type, and the literal comparison
        // silently never matches.
        const existing = await Notifications.getPermissionsAsync()
        const status = existing.granted
          ? existing.status
          : (await Notifications.requestPermissionsAsync()).status
        if (status !== Notifications.PermissionStatus.GRANTED) return

        const token = await Notifications.getExpoPushTokenAsync()
        await api.post('/me/devices', {
          pushToken: token.data,
          platform: Platform.OS === 'ios' ? 'ios' : 'android',
        })
      } catch {
        // Never let notification setup break the app it is decorating.
      }
    })()
  }, [])
}
