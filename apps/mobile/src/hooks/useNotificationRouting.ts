import { router } from 'expo-router'
import { useEffect } from 'react'
import { Platform } from 'react-native'
import { configureNotifications } from '../lib/notifications'
import { notificationRoute } from '../lib/notificationRoute'

/**
 * Makes a tapped notification open the thing it is about.
 *
 * Until this existed the payload was sent and never read: tapping "Deniz sent
 * you a message" opened the app wherever it had been left, and the person had
 * to go and find the conversation themselves — which is most of the value of
 * the notification, gone.
 *
 * Both entry points are covered, and they are genuinely different. A tap while
 * the app is running arrives on the listener. A tap that *launches* the app
 * happened before any listener existed, so it has to be asked for — that is
 * the cold-start case, and it is the common one, because a notification is
 * usually read on a locked phone.
 */
export function useNotificationRouting(): void {
  useEffect(() => {
    if (Platform.OS === 'web') return
    let cancelled = false
    let subscription: { remove: () => void } | undefined

    void (async () => {
      await configureNotifications()
      try {
        const Notifications = await import('expo-notifications')
        if (cancelled) return

        subscription = Notifications.addNotificationResponseReceivedListener((response) => {
          const href = notificationRoute(response.notification.request.content.data)
          if (href) router.push(href)
        })

        const initial = await Notifications.getLastNotificationResponseAsync()
        if (cancelled || !initial) return
        const href = notificationRoute(initial.notification.request.content.data)
        // `push`, not `replace`: the tab the app opened on stays underneath, so
        // the back gesture out of the conversation goes somewhere sensible
        // instead of off the end of the stack.
        if (href) router.push(href)
      } catch {
        // No notifications module here — nothing to route.
      }
    })()

    return () => {
      cancelled = true
      subscription?.remove()
    }
  }, [])
}
