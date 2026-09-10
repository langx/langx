import { NEWSLETTER_LOCAL_HOUR, localDayKey, localHour, notificationsAllowed } from '@langx/shared'
import type { Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import { sendNotificationEmail, type NotificationEmailContext } from '../../email/notify'
import { newsletterEmail } from '../../email/templates'
import { noteFor } from '../../email/newsletters'
import type { Profile } from '../profiles/profiles'
import { claimOnce } from './ledger'
import { recentlyMarketed } from './marketing'

/** What a month looked like for one person, and for everybody. */
export interface MonthlyRecap {
  month: string
  personal: { messages: number; corrections: number; tokens: number; streak: number }
  community: { members: number; messages: number; corrections: number }
  /** True when the personal half is all zeroes — a different letter. */
  quiet: boolean
}

/** The month before the one `now` is in, as `YYYY-MM`. */
export function lastMonthKey(now: Date): string {
  const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const previous = new Date(first.getTime() - 24 * 60 * 60 * 1000)
  return previous.toISOString().slice(0, 7)
}

/**
 * The community numbers, computed once per tick rather than once per reader.
 *
 * Three counts over a month of rows. On a database this size that is
 * milliseconds; if it ever is not, the answer is a `jobRuns` row holding the
 * month's totals rather than a cache here, since every instance would want
 * the same three numbers.
 */
export async function communityMonth(db: Db, month: string): Promise<MonthlyRecap['community']> {
  const from = new Date(`${month}-01T00:00:00.000Z`)
  const to = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 1))
  const range = { $gte: from, $lt: to }
  const [members, messages, corrections] = await Promise.all([
    db
      .collection(COLLECTIONS.profiles)
      .countDocuments({ createdAt: range, guest: { $exists: false } }),
    db.collection(COLLECTIONS.messages).countDocuments({ createdAt: range }),
    db.collection(COLLECTIONS.postCorrections).countDocuments({ createdAt: range }),
  ])
  return { members, messages, corrections }
}

/**
 * One person's month, read from what the token ledger already aggregates and
 * what `dailyActivity` already counts.
 *
 * Nothing new is stored for this. `dailyActivity` exists to cap the daily
 * pool and holds a row per person per day with exactly the two numbers a
 * recap wants; summing thirty of them is cheaper than keeping a second
 * running total that could disagree with the first.
 */
export async function personalMonth(
  db: Db,
  userId: string,
  month: string,
): Promise<MonthlyRecap['personal']> {
  const days = await db
    .collection<{ messages?: number; corrections?: number }>(COLLECTIONS.dailyActivity)
    .find({ userId, day: { $gte: `${month}-01`, $lte: `${month}-31` } })
    .toArray()
  const tokens =
    (
      await db
        .collection<{ tokens: number }>(COLLECTIONS.tokenAggregates)
        .findOne({ _id: `${userId}:month:${month}` as never })
    )?.tokens ?? 0
  const profile = await db
    .collection<Profile>(COLLECTIONS.profiles)
    .findOne({ _id: userId }, { projection: { streak: 1 } })
  return {
    messages: days.reduce((total, day) => total + (day.messages ?? 0), 0),
    corrections: days.reduce((total, day) => total + (day.corrections ?? 0), 0),
    tokens,
    streak: profile?.streak?.current ?? 0,
  }
}

/**
 * "Your month on LangX" — the one piece of mail here that is the same shape
 * every time and still worth reading, because the numbers in it are yours.
 *
 * **Monthly rather than weekly**, and the reason is the numbers themselves: a
 * week of a language exchange is three conversations and a correction, which
 * reads as an accusation rather than a summary. Switching it is
 * `NEWSLETTER_LOCAL_HOUR`'s neighbours in `packages/shared`, not a rewrite.
 *
 * **"On or after the first", not "on the first."** A deploy on the third
 * would otherwise skip the month silently, and the claim is what stops it
 * being sent twice — so the condition can afford to be generous.
 *
 * The editorial half — what shipped this month — comes from
 * `email/newsletters/`, which is written by a scheduled routine, reviewed as
 * a pull request and merged. No note for the month, no editorial block; the
 * recap still goes, because the numbers are the part that is always true.
 */
export async function runNewsletterPass(
  db: Db,
  ctx: NotificationEmailContext,
  now: Date = new Date(),
): Promise<{ sent: number }> {
  const month = lastMonthKey(now)
  const profiles = await db
    .collection<Profile>(COLLECTIONS.profiles)
    .find({
      deletedAt: { $exists: false },
      guest: { $exists: false },
      'settings.notifications': { $ne: false },
    })
    .toArray()

  let community: MonthlyRecap['community'] | null = null
  let sent = 0

  for (const profile of profiles) {
    if (!notificationsAllowed(profile.settings?.notifications, 'promotions', 'email')) continue
    const zone = profile.timezone ?? 'UTC'
    // Their first of the month — or one of the six days after it, so a
    // deploy that slipped does not skip a month — and any hour from ten
    // onwards, since a tick missed at ten is not a month skipped either.
    if (!isSendingDay(localDayKey(now, zone))) continue
    if (localHour(now, zone) < NEWSLETTER_LOCAL_HOUR) continue
    if (await recentlyMarketed(db, profile._id, now)) continue

    // Computed on the first tick that needs it, then reused for the rest.
    community ??= await communityMonth(db, month)
    const personal = await personalMonth(db, profile._id, month)
    const recap: MonthlyRecap = {
      month,
      personal,
      community,
      quiet: personal.messages === 0 && personal.corrections === 0 && personal.tokens === 0,
    }

    if (!(await claimOnce(db, 'promo.newsletter', profile._id, month))) continue
    const outcome = await sendNotificationEmail(db, ctx, {
      userId: profile._id,
      type: 'promotions',
      build: (locale, unsubscribe) =>
        newsletterEmail(locale, recap, noteFor(month, locale), unsubscribe),
    })
    if (outcome === 'sent') sent++
  }

  return { sent }
}

/**
 * The days that still count as "this month's newsletter".
 *
 * The first, plus the six after it: long enough to cover a deploy that
 * slipped or an instance that was down, short enough that a recap of last
 * month does not arrive when last month is a fortnight gone. The claim is
 * what stops it going twice, so this can afford to be generous.
 */
function isSendingDay(localDay: string): boolean {
  const dayOfMonth = Number(localDay.slice(8, 10))
  return dayOfMonth >= 1 && dayOfMonth <= 7
}
