import { localDayKey } from '@langx/shared'
import type { Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import { sendNotificationEmail, type NotificationEmailContext } from '../../email/notify'
import { streakReminderEmail } from '../../email/templates'
import type { Profile } from '../profiles/profiles'
import type { SchedulerLogger } from '../tokens/poolScheduler'
import { sendPush, streakReminderCandidates, tokensByLocale, type PushSender } from './devices'
import { translator } from '../../i18n'

/**
 * Every 30 minutes. The reminder fires on a whole local hour, and every IANA
 * offset is a whole or half hour, so a half-hourly tick catches all of them
 * while checking each user at most twice within their target hour.
 */
export const REMINDER_INTERVAL_MS = 30 * 60 * 1000

export interface ReminderLedgerEntry {
  _id: string
  sentOn: Date
}

/**
 * One pass of the "keep your streak" nudge, at 20:00 in each user's own
 * timezone.
 *
 * De-duplicated per user per local day by an `_id` of `<userId>:<localDay>`:
 * two ticks land inside the same target hour, and being nagged twice about the
 * same streak is how a notification permission gets revoked. The insert
 * failing on a duplicate key *is* the check — no read-then-write race.
 *
 * Split from the timer around it so a test can drive one pass at a chosen
 * `now`, the way `runDailyPool` is driven; the scheduler below is then only a
 * clock.
 *
 * A phone gets the push. Somebody with none — the whole web audience, and
 * anyone who declined the permission — gets the same words as an email, in the
 * *same iteration*, because the ledger insert above has already claimed the
 * day for them. A second pass would need either a second ledger or a re-read
 * of this one, and both put back the read-then-write race the `_id` insert was
 * chosen to avoid.
 */
export async function runStreakReminderTick(
  db: Db,
  sender: PushSender,
  email: NotificationEmailContext,
  now: Date = new Date(),
): Promise<{ pushed: number; emailed: number }> {
  const candidates = await streakReminderCandidates(db, now)
  let pushed = 0
  let emailed = 0

  for (const candidate of candidates) {
    const profile = await db
      .collection<Profile>(COLLECTIONS.profiles)
      .findOne({ _id: candidate.userId }, { projection: { timezone: 1 } })
    const day = localDayKey(now, profile?.timezone ?? 'UTC')

    try {
      await db
        .collection<ReminderLedgerEntry>(COLLECTIONS.streakReminders)
        .insertOne({ _id: `${candidate.userId}:${day}`, sentOn: now })
    } catch {
      continue // already nudged today
    }

    const byLocale = candidate.push
      ? await tokensByLocale(db, candidate.userId)
      : new Map<never, never>()
    if (byLocale.size > 0) {
      for (const [locale, tokens] of byLocale) {
        const t = translator(locale)
        await sendPush(db, sender, {
          to: tokens,
          title: t('push.streakTitle', { count: candidate.streak }),
          body: t('push.streakBody'),
          data: { kind: 'streakReminder' },
        })
      }
      pushed++
      continue
    }

    // Not a second notification, a fallback for the one that had nowhere to
    // go. Somebody holding both a phone and an inbox gets exactly one nudge.
    if (!candidate.email) continue
    const outcome = await sendNotificationEmail(db, email, {
      userId: candidate.userId,
      type: 'streak',
      build: (locale, unsubscribe) =>
        streakReminderEmail(locale, { count: candidate.streak, unsubscribe }),
    })
    if (outcome === 'sent') emailed++
  }

  return { pushed, emailed }
}

export function startStreakReminderScheduler(
  db: Db,
  sender: PushSender,
  email: NotificationEmailContext,
  logger: SchedulerLogger,
  options: { intervalMs?: number } = {},
): { stop: () => void } {
  const intervalMs = options.intervalMs ?? REMINDER_INTERVAL_MS
  let running = false

  async function tick(): Promise<void> {
    if (running) return
    running = true
    try {
      const { pushed, emailed } = await runStreakReminderTick(db, sender, email, new Date())
      if (pushed > 0 || emailed > 0) logger.info({ pushed, emailed }, 'streak reminders sent')
    } catch (error) {
      logger.error({ err: error }, 'streak reminder run failed')
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
