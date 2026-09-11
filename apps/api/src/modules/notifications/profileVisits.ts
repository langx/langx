import {
  PROFILE_VISITS_EMAIL_MAX_NAMES,
  PROFILE_VISITS_LOCAL_HOUR,
  PROFILE_VISITS_WEEKLY_LOCAL_WEEKDAY,
  localDayKey,
  localHour,
  notificationsAllowed,
  weekKey,
  type NotificationChannel,
} from '@langx/shared'
import type { Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import { sendNotificationEmail, type NotificationEmailContext } from '../../email/notify'
import { profileVisitsEmail } from '../../email/templates'
import { translator } from '../../i18n'
import { viewSummarySince } from '../moderation/profileViews'
import type { Profile } from '../profiles/profiles'
import { sendPush, tokensByLocale, type PushSender } from '../push/devices'
import { recordNotification } from './inbox'
import { claimOnce } from './ledger'

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Everyone for whom it is `hour` on their own clock, and who has not switched
 * this kind off on `channel`.
 *
 * The same scan `streakReminderCandidates` does, and chosen over grouping
 * `profileViews` for the same reason: the block filter and the tier gate have
 * to be applied per viewed person anyway, so an aggregation would only move
 * the work rather than remove it — and this way both passes read like the
 * scheduler beside them.
 */
async function profilesAtLocalHour(
  db: Db,
  hour: number,
  /**
   * `null` asks for everybody at that hour, switch or no switch.
   *
   * The inbox needs that set: its rows are not a channel, and gating them on
   * a push preference would turn the notification centre into a ninth switch
   * by the back door. The push filter is then applied per profile by the
   * caller, after the row is written.
   */
  channel: NotificationChannel | null,
  type: 'profileVisits',
  now: Date,
): Promise<Profile[]> {
  const profiles = await db
    .collection<Profile>(COLLECTIONS.profiles)
    .find({
      deletedAt: { $exists: false },
      // Bounds the scan; `notificationsAllowed` decides. Only the oldest
      // stored shape is a bare `false` this can read.
      'settings.notifications': { $ne: false },
    })
    .toArray()

  return profiles.filter(
    (profile) =>
      (channel === null || notificationsAllowed(profile.settings?.notifications, type, channel)) &&
      localHour(now, profile.timezone ?? 'UTC') === hour,
  )
}

/**
 * "Somebody looked at your profile" — once a day, as a number.
 *
 * Batched rather than sent on each view, and that is a product decision rather
 * than a saving. The viewer *list* is a Pro feature and the count is free, so
 * a push per view would hand a free user the paywall's argument several times
 * an afternoon. Once a day, naming nobody, the count is the free half and the
 * tap lands on `/viewers`, which draws its own line.
 *
 * There is no email fallback here, unlike the streak nudge: the email face of
 * this kind is the weekly summary below, and somebody with no phone gets that
 * instead of a daily one.
 */
export async function runProfileVisitsPushPass(
  db: Db,
  sender: PushSender,
  now: Date = new Date(),
): Promise<{ sent: number }> {
  const candidates = await profilesAtLocalHour(
    db,
    PROFILE_VISITS_LOCAL_HOUR,
    // Everybody at this hour, not only those who want the push — the inbox
    // row below is written for all of them, and the switch is applied after.
    null,
    'profileVisits',
    now,
  )
  let sent = 0

  for (const profile of candidates) {
    const zone = profile.timezone ?? 'UTC'
    const summary = await viewSummarySince(db, profile._id, new Date(now.getTime() - DAY_MS))
    if (!summary || summary.count === 0) continue

    /*
     * A count, and deliberately no `actorId`.
     *
     * Who looked is a Pro feature — `viewSummarySince` returns `null` for the
     * viewer list rather than an empty array precisely so the paywall's line
     * is drawn in one module — and a row carrying an actor plus a hydrated
     * name and face would hand that out to everybody in a JSON body.
     *
     * Inserted once per local day and never updated, which is the other half
     * of why this is not one row per visitor. A row whose count grew would
     * have to move its `createdAt` to be noticed, and a row that moves inside
     * a keyset page makes a cursor skip or repeat — the exact failure
     * `dateIdCursor` exists to prevent.
     */
    await recordNotification(db, {
      userId: profile._id,
      kind: 'profileVisits',
      refId: localDayKey(now, zone),
      count: summary.count,
      at: now,
    })

    if (!notificationsAllowed(profile.settings?.notifications, 'profileVisits', 'push')) continue

    const byLocale = await tokensByLocale(db, profile._id)
    if (byLocale.size === 0) continue

    if (!(await claimOnce(db, 'profileVisitsPush', profile._id, localDayKey(now, zone)))) continue

    for (const [locale, tokens] of byLocale) {
      const t = translator(locale)
      await sendPush(db, sender, {
        to: tokens,
        title: t('push.profileVisitsTitle', { count: summary.count }),
        body: t('push.profileVisitsBody'),
        data: { kind: 'profileVisits' },
      })
    }
    sent++
  }

  return { sent }
}

/**
 * The same thing once a week, by email, and this one may name people — to the
 * tier that is allowed to see them. `viewSummarySince` decides that; nothing
 * here knows what a plan is.
 */
export async function runProfileVisitsEmailPass(
  db: Db,
  ctx: NotificationEmailContext,
  now: Date = new Date(),
): Promise<{ sent: number }> {
  const candidates = await profilesAtLocalHour(
    db,
    PROFILE_VISITS_LOCAL_HOUR,
    'email',
    'profileVisits',
    now,
  )
  let sent = 0

  for (const profile of candidates) {
    const zone = profile.timezone ?? 'UTC'
    // The weekday on *their* calendar, not the server's: the local day key is
    // already computed for that zone, so parsing it back is exact.
    const localDay = localDayKey(now, zone)
    const weekday = new Date(`${localDay}T00:00:00Z`).getUTCDay()
    if (weekday !== PROFILE_VISITS_WEEKLY_LOCAL_WEEKDAY) continue

    const summary = await viewSummarySince(
      db,
      profile._id,
      new Date(now.getTime() - 7 * DAY_MS),
      PROFILE_VISITS_EMAIL_MAX_NAMES,
    )
    if (!summary || summary.count === 0) continue

    if (!(await claimOnce(db, 'profileVisitsEmail', profile._id, weekKey(now)))) continue

    const outcome = await sendNotificationEmail(db, ctx, {
      userId: profile._id,
      type: 'profileVisits',
      build: (locale, unsubscribe) =>
        profileVisitsEmail(locale, {
          count: summary.count,
          names: summary.viewers?.map((viewer) => viewer.displayName) ?? null,
          unsubscribe,
        }),
    })
    if (outcome === 'sent') sent++
  }

  return { sent }
}
