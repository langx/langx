import { localDayKey, type Locale } from '@langx/shared'
import type { Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import { streakReminderSection } from '../../email/templates'
import type { DigestCandidate } from '../notifications/digest'
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
 * **Push only since the daily digest.** Somebody with no phone signed in — the
 * whole web audience, and anyone who declined the permission — is nudged an
 * hour earlier instead, as a section of the evening mail; see
 * `streakSectionFor` below. The day is claimed in the same ledger either way,
 * so nobody is nudged twice and the ordering between the two hours settles
 * itself.
 */
export async function runStreakReminderTick(
  db: Db,
  sender: PushSender,
  now: Date = new Date(),
): Promise<{ pushed: number }> {
  const candidates = await streakReminderCandidates(db, now)
  let pushed = 0

  for (const candidate of candidates) {
    if (!candidate.push) continue
    const byLocale = await tokensByLocale(db, candidate.userId)
    if (byLocale.size === 0) continue

    const profile = await db
      .collection<Profile>(COLLECTIONS.profiles)
      .findOne({ _id: candidate.userId }, { projection: { timezone: 1 } })
    const day = localDayKey(now, profile?.timezone ?? 'UTC')
    if (!(await claimStreakDay(db, candidate.userId, day, now))) continue

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
  }

  return { pushed }
}

/**
 * The same nudge for somebody the push cannot reach, an hour earlier, inside
 * the evening mail.
 *
 * Only for an account with no phone signed in. Somebody holding both a phone
 * and an inbox still gets exactly one nudge, which is the rule this had before
 * the digest existed — it has only changed which of the two arrives first.
 *
 * The cost of the earlier hour is named rather than hidden: 19:00 is before
 * 20:00, so a person who practises at half past seven is told at seven that
 * they have not. The alternative was a second envelope at eight, which is the
 * thing this whole change exists to stop.
 */
export function streakSectionFor(
  db: Db,
  profile: Profile,
  now: Date,
  hasPushDevice: boolean,
): DigestCandidate | null {
  if (hasPushDevice) return null
  const streak = profile.streak?.current ?? 0
  if (streak < 1) return null

  const day = localDayKey(now, profile.timezone ?? 'UTC')
  // Already practised today: there is nothing to save.
  if (profile.streak?.lastQualifiedDay === day) return null

  return {
    trigger: true,
    claim: () => claimStreakDay(db, profile._id, day, now),
    build: (locale: Locale) => streakReminderSection(locale, { count: streak }),
  }
}

/**
 * One nudge per person per local day, whichever hour and channel gets there
 * first. The insert failing on a duplicate `_id` *is* the check — a read
 * followed by a write has a gap, and two ticks landing in it is somebody
 * nagged twice about the same streak.
 */
async function claimStreakDay(db: Db, userId: string, day: string, now: Date): Promise<boolean> {
  try {
    await db
      .collection<ReminderLedgerEntry>(COLLECTIONS.streakReminders)
      .insertOne({ _id: `${userId}:${day}`, sentOn: now })
    return true
  } catch {
    return false
  }
}

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
      const { pushed } = await runStreakReminderTick(db, sender, new Date())
      if (pushed > 0) logger.info({ pushed }, 'streak reminders sent')
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
