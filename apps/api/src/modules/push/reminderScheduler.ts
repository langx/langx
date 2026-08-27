import { localDayKey } from '@langx/shared'
import type { Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import type { Profile } from '../profiles/profiles'
import type { SchedulerLogger } from '../xp/poolScheduler'
import { streakReminderCandidates, tokensFor, type PushSender } from './devices'

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
 * Sends the "keep your streak" nudge at 20:00 in each user's own timezone.
 *
 * De-duplicated per user per local day by an `_id` of `<userId>:<localDay>`:
 * two ticks land inside the same target hour, and being nagged twice about the
 * same streak is how a notification permission gets revoked. The insert
 * failing on a duplicate key *is* the check — no read-then-write race.
 */
export function startStreakReminderScheduler(
  db: Db,
  sender: PushSender,
  logger: SchedulerLogger,
  options: { intervalMs?: number } = {},
): { stop: () => void } {
  const intervalMs = options.intervalMs ?? REMINDER_INTERVAL_MS
  let running = false

  async function tick(): Promise<void> {
    if (running) return
    running = true
    try {
      const now = new Date()
      const candidates = await streakReminderCandidates(db, now)
      let sent = 0

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

        const tokens = await tokensFor(db, candidate.userId)
        if (tokens.length === 0) continue
        await sender.send({
          to: tokens,
          title: `${candidate.streak} gün! 🔥`,
          body: 'Bugün bir mesaj gönder, serini kaybetme.',
          data: { kind: 'streakReminder' },
        })
        sent++
      }

      if (sent > 0) logger.info({ sent }, 'streak reminders sent')
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
