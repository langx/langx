import { PUSH_ACTION_REPLY, PUSH_KINDS, type PushKind } from '@langx/shared'
import { useQueryClient } from '@tanstack/react-query'
import { router } from 'expo-router'
import { useEffect } from 'react'
import { AppState, Platform } from 'react-native'
import { markConversationRead, trayFacts } from '../api/queries'
import { track } from '../lib/analytics'
import { getActiveConversation } from '../lib/activeConversation'
import { presentationFor } from '../lib/foregroundPush'
import { previewOf, showMessageBanner } from '../lib/inAppNotifications'
import { invalidateMissedEvents, resumedFromBackground } from '../lib/missedEvents'
import { configureNotifications, sweepTray } from '../lib/notifications'
import { notificationRoute } from '../lib/notificationRoute'

/**
 * What the payload called itself, for the analytics event only.
 *
 * Not `notificationRoute`'s business: that one answers "where does this go",
 * and two kinds that route to the same screen are the same answer to it and
 * different answers to "what brought them back". Anything unrecognised counts
 * as `unknown` rather than being dropped — a kind the app has not learned yet
 * is exactly the thing worth seeing in the list.
 */
function openedKind(data: unknown): PushKind | 'unknown' {
  const kind = (data as { kind?: unknown } | null)?.kind
  return PUSH_KINDS.includes(kind as PushKind) ? (kind as PushKind) : 'unknown'
}

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
export function useNotificationRouting({ enabled = true }: { enabled?: boolean } = {}): void {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!enabled) return
    if (Platform.OS === 'web') return
    let cancelled = false
    let subscription: { remove: () => void } | undefined
    let received: { remove: () => void } | undefined

    // The shade catches up whenever the app does: see `useSocket`'s resync,
    // which answers the same "what happened while I was away" for the caches.
    let lastAppState = AppState.currentState
    const appState = AppState.addEventListener('change', (next) => {
      if (resumedFromBackground(lastAppState, next)) void sweepTray(trayFacts)
      lastAppState = next
    })

    void (async () => {
      await configureNotifications()
      // A cold start is a return too, and the usual one.
      void sweepTray(trayFacts)
      try {
        const Notifications = await import('expo-notifications')
        if (cancelled) return

        subscription = Notifications.addNotificationResponseReceivedListener((response) => {
          const data = response.notification.request.content.data

          /*
           * Answered from the shade rather than opened, and sent by
           * `quickReplyListener.ts`, which exists before this hook can.
           *
           * Not an open either: the app was not brought forward, nothing was
           * read, and counting it as a notification_opened would make the
           * number mean two different things. It returns instead of falling
           * through — `notificationRoute` would push the thread behind a
           * notification the person deliberately did not tap.
           */
          if (response.actionIdentifier === PUSH_ACTION_REPLY) return

          track({
            name: 'notification_opened',
            properties: { kind: openedKind(data), cold_start: false },
          })
          const href = notificationRoute(data)
          if (href) router.push(href)
        })

        /**
         * The other half of suppressing the OS banner: something has to draw
         * the message instead. Only reached when the socket is down while the
         * app is open, since the server skips the push entirely for anyone
         * holding one — so this and `useSocket` cannot both fire for the same
         * message.
         */
        received = Notifications.addNotificationReceivedListener((notification) => {
          const { content } = notification.request
          if (presentationFor(content.data, AppState.currentState === 'active') !== 'suppress') {
            return
          }
          /*
           * And the caches, because this push *is* the gap.
           *
           * It only arrives when the socket was down while the app was open,
           * so no `message:new` ever landed: the chat list, the open thread
           * and the unread total all still hold what they held before the
           * message existed. The icon does not: the OS applies the push's own
           * `badge`, which is the server's count. That is how an icon reading
           * eighteen sits over a Chats tab reading three, with nothing left
           * to make either of them refetch — the resyncs `useSocket` owns are
           * a reconnect and a return from the background, and a push landing
           * on an app that is already open and stays open is neither.
           */
          void invalidateMissedEvents(queryClient)

          const { conversationId, senderId } = content.data as {
            conversationId?: unknown
            senderId?: unknown
          }
          if (typeof conversationId !== 'string' || typeof senderId !== 'string') return
          if (getActiveConversation() === conversationId) {
            void markConversationRead(conversationId, queryClient)
            return
          }
          showMessageBanner({
            conversationId,
            senderId,
            preview: previewOf('text'),
            body: content.body ?? '',
          })
        })

        const initial = await Notifications.getLastNotificationResponseAsync()
        // A reply that launched the app in the background is not a tap either,
        // for the reason above — reading it as one is how a reply to a closed
        // app used to open a thread nobody could see and send nothing.
        if (cancelled || !initial || initial.actionIdentifier === PUSH_ACTION_REPLY) return
        const data = initial.notification.request.content.data
        // The tap that launched the app, rather than one it was already
        // running for. Different amounts of interruption, so they are counted
        // apart rather than summed.
        track({
          name: 'notification_opened',
          properties: { kind: openedKind(data), cold_start: true },
        })
        const href = notificationRoute(data)
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
      appState.remove()
      subscription?.remove()
      received?.remove()
    }
  }, [enabled, queryClient])
}
