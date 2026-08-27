import { Platform } from 'react-native'

/**
 * Two things that have to be set before the first notification arrives, and
 * are easy to leave out because their absence looks like nothing rather than
 * like an error.
 *
 * Everything here is lazily imported and native-only, for the reason in
 * docs/decisions.md: `expo-notifications` throws on import inside Expo Go on
 * Android, and at module scope that takes the whole layout down.
 */
export async function configureNotifications(): Promise<void> {
  if (Platform.OS === 'web') return
  try {
    const Notifications = await import('expo-notifications')

    /**
     * Without a handler, a notification that arrives while the app is open is
     * delivered to the JS layer and shown nowhere — so someone reading one
     * conversation never learns about a message in another. Both platforms
     * default to silence here; it is a decision, not a default.
     */
    Notifications.setNotificationHandler({
      handleNotification: () =>
        Promise.resolve({
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
        }),
    })

    if (Platform.OS === 'android') {
      /**
       * Android 8+ drops any notification that names no channel, and the
       * importance is fixed when the channel is created — raising it later has
       * no effect on a device that already has it. `HIGH` is what makes a
       * message notification appear as a heads-up banner rather than a silent
       * row in the shade.
       */
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Messages and reminders',
        importance: Notifications.AndroidImportance.HIGH,
        sound: 'default',
      })
    }
  } catch {
    // A device that cannot be configured for notifications still runs the app.
  }
}
