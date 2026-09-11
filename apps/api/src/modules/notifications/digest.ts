import {
  DAILY_DIGEST_LOCAL_HOUR,
  localDayKey,
  localHour,
  notificationsAllowed,
  type Locale,
  type NotificationType,
} from '@langx/shared'
import type { Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import { sendDigestEmail, type NotificationEmailContext } from '../../email/notify'
import { dailyDigestEmail, type DigestSection } from '../../email/templates'
import type { Profile } from '../profiles/profiles'
import { tokensByLocale } from '../push/devices'
import type { SchedulerLogger } from '../tokens/poolScheduler'
import { streakSectionFor } from '../push/reminderScheduler'
import { badgeSectionFor } from './badges'
import { collectFeedReplies, feedRepliesSection } from './feedDigest'
import { alreadyClaimed, claimOnce } from './ledger'
import { matchSuggestionsSectionFor } from './matches'
import { collectUpcomingMeetings, meetingsSectionFor } from './meetings'
import { profileVisitsSectionFor } from './profileVisits'
import { unreadDigestSection } from './unreadDigest'
import { collectPoolPayouts, walletPoolSectionFor } from './wallet'

/**
 * One thing worth saying to one person tonight, ready to go into the mail.
 *
 * `trigger` is the field the whole design rests on. A section that is true
 * there is something that **happened** — somebody wrote, a call was agreed, a
 * streak is about to break — and its presence is a reason to send. A section
 * that is false is a passenger: worth reading in a mail that is going anyway,
 * never worth an envelope of its own. Match suggestions are the obvious case,
 * but so is anything a push has already delivered to a phone: saying it again
 * twelve hours later is not news, and a mail sent only to repeat it is the
 * thing this rewrite exists to stop.
 *
 * `claim` is the section's own place in the ledger, not the digest's. The two
 * are different questions — the mail is once a day, while an absence produces
 * one unread mention however many evenings it spans, and profile visits are
 * still weekly — so each section keeps the period key it had when it was a
 * letter of its own.
 */
export interface DigestCandidate {
  trigger: boolean
  claim: () => Promise<boolean>
  build: (locale: Locale) => DigestSection
}

/**
 * The one notification email of the day.
 *
 * Everything that used to post its own envelope — unread messages, the day's
 * replies, the weekly visitors, badges, the pool, tomorrow's calls, the streak
 * nudge for anybody without a phone — is a paragraph in here now, and the
 * count of letters a person can receive in a day went from four to one.
 *
 * Three rules hold it together:
 *
 * 1. **Nothing pending, nothing sent.** No section may invent a reason to
 *    write; see `trigger` above. A quiet account hears nothing, which is the
 *    point rather than a side effect.
 * 2. **The reader's own evening.** Seven o'clock where they are, on a
 *    half-hourly tick that catches every whole and half-hour offset.
 * 3. **Each kind still answers for itself.** `notificationsAllowed` is asked
 *    per section, before the work of building it, so a switch somebody turned
 *    off silences its paragraph and nothing else. A mail with no paragraphs
 *    left is not sent at all, which is how the eight switches still add up to
 *    an honest "no email from LangX".
 *
 * The order below is the order in the mail, and the first section that
 * survives lends the envelope its subject — so it runs from what cannot wait
 * to what could have waited a fortnight.
 */
export async function runDailyDigestPass(
  db: Db,
  ctx: NotificationEmailContext,
  now: Date = new Date(),
  storagePublicBaseUrl?: string,
  logger?: Pick<SchedulerLogger, 'warn'>,
): Promise<{ sent: number; failed: number }> {
  const profiles = await db
    .collection<Profile>(COLLECTIONS.profiles)
    .find({
      deletedAt: { $exists: false },
      guest: { $exists: false },
      // Bounds the scan only; `notificationsAllowed` decides per section. Two
      // of the three stored shapes are objects this cannot read into.
      'settings.notifications': { $ne: false },
    })
    .toArray()

  const readers = profiles.filter(
    (profile) => localHour(now, profile.timezone ?? 'UTC') === DAILY_DIGEST_LOCAL_HOUR,
  )
  if (readers.length === 0) return { sent: 0, failed: 0 }

  /*
   * The three collectors that answer for everybody at once, read after the
   * hour filter so a tick with nobody in their evening costs three queries it
   * never makes. Each of them replaces what would otherwise be a query per
   * reader — the reason `feedDigest` was written from the replies inwards
   * rather than from the profiles outwards in the first place.
   */
  const [replies, payouts, meetings] = await Promise.all([
    collectFeedReplies(db, now),
    collectPoolPayouts(db, now),
    collectUpcomingMeetings(db, now),
  ])

  let sent = 0
  let failed = 0
  for (const profile of readers) {
    /*
     * One reader at a time, and one reader's failure is their own.
     *
     * This walks every profile in the database and hands each one to eight
     * builders, two of which read documents written by earlier versions of
     * this app. A single malformed row would otherwise throw here, the
     * scheduler would log it, wait thirty minutes and do exactly the same
     * thing again — and nobody after that row in the list would ever get a
     * digest. Same doctrine as the badge round-up, and for the same reason.
     */
    try {
      sent += await digestOne(profile)
    } catch (error) {
      failed++
      logger?.warn({ err: error, userId: profile._id }, 'daily digest skipped one reader')
    }
  }

  return { sent, failed }

  async function digestOne(profile: Profile): Promise<number> {
    const day = localDayKey(now, profile.timezone ?? 'UTC')
    // The cheap look before a dozen queries; `claimOnce` below still decides.
    if (await alreadyClaimed(db, 'dailyDigest', profile._id, day)) return 0

    /*
     * Whether anything can buzz this person, asked at most once and only if a
     * section actually needs to know. It decides two things: the streak nudge
     * exists here only for somebody the 20:00 push cannot reach, and the pool
     * paragraph is a passenger for anybody the morning push already told.
     */
    let device: boolean | undefined
    const hasPushDevice = async (): Promise<boolean> => {
      if (device === undefined) device = (await tokensByLocale(db, profile._id)).size > 0
      return device
    }

    const candidates: DigestCandidate[] = []
    /*
     * One section's failure is its own, and that is the finer half of the
     * guard around this loop.
     *
     * Some of these builders read documents this app has been writing for two
     * versions, and one of them — the suggestions — runs the discovery
     * aggregate over the whole profile collection. A row old enough to be
     * missing a field it expects throws. Letting that reach the outer catch
     * would cost the reader their *entire* digest, unread messages included,
     * because the app could not think of anybody to introduce them to. So a
     * paragraph that cannot be built is dropped and the mail goes without it.
     */
    const add = async (
      kind: NotificationType,
      make: () => Promise<DigestCandidate | null> | DigestCandidate | null,
    ): Promise<void> => {
      if (!notificationsAllowed(profile.settings?.notifications, kind, 'email')) return
      try {
        const candidate = await make()
        if (candidate) candidates.push(candidate)
      } catch (error) {
        logger?.warn({ err: error, userId: profile._id, kind }, 'digest section skipped')
      }
    }

    await add('messages', () => unreadDigestSection(db, profile, now, storagePublicBaseUrl))
    await add('streak', async () => streakSectionFor(db, profile, now, await hasPushDevice()))
    await add('meetings', () => meetingsSectionFor(db, profile, meetings.get(profile._id), now))
    await add('social', () => feedRepliesSection(db, profile, replies.get(profile._id), now))
    await add('badges', () => badgeSectionFor(db, profile, now))
    await add('wallet', async () =>
      walletPoolSectionFor(db, profile, payouts.get(profile._id), await hasPushDevice(), now),
    )
    await add('profileVisits', () => profileVisitsSectionFor(db, profile, now))
    await add('promotions', () =>
      matchSuggestionsSectionFor(db, profile, now, storagePublicBaseUrl),
    )

    if (!candidates.some((candidate) => candidate.trigger)) return 0
    if (!(await claimOnce(db, 'dailyDigest', profile._id, day))) return 0

    /*
     * Claimed before the send, like every ledger write in this app: a mail
     * nobody got is better than one that arrives every half hour because the
     * write that would have stopped it never happened.
     *
     * A claim can still lose — another tick, or a section whose own period was
     * taken between the look above and here — and a mail left holding only
     * passengers is exactly the letter rule 1 forbids, so it is dropped rather
     * than sent thinner.
     */
    const included: DigestCandidate[] = []
    for (const candidate of candidates) if (await candidate.claim()) included.push(candidate)
    if (!included.some((candidate) => candidate.trigger)) return 0

    const outcome = await sendDigestEmail(db, ctx, {
      userId: profile._id,
      build: (locale, unsubscribe) =>
        dailyDigestEmail(locale, {
          sections: included.map((candidate) => candidate.build(locale)),
          unsubscribe,
        }),
    })
    return outcome === 'sent' ? 1 : 0
  }
}
