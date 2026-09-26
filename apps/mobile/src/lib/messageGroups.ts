import type { Locale } from '@langx/shared'
import type { MessageDto } from '../api/queries'
import type { TranslateFn } from '../i18n/runtime'

/**
 * One rendered row of a thread: a message, the date heading that sits above
 * the oldest message of a day, or the "New messages" line above the first one
 * the reader had not seen.
 */
export type MessageRow =
  | {
      kind: 'message'
      key: string
      message: MessageDto
      /**
       * True when nothing newer from the same sender follows on the same day,
       * so this bubble is the one that carries the tail corner. A run of five
       * messages reads as one turn in the conversation with a single tail, the
       * way it does everywhere else.
       */
      endsGroup: boolean
    }
  | { kind: 'day'; key: string; day: string }
  | { kind: 'unread'; key: string }

/**
 * Where the thread stood when the reader opened it: how many of the other
 * person's messages were unread, counted up to the newest message at that
 * moment. Both halves come from the read itself — see `markConversationRead`.
 */
export interface UnreadMark {
  count: number
  /** The newest message's `createdAt` when the count was taken. */
  until: string
  /** The reader. Their own messages are never unread. */
  viewerId: string
}

/**
 * Rows for an `inverted` list, newest first.
 *
 * The heading is emitted *after* the oldest message of its day rather than
 * before the newest: in this order "after" is what the reader sees above it
 * once the list is flipped. Getting it backwards labels every day with the
 * date of the one before. The unread line follows the same rule, and goes
 * between its message and that message's heading: the date, then the line,
 * then what is new.
 */
export function messageRows(items: MessageDto[], unread?: UnreadMark): MessageRow[] {
  const rows: MessageRow[] = []
  const firstUnread = unread ? firstUnreadId(items, unread) : null

  items.forEach((message, index) => {
    const newer = items[index - 1]
    const older = items[index + 1]
    const day = dayKeyOf(message.createdAt)

    rows.push({
      kind: 'message',
      key: String(message._id),
      message,
      // The line breaks a run the way a heading does: the bubble under it
      // would otherwise be the tailless middle of a turn with nothing below.
      endsGroup:
        endsGroup(message, newer, day) ||
        (newer !== undefined && String(newer._id) === firstUnread),
    })

    if (String(message._id) === firstUnread) rows.push({ kind: 'unread', key: 'unread' })

    if (!older || dayKeyOf(older.createdAt) !== day) {
      rows.push({ kind: 'day', key: `day:${day}`, day })
    }
  })

  return rows
}

/**
 * The oldest of the `count` newest messages from the other person, or null
 * when there is no honest place for the line.
 *
 * Counted from `until` backwards rather than from the newest item, so the line
 * stays put for the whole visit: a message arriving while the thread is open is
 * read as it lands, and counting from the top would walk the line down one row
 * for each. A reply is newer than `until` too, so answering leaves the line
 * where it was — it marks where the unread run began when the reader arrived,
 * and replying does not change that.
 */
function firstUnreadId(items: MessageDto[], { count, until, viewerId }: UnreadMark): string | null {
  const cutoff = Date.parse(until)
  if (count <= 0 || Number.isNaN(cutoff)) return null
  /*
   * Nothing as new as the count is a thread from before the read: a cold start
   * from a push restores the cache as it was last seen, and counting in that
   * would put the line above messages read days ago for a round trip.
   */
  if (!items.some((message) => Date.parse(message.createdAt) >= cutoff)) return null

  let seen = 0
  for (const message of items) {
    if (Date.parse(message.createdAt) > cutoff) continue
    if (message.senderId === viewerId) continue
    // Withdrawn while unread, which took it off the count (`applyDeleteSideEffects`),
    // but the tombstone stays in the thread.
    if (message.deleted) continue
    seen += 1
    if (seen === count) return String(message._id)
  }
  // Further back than what is loaded. It appears in its place once the reader
  // scrolls far enough for that page to arrive.
  return null
}

export interface DayLabelOptions {
  t: TranslateFn
  locale: Locale
  now?: Date
}

/**
 * "Today", "Yesterday", or the date.
 *
 * Takes the app's locale rather than leaving `toLocaleDateString` to guess:
 * the two are usually the same, but a reader who has picked a language in
 * Settings that differs from their phone's would otherwise get a date heading
 * in one language above messages in another.
 *
 * The two named days are the ones worth spelling out, and they are also the
 * only two a reader ever needs to resolve at a glance.
 */
export function dayLabel(day: string, { t, locale, now = new Date() }: DayLabelOptions): string {
  if (day === dayKeyOfDate(now)) return t('day.today')
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  if (day === dayKeyOfDate(yesterday)) return t('day.yesterday')

  const at = new Date(`${day}T00:00:00`)
  if (Number.isNaN(at.getTime())) return day
  const sameYear = at.getFullYear() === now.getFullYear()
  return at.toLocaleDateString(locale, {
    day: 'numeric',
    month: 'long',
    ...(sameYear ? {} : { year: 'numeric' }),
  })
}

/**
 * The device's day, not UTC's. A message sent at 00:30 belongs under today's
 * heading for the person reading it, which is the only reader this grouping
 * has — unlike the streak, nothing is being awarded here.
 */
function dayKeyOf(iso: string): string {
  const at = new Date(iso)
  return Number.isNaN(at.getTime()) ? '' : dayKeyOfDate(at)
}

function dayKeyOfDate(at: Date): string {
  const month = String(at.getMonth() + 1).padStart(2, '0')
  const date = String(at.getDate()).padStart(2, '0')
  return `${at.getFullYear()}-${month}-${date}`
}

/**
 * A correction is a full-width card with its own frame, so it neither joins a
 * run nor lets one continue through it.
 */
function endsGroup(message: MessageDto, newer: MessageDto | undefined, day: string): boolean {
  if (message.type === 'correction') return true
  if (!newer || newer.type === 'correction') return true
  if (newer.senderId !== message.senderId) return true
  return dayKeyOf(newer.createdAt) !== day
}
