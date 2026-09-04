import { Platform } from 'react-native'

/**
 * Mirrors the unread total onto the app icon.
 *
 * One seam: the Chats tab reads `useUnreadTotal`, the icon reads the same
 * number through this, and the push that arrives while the app is closed
 * carries the same `countUnread` result as its `badge`. Three places, one
 * count. Zero clears the icon outright — an icon reading "0" is an icon
 * saying you have something.
 *
 * Native only: the web has no icon. Loaded lazily so the web bundle never
 * imports `expo-notifications`, and never throws — a badge that cannot be set
 * is not worth failing a screen over.
 */
export async function syncIconBadge(total: number): Promise<void> {
  if (Platform.OS === 'web') return
  try {
    const Notifications = await import('expo-notifications')
    await Notifications.setBadgeCountAsync(Math.max(0, Math.floor(total)))
  } catch {
    // See above.
  }
}
