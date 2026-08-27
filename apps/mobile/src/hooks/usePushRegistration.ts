import * as Device from 'expo-device'
import * as Notifications from 'expo-notifications'
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
