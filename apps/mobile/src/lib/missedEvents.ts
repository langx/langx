import type { QueryClient } from '@tanstack/react-query'

/**
 * What to do about the events the socket was not there to receive.
 *
 * The socket is the only realtime channel, and it has a blind spot. A phone in
 * the background has no JS running and no connection, so a message sent then
 * reaches the server, becomes a push, and never becomes a `message:new` —
 * nothing replays it. On the first iOS device test, tapping that push opened
 * the right thread with the message missing: `chat/[id]` was already mounted
 * as the hidden tab and kept its cached pages.
 *
 * Two signals say "there was a gap": the app coming back from the background,
 * and the socket reconnecting after a drop while the app was open. Both end
 * in `invalidateMissedEvents`. Pure and free of `react-native` so the mobile
 * test setup can load it; the hook passes the states in.
 */

/** RN's `AppStateStatus`, spelled out so this file imports nothing native. */
export type AppStateName = 'active' | 'background' | 'inactive' | 'unknown' | 'extension'

/**
 * Only `background → active`. `inactive → active` is the notification shade
 * or Face ID going away a second later — the socket never dropped, nothing
 * was missed, and on iOS that transition happens far more often.
 */
export function resumedFromBackground(previous: AppStateName, next: AppStateName): boolean {
  return previous === 'background' && next === 'active'
}

/**
 * Prefixes, not keys: the chat list is tabbed, and `messagesAround` sits under
 * `['messages', id]`. `invalidateQueries` refetches only the *active* ones —
 * the mounted chat list and the one thread the hidden tab holds — and marks
 * the rest stale for their next mount. The infinite-query "every loaded page"
 * cost that `useSocket` refuses to pay per message is paid once per gap here.
 *
 * `['unread']` is the third, and leaving it out is what made the app show
 * three different unread counts at once. It sits outside the `['conversations']`
 * prefix deliberately (`api/queries` says why — the socket's page-walking
 * patcher would choke on a bare number), so nothing here reached it, and the
 * only things that invalidate it are socket events. A message that arrives
 * while the phone is in the background is precisely *not* a socket event: it
 * is a push. So the row refetched and read 5, the tab badge kept the 1 it had
 * from the last `message:new`, and the icon kept whatever the push wrote.
 * Same gap, same resync.
 *
 * The literals rather than `keys` from `api/queries`: that module reaches the
 * API client, which the test setup cannot load.
 */
export async function invalidateMissedEvents(queryClient: QueryClient): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['conversations'] }),
    queryClient.invalidateQueries({ queryKey: ['messages'] }),
    queryClient.invalidateQueries({ queryKey: ['unread'] }),
  ])
}
