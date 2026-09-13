import type { Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import { withJobHealth } from '../admin/jobHealth'
import { notificationsAllowed } from '@langx/shared'
import type { Conversation, Message } from '../chat/conversations'
import type { Profile } from '../profiles/profiles'
import type { SchedulerLogger } from '../tokens/poolScheduler'
import { sendPush, tokensByLocale, type PushSender } from './devices'
import { translator } from '../../i18n'

/**
 * How long before a meeting the reminder fires, and how wide the window is.
 *
 * An hour is enough to finish what you are doing and be somewhere quiet; ten
 * minutes is not, and a day is forgotten again by the time it matters.
 *
 * The window has to be at least as wide as the tick that scans it or a meeting
 * falls between two passes and is never reminded. It is *only* as wide as it
 * needs to be, because everything inside it is sent at once: a meeting found
 * seventy minutes out is buzzed seventy minutes out, not at sixty.
 */
export const MEETING_REMINDER_LEAD_MS = 60 * 60 * 1000
export const MEETING_REMINDER_INTERVAL_MS = 5 * 60 * 1000

export interface MeetingReminderLedgerEntry {
  _id: string
  sentOn: Date
}

/**
 * One pass of "you have a call in an hour".
 *
 * Only `accepted` meetings, and only ever once each: a proposal nobody
 * answered is not a commitment, a withdrawn one is not either, and the ledger
 * insert failing on a duplicate key *is* the guard — no read-then-write race
 * between two ticks landing in the same window.
 *
 * **Both people, one message.** The proposer is as likely to have forgotten as
 * the invitee, and a reminder that only reaches one of them is the half that
 * turns up. Each side is checked against their own notification switch.
 *
 * Push only. `meetings` defaults to email off for the reason in
 * `DEFAULT_NOTIFICATION_PREFS`: an email an hour before a call is either too
 * late to read or a duplicate of the push that already worked.
 *
 * Split from the timer so a test can drive one pass at a chosen `now`, the way
 * `runStreakReminderTick` is driven.
 */
export async function runMeetingReminderTick(
  db: Db,
  sender: PushSender,
  now: Date = new Date(),
): Promise<{ pushed: number }> {
  const from = new Date(now.getTime() + MEETING_REMINDER_LEAD_MS)
  const to = new Date(from.getTime() + MEETING_REMINDER_INTERVAL_MS)

  const due = await db
    .collection<Message>(COLLECTIONS.messages)
    .find({
      type: 'meeting',
      'meeting.status': 'accepted',
      'meeting.startsAt': { $gte: from, $lt: to },
      deletedAt: { $exists: false },
    })
    .toArray()

  let pushed = 0
  for (const message of due) {
    try {
      await db
        .collection<MeetingReminderLedgerEntry>(COLLECTIONS.meetingReminders)
        .insertOne({ _id: message._id.toHexString(), sentOn: now })
    } catch {
      continue // already reminded
    }

    const conversation = await db
      .collection<Conversation>(COLLECTIONS.conversations)
      .findOne({ _id: message.conversationId })
    if (!conversation) continue

    for (const userId of conversation.participants) {
      const profile = await db
        .collection<Profile>(COLLECTIONS.profiles)
        .findOne({ _id: userId }, { projection: { settings: 1 } })
      if (!profile) continue
      if (!notificationsAllowed(profile.settings?.notifications, 'meetings', 'push')) continue

      for (const [locale, tokens] of await tokensByLocale(db, userId)) {
        const t = translator(locale)
        await sendPush(db, sender, {
          to: tokens,
          title: t('push.meetingTitle'),
          body: t('push.meetingBody'),
          // The thread it was agreed in, so the tap lands somewhere useful.
          data: { kind: 'meetingReminder', conversationId: message.conversationId.toHexString() },
        })
        pushed++
      }
    }
  }

  return { pushed }
}

export function startMeetingReminderScheduler(
  db: Db,
  sender: PushSender,
  logger: SchedulerLogger,
  options: { intervalMs?: number } = {},
): { stop: () => void } {
  const intervalMs = options.intervalMs ?? MEETING_REMINDER_INTERVAL_MS
  let running = false

  async function tick(): Promise<void> {
    if (running) return
    running = true
    try {
      const { pushed } = await withJobHealth(db, 'meeting reminder', () =>
        runMeetingReminderTick(db, sender, new Date()),
      )
      if (pushed > 0) logger.info({ pushed }, 'meeting reminders sent')
    } catch (error) {
      logger.error({ err: error }, 'meeting reminder run failed')
    } finally {
      running = false
    }
  }

  void tick()
  const timer = setInterval(() => void tick(), intervalMs)
  timer.unref?.()
  return {
    stop: () => {
      clearInterval(timer)
    },
  }
}
