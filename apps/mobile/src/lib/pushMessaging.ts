import * as Device from 'expo-device'
import { Platform } from 'react-native'
import type * as FirebaseMessaging from '@react-native-firebase/messaging'

/**
 * The one door to Firebase Messaging on the client.
 *
 * Imported lazily and only here, for the reason `docs/decisions.md` gives for
 * `expo-notifications`: inside Expo Go the native module does not exist and
 * the import throws, and at module scope that throw takes the signed-in
 * layout down with it. A development build has the module and works. On web
 * and on a simulator there is nothing to talk to, so every caller gets `null`
 * and does nothing — push simply is not a thing there.
 *
 * Push used to go through Expo's relay, which handed out its own token format
 * and needed our FCM and Apple keys uploaded to Expo. The app now registers
 * the device's own FCM token on both platforms and the API sends to Firebase
 * directly; the only key lives on our server.
 */
/** Everything Firebase Messaging exports, as a value — `null` where push cannot exist. */
export type MessagingModule = typeof FirebaseMessaging

export async function messagingModule(): Promise<MessagingModule | null> {
  if (Platform.OS === 'web' || !Device.isDevice) return null
  try {
    return await import('@react-native-firebase/messaging')
  } catch {
    return null
  }
}

/** The data a notification carries, as FCM delivers it: every value a string. */
export type PushData = Record<string, string | undefined>
