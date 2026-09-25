import { SECURITY_PUSH_TRAY_MS, type InAppNotification } from '@langx/shared'

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
 * centre: the pushes that announced what that row stands for. `'wallet'` is
 * the wallet screen opened: the pool, the gift and a bounty's tokens are all
 * drawn there.
 *
 * There is no notification id in a push to match on, so this matches on the
 * `data` the server sends (`modules/push/devices.ts`). Pure and free of
 * `react-native` so the unit tests can load it.
 */
export type TrayScope =
  | { conversationId: string }
  | 'inbox'
  | 'wallet'
  | { row: Pick<InAppNotification, 'kind' | 'postId' | 'actor'> }

const INBOX_KINDS: readonly string[] = ['social', 'badgeEarned', 'profileVisits', 'wallet']
const WALLET_KINDS: readonly string[] = ['wallet', 'bountyPaid']

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
  if (scope === 'wallet') return WALLET_KINDS.includes(kind)
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

/**
 * What the server says has been dealt with, asked for when the app opens.
 *
 * The scopes above clear the shade at the moment something is read, on this
 * device. Anything dealt with while this app had no way to clear it — on
 * another device while this one was asleep, or by a push that landed after
 * the read — never reached it. So each time the app comes to the front it
 * asks, and removes what the answers say is finished.
 */
export interface TrayFacts {
  /** Threads with nothing unread for this reader, or no longer there. */
  readThreads: ReadonlySet<string>
  /** Nothing unread in the notification centre. */
  inboxRead: boolean
}

/**
 * The kinds settled against the centre's unread count.
 *
 * Not `wallet`: the gift-ready push has no row, and a centre with nothing
 * unread says nothing about whether the gift was opened. The wallet screen
 * clears those instead.
 */
const CENTRE_KINDS: readonly string[] = ['social', 'badgeEarned', 'profileVisits']

function fieldsOf(data: unknown): { kind?: unknown; conversationId?: unknown } {
  return typeof data === 'object' && data !== null ? data : {}
}

/**
 * What to ask before sweeping, so an empty shade, or one holding only
 * reminders, costs no request.
 */
export function questionsFor(data: readonly unknown[]): { threads: string[]; inbox: boolean } {
  const threads = new Set<string>()
  let inbox = false
  for (const item of data) {
    const { kind, conversationId } = fieldsOf(item)
    if (kind === 'message' && typeof conversationId === 'string') threads.add(conversationId)
    if (typeof kind === 'string' && CENTRE_KINDS.includes(kind)) inbox = true
  }
  return { threads: [...threads], inbox }
}

/**
 * Whether a notification still in the shade is finished with.
 *
 * Everything not named here stays: a reminder is about a time or a habit,
 * not about something the server can call read, and clearing a notification
 * nobody has dealt with is the worse mistake.
 */
export function staleOnOpen(
  data: unknown,
  deliveredAt: number,
  facts: TrayFacts,
  now: number,
): boolean {
  const { kind, conversationId } = fieldsOf(data)
  if (kind === 'message') {
    return typeof conversationId === 'string' && facts.readThreads.has(conversationId)
  }
  if (kind === 'security') return now - deliveredAt >= SECURITY_PUSH_TRAY_MS
  return typeof kind === 'string' && CENTRE_KINDS.includes(kind) && facts.inboxRead
}

/**
 * A presented notification's `date`, in milliseconds on both platforms.
 *
 * `expo-notifications` hands it over unconverted: Android's is milliseconds,
 * iOS's is `timeIntervalSince1970`, which is seconds. Read as milliseconds, a
 * sign-in from this morning is a few weeks into 1970 and every age check
 * passes at once. Nothing measured in seconds reaches 1e11 before the year
 * 5000, and nothing in milliseconds is below it after 1973.
 */
export function deliveredAtMs(date: number): number {
  return date < 1e11 ? date * 1000 : date
}
