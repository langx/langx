import {
  PROMOTION_LOCAL_HOUR,
  aggregateId,
  localDayKey,
  notificationsAllowed,
  type MonthlyRecapDto,
  type YearlyRecapDto,
} from '@langx/shared'
import type { Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import { sendNotificationEmail, type NotificationEmailContext } from '../../email/notify'
import { newsletterEmail } from '../../email/templates'
import { noteFor } from '../../email/newsletters'
import { profilesInLocalHour } from '../profiles/localHour'
import type { Profile } from '../profiles/profiles'
import { notHidden } from '../feed/documents'
import { alreadyClaimed, claimOnce } from './ledger'
import { MARKETING_SLOT_JOB, recentlyMarketed } from './marketing'

/** What a month looked like for one person, and for everybody. */
export interface MonthlyRecap {
  month: string
  personal: {
    messages: number
    corrections: number
    /** Posts put up that month, hidden ones left out, as on the profile's Feed tile. */
    posts: number
    tokens: number
    streak: number
    /** Different people messaged — the union of each day's `partners`. */
    partners: number
    /** Days with at least one message or correction. */
    activeDays: number
    /** Those days, as days of the month. */
    activeDates: number[]
  }
  community: {
    members: number
    messages: number
    corrections: number
    posts: number
    /** Every token that went out that month, grants and the daily pool included. */
    tokens: number
  }
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
 * Four counts and a sum over a month of rows. On a database this size that
 * is milliseconds; if it ever is not, the answer is a `jobRuns` row holding
 * the month's totals rather than a cache here, since every instance would want
 * the same five numbers.
 *
 * The token total is read from the ledger, not `tokenAggregates`: grants —
 * signup bonuses, gifts, v1 conversions — never reach the month buckets, and
 * "given out" has to include them. `spend` is the only negative kind and is
 * not tokens given out. By `day` rather than `month` because `day` is the
 * ledger's index.
 */
export async function communityMonth(db: Db, month: string): Promise<MonthlyRecap['community']> {
  const from = new Date(`${month}-01T00:00:00.000Z`)
  const to = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 1))
  const range = { $gte: from, $lt: to }
  const [members, messages, corrections, posts, tokens] = await Promise.all([
    db
      .collection(COLLECTIONS.profiles)
      .countDocuments({ createdAt: range, guest: { $exists: false } }),
    // What people wrote to each other. A call leaves a row too, and it is
    // not a message anybody sent.
    db.collection(COLLECTIONS.messages).countDocuments({ createdAt: range, type: { $ne: 'call' } }),
    db.collection(COLLECTIONS.postCorrections).countDocuments({ createdAt: range }),
    db.collection(COLLECTIONS.posts).countDocuments({ createdAt: range }),
    db
      .collection(COLLECTIONS.tokenLedger)
      .aggregate<{ total: number }>([
        { $match: { day: { $gte: `${month}-01`, $lte: `${month}-31` }, kind: { $ne: 'spend' } } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ])
      .next()
      .then((row) => row?.total ?? 0),
  ])
  return { members, messages, corrections, posts, tokens }
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
  const from = new Date(`${month}-01T00:00:00.000Z`)
  const to = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 1))
  const [days, posts] = await Promise.all([
    db
      .collection<{ day: string; messages?: number; corrections?: number; partners?: string[] }>(
        COLLECTIONS.dailyActivity,
      )
      .find({ userId, day: { $gte: `${month}-01`, $lte: `${month}-31` } })
      .toArray(),
    // Posts are not a `dailyActivity` counter, so they are counted where they
    // are, over the same UTC month and on the `author` index.
    db
      .collection(COLLECTIONS.posts)
      .countDocuments({ authorId: userId, createdAt: { $gte: from, $lt: to }, ...notHidden() }),
  ])
  const tokens =
    (
      await db
        .collection<{ tokens: number }>(COLLECTIONS.tokenAggregates)
        .findOne({ _id: `${userId}:month:${month}` as never })
    )?.tokens ?? 0
  const profile = await db
    .collection<Profile>(COLLECTIONS.profiles)
    .findOne({ _id: userId }, { projection: { streak: 1 } })
  // `partners` is absent on a day whose only activity was a correction — see
  // `countersOf` — so it is read with a default, never assumed.
  const partners = new Set(days.flatMap((day) => day.partners ?? []))
  // A row can exist with both counters at zero: the mutual-conversation
  // bonus writes one for the partner, who did nothing that day.
  const active = days
    .filter((day) => (day.messages ?? 0) + (day.corrections ?? 0) > 0)
    .map((day) => Number(day.day.slice(8, 10)))
    .sort((a, b) => a - b)
  return {
    messages: days.reduce((total, day) => total + (day.messages ?? 0), 0),
    corrections: days.reduce((total, day) => total + (day.corrections ?? 0), 0),
    posts,
    tokens,
    streak: profile?.streak?.current ?? 0,
    partners: partners.size,
    activeDays: active.length,
    activeDates: active,
  }
}

/**
 * The in-app recap: the email's personal half plus the month's Echo row.
 *
 * Same source as the letter on purpose, so the card someone shares and the
 * mail they got the same week cannot show two different numbers.
 */
