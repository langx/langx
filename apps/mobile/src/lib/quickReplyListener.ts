import { Platform } from 'react-native'
import { api } from '../api/client'
import { clearFromTray } from './notifications'
import { quickReplyFrom, type QuickReply } from './quickReply'

/**
 * Sends what somebody typed into a message notification's Reply box.
 *
 * Module scope, imported by `index.ts`, for the reason `traySyncTask.ts` is.
 * This used to live in `useNotificationRouting`, inside the signed-in layout,
 * and never sent anything when the app had been closed: iOS launches the app
 * in the background to run the action and hands the response over before any
 * JavaScript exists, so the event reaches no listener and survives only as
 * the "last notification response" — which the hook read as a tap, pushing
 * the thread onto a screen nobody could see and dropping the text. Even read
 * correctly, the hook could not start until fonts, the session round-trip and
 * the layout had all come up, and iOS does not keep a background launch
 * alive that long: `expo-notifications` completes the action as soon as it
 * has passed it on. Here it starts as soon as the bundle has run.
 *
 * The REST twin, not the socket, and the same route and guards as the watch
 * reply. No query client either: there may be no React tree, and the resync
 * `useSocket` runs when the app next comes forward covers the caches.
 *
 * A failure is silent. There is no screen to show it on, and a banner for an
 * app nobody is looking at helps nobody; the person finds the thread as it
 * really is when they open the app.
 */
async function send(reply: QuickReply): Promise<void> {
  try {
    await api.post(`/conversations/${reply.conversationId}/messages`, {
      body: reply.body,
      clientId: reply.clientId,
    })
    // Answering is reading, as it is in the thread: without this the server
    // still counts the message unread, and the icon and the thread's other
    // pushes in the shade stay over a conversation already answered.
    await api.post(`/conversations/${reply.conversationId}/read`)
    await clearFromTray({ conversationId: reply.conversationId })
  } catch {
    // See above.
  }
}

if (Platform.OS !== 'web') {
  void (async () => {
    try {
      // Lazily, for the Expo Go reason in docs/decisions.md.
      const Notifications = await import('expo-notifications')
      const handle = (response: unknown): void => {
        const reply = quickReplyFrom(response)
        if (!reply) return
        /*
         * Forgotten as soon as it is taken, so the next JavaScript start in
         * this process (an update applying) does not read it again. Only if
         * it is still the reply: a tap that has since replaced it belongs to
         * `useNotificationRouting`. A second read would be harmless anyway —
         * see `quickReplyFrom` on the id — but it would mark the thread read
         * again, over messages that arrived since.
         */
        const last = Notifications.getLastNotificationResponse()
        if (quickReplyFrom(last)?.clientId === reply.clientId) {
          Notifications.clearLastNotificationResponse()
        }
        void send(reply)
      }
      // The listener first, then the stored response: one arriving between
      // the two is seen twice rather than not at all, and the id makes twice
      // the same as once.
      Notifications.addNotificationResponseReceivedListener(handle)
      handle(Notifications.getLastNotificationResponse())
    } catch {
      // No notifications module here, so no replies to send.
    }
  })()
}
