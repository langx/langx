import {
  STREAK_REMINDER_LOCAL_HOUR,
  STREAK_REPAIR_NUDGE_MIN_STREAK,
  TOKEN_RULES,
  localDayKey,
  notificationsAllowed,
  shiftDayKey,
  streakBrokeYesterday,
  utcDayKey,
} from '@langx/shared'
import type { Db } from 'mongodb'
import { translator } from '../../i18n'
import { profilesInLocalHour } from '../profiles/localHour'
import type { Profile } from '../profiles/profiles'
import { sendPush, tokensByLocale, type PushSender } from '../push/devices'
import { readAggregates } from '../tokens/ledger'
import { repairsInMonth } from '../tokens/streakDays'
import { claimOnce } from './ledger'

/**
 * The day a repair would fill in for this person tonight, or `null` when
 * there is nothing worth offering.
 *
 * Shared by the push below and the repair mail in `promotions.ts`, so the two
 * channels cannot disagree about whose streak broke.
 *
 * "Broke yesterday" is not the whole question. A repair has a monthly cap and
 * a price, and an offer that ends on "you have used both" or "not enough
 * tokens" is a sentence about a loss with nothing to do about it. So both are
 * asked here, before anything is said — the store would ask them one tap
 * later anyway.
 */
export async function streakRepairDay(db: Db, profile: Profile, now: Date): Promise<string | null> {
  const streak = profile.streak
  if (!streak || streak.current < STREAK_REPAIR_NUDGE_MIN_STREAK) return null
  const today = localDayKey(now, profile.timezone ?? 'UTC')
  if (!streakBrokeYesterday(streak, profile.streakFreezes ?? 0, today)) return null

  const day = shiftDayKey(today, -1)
  const used = await repairsInMonth(db, profile._id, day)
  if (used >= TOKEN_RULES.sinks.dayRepairPerMonth) return null
  const balance = (await readAggregates(db, profile._id, now)).all - (profile.tokenSpent ?? 0)
  if (balance < TOKEN_RULES.sinks.dayRepair) return null
  return day
}

/**
 * "Pick your streak back up" — on the phone, the evening after a streak broke.
 *
 * Its own pass. It used to be the push half of the repair mail in
 * `promotions.ts`, and there it could only go out behind the mail: to somebody
 * whose `streak.email` was on, whose evening digest had not gone, and who had
 * heard no marketing for a week. None of that is about this push. It names no
 * plan, no price and nothing bought with money, so it is a streak
 * notification, gated by the push half of the streak switch and nothing else —
 * the rule the 20:00 reminder already lives by.
 *
 * The reminder's hour, and never to the same person on the same evening: the
 * reminder is for a streak that showing up still saves, this is for one it
 * does not, and `streakSavable` and `streakBrokeYesterday` are never both
 * true.
 *
 * Sent as a `wallet` push carrying `repairDay`, so every installed build opens
 * the wallet and a build that reads the day opens the store: see `PUSH_KINDS`.
 * No inbox row — like the reminder, it is about the reader's own habit, not
 * something anybody did to them.
 */
export async function runStreakRepairPushPass(
  db: Db,
  sender: PushSender,
  now: Date = new Date(),
): Promise<{ sent: number }> {
  const readers = await profilesInLocalHour(db, STREAK_REMINDER_LOCAL_HOUR, now, {
    deletedAt: { $exists: false },
    guest: { $exists: false },
    'streak.current': { $gte: STREAK_REPAIR_NUDGE_MIN_STREAK },
    // Bounds the scan only: the local day is never more than one from UTC's,
    // so the day before yesterday anywhere is within three UTC days.
    // `streakRepairDay` decides, on the reader's own day.
    'streak.lastQualifiedDay': { $gte: shiftDayKey(utcDayKey(now), -3) },
    // Bounds the scan; `notificationsAllowed` decides. Only the oldest stored
    // shape is a bare `false` this can read.
    'settings.notifications': { $ne: false },
  })

  let sent = 0
  for (const profile of readers) {
    if (!notificationsAllowed(profile.settings?.notifications, 'streak', 'push')) continue
    const repairDay = await streakRepairDay(db, profile, now)
    if (repairDay === null) continue

    const byLocale = await tokensByLocale(db, profile._id)
    if (byLocale.size === 0) continue

    // Keyed by the missed day: one broken streak, one push, however many
    // ticks land in the hour.
    if (!(await claimOnce(db, 'streakRepair', profile._id, repairDay))) continue

    for (const [locale, tokens] of byLocale) {
      const t = translator(locale)
      await sendPush(db, sender, {
        to: tokens,
        title: t('push.streakRepairTitle'),
        body: t('push.streakRepairBody'),
        data: { kind: 'wallet', repairDay },
      })
    }
    sent++
  }

  return { sent }
}
