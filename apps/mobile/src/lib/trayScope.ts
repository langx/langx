import type { InAppNotification } from '@langx/shared'

/**
 * Which notifications in the OS shade a read has made stale.
 *
 * The shade keeps whatever the OS drew until somebody swipes it away, and the
 * app reading a thing does not tell it otherwise — so a message read in the
 * app at night was still on the lock screen in the morning, announcing
 * something already answered. Reading now clears what it read.
 *
 * `{ conversationId }` is a thread just read: its message pushes go, and
 * nothing else, not even a meeting reminder for the same conversation, which
 * is about a time rather than a message. `'inbox'` is "Mark all read" in the
 * notification centre: every kind that has a row there. `security`,
 * `billing`, streak and Echo reminders have none, and a button about the
 * centre has no business removing them. `{ row }` is one row tapped in the
 * centre: the pushes that announced what that row stands for.
 *
 * There is no notification id in a push to match on, so this matches on the
 * `data` the server sends (`modules/push/devices.ts`). Pure and free of
 * `react-native` so the unit tests can load it.
 */
export type TrayScope =
  | { conversationId: string }
  | 'inbox'
  | { row: Pick<InAppNotification, 'kind' | 'postId' | 'actor'> }

const INBOX_KINDS: readonly string[] = ['social', 'badgeEarned', 'profileVisits', 'wallet']

export function belongsTo(data: unknown, scope: TrayScope): boolean {
  if (typeof data !== 'object' || data === null) return false
  const { kind, conversationId, postId, handle } = data as {
    kind?: unknown
    conversationId?: unknown
    postId?: unknown
    handle?: unknown
  }
  if (typeof kind !== 'string') return false
  if (scope === 'inbox') return INBOX_KINDS.includes(kind)
  if ('conversationId' in scope) {
    return kind === 'message' && conversationId === scope.conversationId
  }

  const { row } = scope
  switch (row.kind) {
    // A follow push names the follower, and nothing else identifies it.
    case 'follow':
      return kind === 'social' && row.actor !== undefined && handle === row.actor.handle
    /*
     The rest of the social rows are about a post, and so are their pushes —
     but a push does not say whether it was a like or a comment. Every push
     about the post goes: the tap opens the post, which shows all of it.
    */
    case 'postComment':
    case 'postCorrection':
    case 'pronunciationAnswer':
    case 'like':
      return kind === 'social' && row.postId !== undefined && postId === row.postId
    // These repeat, one row for the lot, and the tap reads the lot.
    case 'badgeEarned':
      return kind === 'badgeEarned'
    case 'profileVisits':
      return kind === 'profileVisits'
    case 'walletPool':
      return kind === 'wallet'
  }
}
