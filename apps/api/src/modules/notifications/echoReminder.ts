import {
  ECHO_REMINDER_LOCAL_HOUR,
  localDayKey,
  localHour,
  notificationsAllowed,
} from '@langx/shared'
import type { Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import { translator } from '../../i18n'
import type { EchoCardDoc } from '../echo/documents'
import type { EchoReviewDoc } from '../echo/documents'
import type { Profile } from '../profiles/profiles'
import { sendPush, tokensByLocale, type PushSender } from '../push/devices'
import { claimOnce } from './ledger'

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * "Your cards are ready" — once, at the end of the reader's own day.
 *
 * Push only. The evening digest is already mail and goes out at the same
 * hour; a letter saying the same thing on the same evening is the fastest way
 * to make somebody turn both off. There is nothing to summarise here anyway —
 * the whole message is a number and an invitation to act on it now.
 *
 * Nobody is nudged about work they have already done: a person who reviewed
 * today is skipped even with cards still due, because the nudge exists to
 * start a session and they have started one.
 *
 * No inbox row, unlike the profile-visits pass. The notification centre is a
 * record of things other people did to you; your own cards coming due is not
 * news about anybody, and a row per day would be a list of one sentence
 * repeated.
 */
export async function runEchoReminderPass(
  db: Db,
  sender: PushSender,
  now: Date = new Date(),
): Promise<{ sent: number }> {
  const profiles = await db
    .collection<Profile>(COLLECTIONS.profiles)
    .find({
      deletedAt: { $exists: false },
      // Bounds the scan; `notificationsAllowed` decides. Only the oldest
      // stored shape is a bare `false` this can read.
      'settings.notifications': { $ne: false },
    })
    .toArray()

  const cards = db.collection<EchoCardDoc>(COLLECTIONS.echoCards)
  const reviews = db.collection<EchoReviewDoc>(COLLECTIONS.echoReviews)
  let sent = 0

  for (const profile of profiles) {
    const zone = profile.timezone ?? 'UTC'
    if (localHour(now, zone) !== ECHO_REMINDER_LOCAL_HOUR) continue
    if (!notificationsAllowed(profile.settings?.notifications, 'echo', 'push')) continue

    const due = await cards.countDocuments({ userId: profile._id, 'srs.due': { $lte: now } })
    if (due === 0) continue

    const reviewedToday = await reviews.countDocuments({
      userId: profile._id,
      at: { $gte: new Date(now.getTime() - DAY_MS) },
    })
    if (reviewedToday > 0) continue

    const byLocale = await tokensByLocale(db, profile._id)
    if (byLocale.size === 0) continue

    // Claimed before the send, deliberately: a crash after the push is one
    // silence, and a crash before it is one push twice.
    if (!(await claimOnce(db, 'echoReminder', profile._id, localDayKey(now, zone)))) continue

    for (const [locale, tokens] of byLocale) {
      const t = translator(locale)
      await sendPush(db, sender, {
        to: tokens,
        title: t('push.echoTitle', { count: due }),
        body: t('push.echoBody'),
        data: { kind: 'echo' },
      })
    }
    sent++
  }

  return { sent }
}
