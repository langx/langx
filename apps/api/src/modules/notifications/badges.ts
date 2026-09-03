import {
  BADGE_ROUND_UP_LOCAL_HOUR,
  findBadge,
  localDayKey,
  localHour,
  notificationsAllowed,
} from '@langx/shared'
import type { Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import { sendNotificationEmail, type NotificationEmailContext } from '../../email/notify'
import { badgeEarnedEmail } from '../../email/templates'
import { translator } from '../../i18n'
import type { Profile } from '../profiles/profiles'
import { sendPush, tokensByLocale, type PushSender } from '../push/devices'
import { getBadgeSummary } from '../tokens/badges'
import { claimOnce } from './ledger'

/**
 * "You earned a badge."
 *
 * Badges are derived and never stored, which is what makes this pass more than
 * a lookup: there is no row whose appearance could be watched. The set is
 * recomputed, compared with the ids this account has already been told about,
 * and the difference is the news. `stats.notifiedBadgeIds` is that memory, and
 * it grants nothing — see the note on the field.
 *
 * Every progress source behind a badge is monotonic (`streak.longest`, not
 * `current`; tokens *earned*, which spending never touches), so the difference
 * can only ever grow. A badge cannot be un-earned and therefore cannot be
 * announced twice by a shrinking count.
 *
 * Once a day rather than at the moment of earning. Four of the five kinds are
 * counters that move on paths — a message, a correction, a token award — which
 * must not pay for a badge computation each, and the fifth is the passage of
 * time, which has no path at all. An evening round-up also reads better than
 * three separate buzzes on a good day.
 *
 * An account with no `notifiedBadgeIds` is *seeded*, not congratulated:
 * everything already earned is recorded as known and nothing is sent. Nobody
 * gets a notification about a streak they finished last March because this
 * shipped.
 */
export async function runBadgeRoundUpPass(
  db: Db,
  senders: { push: PushSender; email: NotificationEmailContext },
  now: Date = new Date(),
): Promise<{ sent: number; seeded: number }> {
  const profiles = db.collection<Profile>(COLLECTIONS.profiles)
  const candidates = await profiles
    .find({
      deletedAt: { $exists: false },
      // Bounds the scan; `notificationsAllowed` decides. Only the oldest
      // stored shape is a bare `false` this can read.
      'settings.notifications': { $ne: false },
    })
    .toArray()

  let sent = 0
  let seeded = 0

  for (const profile of candidates) {
    const zone = profile.timezone ?? 'UTC'
    if (localHour(now, zone) !== BADGE_ROUND_UP_LOCAL_HOUR) continue

    const wantsPush = notificationsAllowed(profile.settings?.notifications, 'badges', 'push')
    const wantsEmail = notificationsAllowed(profile.settings?.notifications, 'badges', 'email')

    const summary = await getBadgeSummary(db, profile._id, now)
    const earned = summary.badges.filter((badge) => badge.earned).map((badge) => badge.id)

    const known = profile.stats?.notifiedBadgeIds
    if (known === undefined) {
      // First sight of this account. Record where it stands and say nothing —
      // the news starts from here.
      await profiles.updateOne({ _id: profile._id }, { $set: { 'stats.notifiedBadgeIds': earned } })
      seeded++
      continue
    }

    const knownSet = new Set(known)
    const fresh = earned.filter((id) => !knownSet.has(id))
    if (fresh.length === 0) continue

    // Recorded before the send, like every ledger claim in this app: a
    // notification nobody got is better than one that arrives every evening
    // because the write that would have stopped it never happened.
    await profiles.updateOne({ _id: profile._id }, { $set: { 'stats.notifiedBadgeIds': earned } })
    if (!wantsPush && !wantsEmail) continue
    if (!(await claimOnce(db, 'badgeEarned', profile._id, localDayKey(now, zone)))) continue

    // The label is English in the catalogue — `BADGES` builds it from the
    // threshold — so the notification names it only when there is exactly one,
    // and counts otherwise. A list of five English labels inside an Arabic
    // sentence is worse than a number.
    const only = fresh.length === 1 ? findBadge(fresh[0] as string) : undefined

    const byLocale = wantsPush ? await tokensByLocale(db, profile._id) : new Map<never, never>()
    if (byLocale.size > 0) {
      for (const [locale, tokens] of byLocale) {
        const t = translator(locale)
        await sendPush(db, senders.push, {
          to: tokens,
          title: only
            ? t('push.badgeOneTitle', { label: only.label })
            : t('push.badgeManyTitle', { count: fresh.length }),
          body: t('push.badgeBody'),
          data: { kind: 'badgeEarned' },
        })
      }
      sent++
      continue
    }

    if (!wantsEmail) continue
    const outcome = await sendNotificationEmail(db, senders.email, {
      userId: profile._id,
      type: 'badges',
      build: (locale, unsubscribe) =>
        badgeEarnedEmail(locale, {
          count: fresh.length,
          label: only?.label ?? null,
          unsubscribe,
        }),
    })
    if (outcome === 'sent') sent++
  }

  return { sent, seeded }
}
