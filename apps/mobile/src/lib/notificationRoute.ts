import { PUSH_KINDS, type PushKind } from '@langx/shared'

/**
 * Where tapping a notification should land.
 *
 * Separated from the effect that navigates so it can be tested: the payload
 * comes off the wire and is therefore whatever the server sent, or whatever
 * an older build of the server sent, or nothing at all. Returning `null` for
 * anything unrecognised is what keeps a future notification kind from throwing
 * inside a launch path — the app opens where it would have anyway.
 */
export function notificationRoute(data: unknown): string | null {
  if (typeof data !== 'object' || data === null) return null
  const { kind, conversationId } = data as { kind?: unknown; conversationId?: unknown }
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
  }
}
