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
 * centre has no business removing them.
 *
 * There is no notification id in a push to match on, so this matches on the
 * `data` the server sends (`modules/push/devices.ts`). Pure and free of
 * `react-native` so the unit tests can load it.
 */
export type TrayScope = { conversationId: string } | 'inbox'

const INBOX_KINDS: readonly string[] = ['social', 'badgeEarned', 'profileVisits', 'wallet']

export function belongsTo(data: unknown, scope: TrayScope): boolean {
  if (typeof data !== 'object' || data === null) return false
  const { kind, conversationId } = data as { kind?: unknown; conversationId?: unknown }
  if (typeof kind !== 'string') return false
  if (scope === 'inbox') return INBOX_KINDS.includes(kind)
  return kind === 'message' && conversationId === scope.conversationId
}
