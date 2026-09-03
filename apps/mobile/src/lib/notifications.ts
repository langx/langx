import { Platform } from 'react-native'

/**
 * The one piece of notification setup the OS needs before the first one
 * arrives: an Android channel.
 *
 * Android 8+ drops any notification that names no channel, and the importance
 * is fixed when the channel is created — raising it later has no effect on a
 * device that already has it. `HIGH` is what makes a message appear as a
 * heads-up banner rather than a silent row in the shade. The API names this
 * channel on every send.
 *
 * `expo-notifications` survives for exactly this call and only on Android.
 * Firebase Messaging carries the token, the permission and the taps now, and
 * it does not create channels; on iOS there are no channels and the module is
 * never imported, so the two libraries never both answer the same delivery.
 *
 * Nothing here decides how a foreground notification is drawn any more: with
 * Firebase, a message that arrives while the app is open is handed to JS and
 * shown nowhere by the OS — which is what `useNotificationRouting` wants,
 * because it draws the in-app banner instead.
 */
export async function configureNotifications(): Promise<void> {
  if (Platform.OS !== 'android') return
  try {
    // Lazily, for the reason in docs/decisions.md: inside Expo Go the import
    // throws, and at module scope that takes the whole layout down.
    const Notifications = await import('expo-notifications')
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Messages and reminders',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
    })
  } catch {
    // A device that cannot be configured for notifications still runs the app.
  }
}
