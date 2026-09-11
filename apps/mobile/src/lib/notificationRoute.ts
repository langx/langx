import { PUSH_KINDS, type PushKind } from '@langx/shared'
import type { Href } from 'expo-router'

/**
 * Where tapping a notification should land.
 *
 * Separated from the effect that navigates so it can be tested: the payload
 * comes off the wire and is therefore whatever the server sent, or whatever
 * an older build of the server sent, or nothing at all. Returning `null` for
 * anything unrecognised is what keeps a future notification kind from throwing
 * inside a launch path — the app opens where it would have anyway.
 *
 * `Href` is imported as a type only. Typed routes make `router.push` reject
 * a plain string, and this is the value it gets — but a value import of
 * `expo-router` would pull native modules into a file the unit tests load
 * directly, and vitest cannot parse those.
 */
export function notificationRoute(data: unknown): Href | null {
  if (typeof data !== 'object' || data === null) return null
  const { kind, conversationId, postId, handle } = data as {
    kind?: unknown
    conversationId?: unknown
    postId?: unknown
    handle?: unknown
  }
  if (typeof kind !== 'string' || !(PUSH_KINDS as readonly string[]).includes(kind)) return null

  switch (kind as PushKind) {
    case 'message':
      // No conversation id means we cannot open the conversation, and dropping
      // someone into the list is better than into an empty chat screen.
      return typeof conversationId === 'string' && conversationId.length > 0
        ? `/chat/${conversationId}`
        : '/chats'
    case 'streakReminder':
      // The nudge asks for one message, so the useful destination is the list
      // of people already being talked to, not the feed of strangers.
      return '/chats'
    case 'badgeEarned':
      // The badges live on your own profile, which is what `me` is.
      return '/me'
    case 'meetingReminder':
      // Straight into the thread it was agreed in — the card is there, and so
      // is the person. Without an id the list is the honest fallback, the same
      // as a message with none.
      return typeof conversationId === 'string' && conversationId.length > 0
        ? `/chat/${conversationId}`
        : '/chats'
    case 'bountyPaid':
      // Tokens landed, so the screen that shows them is the answer — the
      // wallet, not the report they were paid for, which nothing here can open.
      return '/wallet'
    case 'profileVisits':
      // The count is what the notification said; the names are behind the
      // paywall this screen draws. Landing here is the whole point of it.
      return '/viewers'
    case 'social':
      // A correction or an answer lands on the post it is about; a follow on
      // the person who did it. Neither id is guaranteed — a batch of likes
      // carries a post, a follow carries a handle.
      if (typeof postId === 'string' && postId.length > 0) return `/post/${postId}`
      if (typeof handle === 'string' && handle.length > 0) return `/${handle}`
      // Neither survived, so the push cannot name what it is about — but the
      // notification centre can, because the row it came from is the first
      // thing in it. The feed used to be the fallback, which was the right
      // room and the wrong screen: nothing in it mentions the thing notified.
      return '/notifications'
    case 'wallet':
      // Tokens arrived. The wallet is where they are counted.
      return '/wallet'
    case 'promotion':
      // Every nudge that is not about the streak points at the same place:
      // people to talk to. The mail carries the specific destination; a push
      // that lands days later should not.
      return '/discover'
    case 'billing':
      // A failed payment and an ended plan are both fixed in one place.
      return '/settings/plan'
    case 'security':
      // "Somebody signed in as you" has one useful next step, and it is the
      // screen that changes the password — which signs every other device out.
      return '/settings/password'
  }
}
