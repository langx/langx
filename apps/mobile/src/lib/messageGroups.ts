import type { MessageDto } from '../api/queries'

/**
 * One rendered row of a thread: a message, or the date heading that sits above
 * the oldest message of a day.
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

/**
 * Rows for an `inverted` list, newest first.
 *
 * The heading is emitted *after* the oldest message of its day rather than
 * before the newest: in this order "after" is what the reader sees above it
 * once the list is flipped. Getting it backwards labels every day with the
 * date of the one before.
 */
export function messageRows(items: MessageDto[]): MessageRow[] {
  const rows: MessageRow[] = []

  items.forEach((message, index) => {
    const newer = items[index - 1]
    const older = items[index + 1]
    const day = dayKeyOf(message.createdAt)

    rows.push({
      kind: 'message',
      key: String(message._id),
      message,
      endsGroup: endsGroup(message, newer, day),
    })

    if (!older || dayKeyOf(older.createdAt) !== day) {
      rows.push({ kind: 'day', key: `day:${day}`, day })
    }
  })

  return rows
}

/**
 * "Today", "Yesterday", or the date.
 *
 * Locale is left to the device, as everywhere else that prints a date here —
 * the two named days are the ones worth spelling out, and they are also the
 * only two a reader ever needs to resolve at a glance.
 */
export function dayLabel(day: string, now: Date = new Date()): string {
  if (day === dayKeyOfDate(now)) return 'Today'
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  if (day === dayKeyOfDate(yesterday)) return 'Yesterday'

  const at = new Date(`${day}T00:00:00`)
  if (Number.isNaN(at.getTime())) return day
  const sameYear = at.getFullYear() === now.getFullYear()
  return at.toLocaleDateString(undefined, {
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