export async function recapForMonth(
  db: Db,
  userId: string,
  month: string,
): Promise<MonthlyRecapDto> {
  const [personal, echo] = await Promise.all([
    personalMonth(db, userId, month),
    db
      .collection<{ _id: string; reviews: number }>(COLLECTIONS.echoAggregates)
      .findOne({ _id: aggregateId(userId, 'month', month) }),
  ])
  return {
    month,
    messages: personal.messages,
    corrections: personal.corrections,
    tokens: personal.tokens,
    echoReviews: echo?.reviews ?? 0,
    currentStreak: personal.streak,
    partners: personal.partners,
    activeDays: personal.activeDays,
    activeDates: personal.activeDates,
  }
}

/** The year before the one `now` is in, as `YYYY`. */
export function lastYearKey(now: Date): string {
  return String(now.getUTCFullYear() - 1)
}

/**
 * "Your Year": the in-app recap over twelve months.
 *
 * The same rows `recapForMonth` reads, a year of them — a few hundred
 * `dailyActivity` rows at most — plus the `year` row the token ledger and
 * Echo already keep beside the month's. Asked for the current year it is the
 * year so far, which is what a recap opened in late December wants.
 */
export async function recapForYear(db: Db, userId: string, year: string): Promise<YearlyRecapDto> {
  const [days, tokens, echo, profile] = await Promise.all([
    db
      .collection<{ day: string; messages?: number; corrections?: number; partners?: string[] }>(
        COLLECTIONS.dailyActivity,
      )
      .find({ userId, day: { $gte: `${year}-01-01`, $lte: `${year}-12-31` } })
      .toArray(),
    db
      .collection<{ _id: string; tokens: number }>(COLLECTIONS.tokenAggregates)
      .findOne({ _id: aggregateId(userId, 'year', year) }),
    db
      .collection<{ _id: string; reviews: number }>(COLLECTIONS.echoAggregates)
      .findOne({ _id: aggregateId(userId, 'year', year) }),
    db
      .collection<Profile>(COLLECTIONS.profiles)
      .findOne({ _id: userId }, { projection: { streak: 1 } }),
  ])
  // The same two rules as `personalMonth`: `partners` may be absent, and a
  // row with both counters at zero is somebody else's mutual bonus.
  const partners = new Set(days.flatMap((day) => day.partners ?? []))
  const active = days.filter((day) => (day.messages ?? 0) + (day.corrections ?? 0) > 0)
  const activeMonths = Array.from({ length: 12 }, () => 0)
  for (const day of active) {
    const index = Number(day.day.slice(5, 7)) - 1
    activeMonths[index] = (activeMonths[index] ?? 0) + 1
  }
  return {
    year,
    messages: days.reduce((total, day) => total + (day.messages ?? 0), 0),
    corrections: days.reduce((total, day) => total + (day.corrections ?? 0), 0),
    tokens: tokens?.tokens ?? 0,
    echoReviews: echo?.reviews ?? 0,
    currentStreak: profile?.streak?.current ?? 0,
    partners: partners.size,
    activeDays: active.length,
    activeMonths,
  }
}

/**
 * "Your month on LangX" — the one piece of mail here that is the same shape
 * every time and still worth reading, because the numbers in it are yours.
 *
 * **Monthly rather than weekly**, and the reason is the numbers themselves: a
 * week of a language exchange is three conversations and a correction, which
 * reads as an accusation rather than a summary. Switching it is
 * `PROMOTION_LOCAL_HOUR`'s neighbours in `packages/shared`, not a rewrite.
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
  // The marketing slot, which is an hour after the digest rather than the
  // morning it used to be. Seven days of chances at it is what makes one
  // missed evening not a missed month.
  const readers = await profilesInLocalHour(db, PROMOTION_LOCAL_HOUR, now, {
    deletedAt: { $exists: false },
    guest: { $exists: false },
    'settings.notifications': { $ne: false },
  })

  let community: MonthlyRecap['community'] | null = null
  let sent = 0

  for (const profile of readers) {
    if (!notificationsAllowed(profile.settings?.notifications, 'promotions', 'email')) continue
    const zone = profile.timezone ?? 'UTC'
    // Their first of the month — or one of the six days after it, so a
    // deploy that slipped does not skip a month.
    const day = localDayKey(now, zone)
    if (!isSendingDay(day)) continue
    // The recap never takes the day's slot from the evening mail. Real news
    // outranks a summary of a month that has already finished.
    if (await alreadyClaimed(db, 'dailyDigest', profile._id, day)) continue
    if (await recentlyMarketed(db, profile._id, now)) continue
    // The read above cannot see a sender that is mid-tick beside this one.
    // This can. Before the month claim, so a lost race costs today rather
    // than the month — `isSendingDay` gives six more chances at it.
    if (!(await claimOnce(db, MARKETING_SLOT_JOB, profile._id, day))) continue

    // Computed on the first tick that needs it, then reused for the rest.
    community ??= await communityMonth(db, month)
    const personal = await personalMonth(db, profile._id, month)
    const recap: MonthlyRecap = {
      month,
      personal,
      community,
      quiet:
        personal.messages === 0 &&
        personal.corrections === 0 &&
        personal.posts === 0 &&
        personal.tokens === 0,
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
