import { useQueryClient } from '@tanstack/react-query'
import { router } from 'expo-router'
import { useEffect } from 'react'
import { AppState } from 'react-native'
import { markConversationRead } from '../api/queries'
import { getActiveConversation } from '../lib/activeConversation'
import { presentationFor } from '../lib/foregroundPush'
import { previewOf, showMessageBanner } from '../lib/inAppNotifications'
import { configureNotifications } from '../lib/notifications'
import { notificationRoute } from '../lib/notificationRoute'
import { messagingModule, type PushData } from '../lib/pushMessaging'

/**
 * Makes a tapped notification open the thing it is about, and a message that
 * arrives while the app is open appear as the in-app banner.
 *
 * Until the first half existed the payload was sent and never read: tapping
 * "Deniz sent you a message" opened the app wherever it had been left, and
 * the person had to go and find the conversation themselves — which is most
 * of the value of the notification, gone.
 *
 * Both tap entry points are covered, and they are genuinely different. A tap
 * while the app is running arrives on the listener. A tap that *launches* the
 * app happened before any listener existed, so it has to be asked for — that
 * is the cold-start case, and it is the common one, because a notification is
 * usually read on a locked phone.
 */
export function useNotificationRouting({ enabled = true }: { enabled?: boolean } = {}): void {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    const unsubscribe: (() => void)[] = []

    void (async () => {
      await configureNotifications()
      const fm = await messagingModule()
      if (!fm || cancelled) return
      const messaging = fm.getMessaging()

      unsubscribe.push(
        fm.onNotificationOpenedApp(messaging, (remote) => {
          const href = notificationRoute(remote.data)
          if (href) router.push(href)
        }),
      )

      /**
       * A push that arrives in the foreground. Firebase hands it to JS and
       * the OS draws nothing, so this is where it becomes visible — for a
       * message, as the in-app banner. In practice this only fires when the
       * socket is down while the app is open, since the server skips the push
       * for anyone holding one; so this and `useSocket` cannot both draw a
       * banner for the same message. The once-a-day kinds are not drawn in the
       * foreground at all: they have no in-app shape, and somebody using the
       * app at that moment sees the badge or the visitor count on the screen
       * it is about.
       */
      unsubscribe.push(
        fm.onMessage(messaging, (remote) => {
          const data = (remote.data ?? {}) as PushData
          if (presentationFor(data, AppState.currentState === 'active') !== 'suppress') return
          const { conversationId, senderId } = data
          if (typeof conversationId !== 'string' || typeof senderId !== 'string') return
          if (getActiveConversation() === conversationId) {
            void markConversationRead(conversationId, queryClient)
            return
          }
          showMessageBanner({
            conversationId,
            senderId,
            preview: previewOf('text'),
            body: remote.notification?.body ?? '',
          })
        }),
      )

      const initial = await fm.getInitialNotification(messaging)
      if (cancelled || !initial) return
      const href = notificationRoute(initial.data)
      // `push`, not `replace`: the tab the app opened on stays underneath, so
      // the back gesture out of the conversation goes somewhere sensible
      // instead of off the end of the stack.
      if (href) router.push(href)
    })()

    return () => {
      cancelled = true
      for (const off of unsubscribe) off()
    }
  }, [enabled, queryClient])
}
