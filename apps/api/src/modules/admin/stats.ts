import {
  localDayKey,
  localDayStart,
  shiftDayKey,
  utcDayKey,
  type AppConfig,
  type PlanTier,
} from '@langx/shared'
import type { Db, Document } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import { getAppConfig } from '../appConfig/appConfig'
import { readJobHealth, type JobHealth } from './jobHealth'
import { countActiveToday } from '../tokens/dailyActivity'
import { DAILY_POOL_JOB, type JobRun, type PoolResult } from '../tokens/pool'
import {
  PUBLIC_STATS_TTL_MS,
  WINDOW_DAYS,
  readPublicStats,
  type DailyPoint,
  type PublicStats,
} from '../insight/publicStats'
import type { EmailSuppression } from '../notifications/suppressions'
import type { Profile } from '../profiles/profiles'

/**
 * The numbers the operator panel opens on.
 *
 * **Separate from `insight/publicStats.ts` on purpose, and nothing here may
 * move there.** That module is served unauthenticated from `/public/stats` to
 * anybody who asks, and `docs/insight.md` draws the line it lives behind:
 * members, messages, corrections, languages and streaks are publishable;
 * revenue, subscriptions, plan mix, conversion and retention are not. This is
 * the private half. It *reads* the public one rather than recomputing it —
 * that function already caches for ten minutes and already runs the three
 * expensive scans.
 *
 * What is here was chosen by what it costs. Totals come from
 * `estimatedDocumentCount`, which reads collection metadata rather than
 * counting; daily grain comes from `dailyActivity` and `tokenLedger`, both of
 * which have a bare `day` index; the pool's history is one keyed `jobRuns`
 * read per day. What is deliberately absent is "messages / conversations /
 * subscriptions / referrals in the last seven days": none of those
 * collections has a bare `createdAt` index, so each would be a collection
 * scan on every open of the dashboard, and this is a screen that gets opened.
 */

/**
 * ## Two clocks, and which numbers are on which
 *
 * The operator reads this panel in Toronto, and a UTC day turns over at 20:00
 * there — so a dashboard whose last column was a UTC day showed "today" as a
 * stub four hours before Toronto's day had ended, under tomorrow's date. Where
 * the data allows it, the grain here is therefore the *operator's* day, taken
 * from their profile's `timezone` — the same zone the wallet and every
 * scheduled notification already use.
 *
 * Three numbers cannot move, and they are marked as UTC on the screen rather
 * than quietly relabelled:
 *
 * - **`activeDaily` / `activeToday`** — `dailyActivity` is one document per
 *   user per UTC day and the activity score needs `partners` and
 *   `mutualConversations`, which are whole-day tallies with no sub-day grain
 *   to re-cut. `perLocalDay` cannot stand in for it: it carries only messages
 *   and corrections, and it is keyed by each *actor's* own local day, not by
 *   the reader's.
 * - **`assistantCallsToday`** — `assistantUsage` is keyed by a UTC day string.
 * - **`pool`** — the pool closes on a UTC day, so that day is the pool's own
 *   and not anybody's local one.
 *
 * Nothing stored changed for this. The two series that did move are re-cut at
 * read time: `tokensDaily` groups the ledger by `createdAt` inside an indexed
 * prefilter on its UTC `day`, and `daily` runs the public module's three
 * per-day passes again in the operator's zone.
 */

/**
 * How many days `activeDaily` covers, and how far back the pool is looked for.
 * The other strips run over the public module's `WINDOW_DAYS`.
 */
export const STATS_DAYS = 7

/**
 * Long enough that opening the panel twice does not recompute, short enough
 * that "how many signed up today" is worth reading. The public stats behind it
 * keep their own ten-minute memory.
 */
export const ADMIN_STATS_TTL_MS = 60 * 1000

export interface DayCount {
  day: string
  count: number
}

export interface AdminStats {
  generatedAt: string
  /**
   * The zone the day-grained numbers below are cut in — `UTC` when the
   * operator's profile carries no timezone. On the screen because a panel that
   * turns days over somewhere has to say where.
   */
  timeZone: string
  queue: {
    reports: number
    appeals: number
    feedback: number
  }
  audience: {
    /** Metadata counts, not scans — close enough for a headline, free to read. */
    profiles: number
    messages: number
    /** UTC days, both of them — see the note at the top of this file. */
    activeToday: number
    activeDaily: DayCount[]
    seenLastWeek: number
    /** The operator's day. */
    joinedToday: number
    joinedLastWeek: number
    /**
     * The three charts over the window, cut in the operator's zone. The same
     * measures `public.daily` publishes in UTC, which is why they share a
     * type — the panel draws these and leaves that one to the public page.
     */
    daily: DailyPoint[]
    builds: { platform: string; version: string; count: number }[]
  }
  money: {
    tiers: { total: number; pro: number; proPlus: number; free: number }
    pool: PoolResult | null
    tokensDaily: DayCount[]
  }
  system: {
    jobs: JobHealth[]
    suppressions: { total: number; unsubscribed: number; bounced: number; complained: number }
    purge: { accounts: number; analytics: number }
    assistantCallsToday: number
    campaigns: { id: string; status: string; sent: number; total: number }[]
    config: AppConfig
  }
  public: PublicStats
}

let memory: { at: number; timeZone: string; stats: AdminStats } | null = null

/**
 * `timeZone` is the operator's, and a different one is a miss rather than a
 * second slot: one person reads this panel, and a cache that grew an entry per
 * zone would be a map nothing ever evicted.
 */
export async function readAdminStats(
  db: Db,
  now: Date = new Date(),
  timeZone = 'UTC',
): Promise<AdminStats> {
  if (memory && memory.timeZone === timeZone && now.getTime() - memory.at < ADMIN_STATS_TTL_MS) {
    return memory.stats
  }
  const stats = await computeAdminStats(db, now, timeZone)
  memory = { at: now.getTime(), timeZone, stats }
  return stats
}

/** For the tests, and for anything that has just written what it wants to read. */
export function forgetAdminStats(): void {
  memory = null
  dailyMemory = null
}

async function computeAdminStats(db: Db, now: Date, timeZone: string): Promise<AdminStats> {
  const today = localDayKey(now, timeZone)
  // The token strip runs over the same month as the three charts above it
  // rather than over the week: a week of it was too short to show a trend.
  const days = Array.from({ length: WINDOW_DAYS }, (_, i) => shiftDayKey(today, -i)).reverse()
  const weekAgo = new Date(now.getTime() - STATS_DAYS * 24 * 60 * 60 * 1000)

  /*
   * The UTC window, for the three numbers that stay on that clock. Kept as a
   * separate pair of bindings rather than derived at each call site, so which
   * clock a query is on is visible where the query is written.
   */
  const utcToday = utcDayKey(now)
  const utcDays = Array.from({ length: STATS_DAYS }, (_, i) => shiftDayKey(utcToday, -i)).reverse()

  const profiles = db.collection<Profile>(COLLECTIONS.profiles)
  const midnight = localDayStart(today, timeZone)

  const [
    reports,
    appeals,
    feedback,
    profileCount,
    messageCount,
    activeDaily,
    seenLastWeek,
    joinedToday,
    joinedLastWeek,
    builds,
    tiers,
    pool,
    tokensDaily,
    jobs,
    suppressions,
    purgeAccounts,
    purgeAnalytics,
    assistantCallsToday,
    campaigns,
    config,
    publicStats,
    daily,
  ] = await Promise.all([
    db.collection(COLLECTIONS.reports).countDocuments({ status: { $in: ['open', 'reviewing'] } }),
    profiles.countDocuments({
      'suspension.appeal.at': { $exists: true },
      'suspension.appeal.decidedAt': { $exists: false },
    }),
    db.collection(COLLECTIONS.feedback).countDocuments({ status: 'open' }),
    profiles.estimatedDocumentCount(),
    db.collection(COLLECTIONS.messages).estimatedDocumentCount(),
    Promise.all(
      utcDays.map(async (day) => ({
        day,
        count: await countActiveToday(db, new Date(`${day}T12:00:00.000Z`)),
      })),
    ),
    profiles.countDocuments({ 'stats.lastActiveAt': { $gte: weekAgo } }),
    profiles.countDocuments({ createdAt: { $gte: midnight }, guest: { $exists: false } }),
    profiles.countDocuments({ createdAt: { $gte: weekAgo }, guest: { $exists: false } }),
    countBuilds(db),
    countTiers(db, now),
    lastPool(db, utcToday),
    tokensPerDay(db, days, timeZone),
    readJobHealth(db),
    countSuppressions(db),
    profiles.countDocuments({ deletedAt: { $exists: true } }),
    db.collection(COLLECTIONS.analyticsDeletions).countDocuments({}),
    assistantCalls(db, utcToday),
    listCampaignProgress(db),
    getAppConfig(db),
    readPublicStats(db, now),
    dailyInZone(db, now, timeZone),
  ])

  return {
    generatedAt: now.toISOString(),
    timeZone,
    queue: { reports, appeals, feedback },
    audience: {
      profiles: profileCount,
      messages: messageCount,
      activeToday: activeDaily[activeDaily.length - 1]?.count ?? 0,
      activeDaily,
      seenLastWeek,
      joinedToday,
      joinedLastWeek,
      daily,
      builds,
    },
    money: { tiers, pool, tokensDaily },
    system: {
      jobs,
      suppressions,
      purge: { accounts: purgeAccounts, analytics: purgeAnalytics },
      assistantCallsToday,
      campaigns,
      config,
    },
    public: publicStats,
  }
}

/**
 * The plan mix, live rather than ever-sold.
 *
 * `live` is the same expression `scripts/count-paid-subscribers.ts` uses: an
 * entitlement with no expiry, or one that has not passed yet. A lapsed Pro is
 * a free account with a row about last month in it.
 */
async function countTiers(db: Db, now: Date): Promise<AdminStats['money']['tiers']> {
  const profiles = db.collection<Profile>(COLLECTIONS.profiles)
  const [total, pro, proPlus] = await Promise.all([
    profiles.countDocuments(MEMBER_FILTER),
    profiles.countDocuments(onPaidTier('pro', now)),
    profiles.countDocuments(onPaidTier('pro_plus', now)),
  ])
  return { total, pro, proPlus, free: total - pro - proPlus }
}

/** Accounts a person can be behind: not a guest, not deleted. */
const MEMBER_FILTER: Document = { guest: { $exists: false }, deletedAt: { $exists: false } }

/**
 * The members currently on a paid tier — shared with the list behind the
 * tile, so what the tile says and what the list shows cannot disagree.
 */
export function onPaidTier(tier: PlanTier, now: Date): Document {
  return {
    ...MEMBER_FILTER,
    'entitlement.tier': tier,
    $or: [
      { 'entitlement.expiresAt': { $exists: false } },
      { 'entitlement.expiresAt': { $gt: now } },
    ],
  }
}

/** Which builds people are actually on — see `Profile.stats.appVersion`. */
async function countBuilds(db: Db): Promise<AdminStats['audience']['builds']> {
  return db
    .collection<Profile>(COLLECTIONS.profiles)
    .aggregate<{ platform: string; version: string; count: number }>([
      { $match: { 'stats.appVersion': { $exists: true } } },
      {
        $group: {
          _id: { platform: '$stats.appPlatform', version: '$stats.appVersion' },
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          platform: '$_id.platform',
          version: '$_id.version',
          count: 1,
        },
      },
      { $sort: { count: -1 } },
      { $limit: 20 },
    ])
    .toArray()
}

/**
 * Yesterday's pool, or the newest one that actually ran.
 *
 * One keyed read per day against `jobRuns`'s unique `{job, periodKey}`. The
 * run record is operational rather than ledger — it can be absent for a day
 * nobody paid — so this walks back until it finds one, and gives up rather
 * than scanning.
 */
async function lastPool(db: Db, today: string): Promise<PoolResult | null> {
  const runs = db.collection<JobRun>(COLLECTIONS.jobRuns)
  for (let back = 1; back <= STATS_DAYS; back++) {
    const run = await runs.findOne({ job: DAILY_POOL_JOB, periodKey: shiftDayKey(today, -back) })
    if (run?.result) return run.result
  }
  return null
}

/**
 * Tokens awarded per day, in the operator's zone.
 *
 * The ledger's `day` is a UTC key and nothing here changes that. It is the
 * *prefilter*, which is what keeps this on the bare `day` index; the grouping
 * is on `createdAt`, which is what makes the columns local days. So the read
 * is as cheap as it was and the bars are the reader's own.
 *
 * One day either side of the window, for the same reason `readActivityWeek`
 * fetches nine documents for seven days: zone offsets run from -12 to +14, so
 * a local day never reaches past one UTC day on either side, whatever the
 * zone, and there is nothing to branch on. The rows those two edge days
 * contribute that fall outside the window are dropped by the `byDay` lookup.
 */
async function tokensPerDay(db: Db, days: string[], timeZone: string): Promise<DayCount[]> {
  const first = days[0]
  const last = days.at(-1)
  if (!first || !last) return []
  const utcDays = [shiftDayKey(first, -1), ...days, shiftDayKey(last, 1)]

  const rows = await db
    .collection(COLLECTIONS.tokenLedger)
    .aggregate<{ _id: string; count: number }>([
      { $match: { day: { $in: utcDays } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: timeZone } },
          count: { $sum: '$amount' },
        },
      },
    ])
    .toArray()
  const byDay = new Map(rows.map((row) => [row._id, row.count]))
  // Zeros included: a chart needs the gaps, and a missing day reads as missing
  // data rather than as a quiet one.
  return days.map((day) => ({ day, count: byDay.get(day) ?? 0 }))
}

/**
 * The window's new members, messages and corrections, cut in the operator's
 * zone — the three charts the panel draws.
 *
 * The same three measures over the same window as `publicStats.daily`, and
 * deliberately a second pass rather than a field added there: that module's
 * answer is one cached document served to every stranger who asks, so its days
 * have to be UTC or the same bar would hold a different number per reader.
 * This is the private copy, on the clock of the one person reading it.
 *
 * It keeps its own memory, on the public module's TTL rather than this one's
 * minute, because it is the same three collection scans that module pays for —
 * `messages` and `postCorrections` have no bare `createdAt` index — and a
 * scan should age like the other scans, not like the counts around it.
 */
let dailyMemory: { at: number; timeZone: string; daily: DailyPoint[] } | null = null

async function dailyInZone(db: Db, now: Date, timeZone: string): Promise<DailyPoint[]> {
  if (
    dailyMemory &&
    dailyMemory.timeZone === timeZone &&
    now.getTime() - dailyMemory.at < PUBLIC_STATS_TTL_MS
  ) {
    return dailyMemory.daily
  }

  const today = localDayKey(now, timeZone)
  const days = Array.from({ length: WINDOW_DAYS }, (_, i) =>
    shiftDayKey(today, i - (WINDOW_DAYS - 1)),
  )
  // When the first of those days actually began where the reader is — the cut
  // for a question asked of a timestamp, the way `profileViews` cuts its week.
  const since = localDayStart(days[0] ?? today, timeZone)

  const [members, messages, corrections] = await Promise.all([
    perDayInZone(db, COLLECTIONS.profiles, since, timeZone, MEMBER_FILTER),
    perDayInZone(db, COLLECTIONS.messages, since, timeZone, {}),
    perDayInZone(db, COLLECTIONS.postCorrections, since, timeZone, {}),
  ])

  const daily = days.map((day) => ({
    day,
    members: members.get(day) ?? 0,
    messages: messages.get(day) ?? 0,
    corrections: corrections.get(day) ?? 0,
  }))
  dailyMemory = { at: now.getTime(), timeZone, daily }
  return daily
}

/** One collection's rows per day of `timeZone`. `publicStats.perDay`, re-cut. */
async function perDayInZone(
  db: Db,
  collection: string,
  since: Date,
  timeZone: string,
  match: Document,
): Promise<Map<string, number>> {
  const rows = await db
    .collection(collection)
    .aggregate<{ _id: string; n: number }>([
      { $match: { ...match, createdAt: { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: timeZone } },
          n: { $sum: 1 },
        },
      },
    ])
    .toArray()
  return new Map(rows.map((row) => [row._id, row.n]))
}

async function countSuppressions(db: Db): Promise<AdminStats['system']['suppressions']> {
  const rows = await db
    .collection<EmailSuppression>(COLLECTIONS.emailSuppressions)
    .aggregate<{ _id: string; count: number }>([{ $group: { _id: '$reason', count: { $sum: 1 } } }])
    .toArray()
  const of = (reason: string) => rows.find((row) => row._id === reason)?.count ?? 0
  return {
    total: rows.reduce((sum, row) => sum + row.count, 0),
    unsubscribed: of('unsubscribed'),
    bounced: of('bounced'),
    complained: of('complained'),
  }
}

async function assistantCalls(db: Db, today: string): Promise<number> {
  const usage = await db
    .collection<{ _id: string; calls: number }>(COLLECTIONS.assistantUsage)
    .findOne({ _id: today })
  return usage?.calls ?? 0
}

/** Email campaigns that are not finished, so a stuck drip is visible. */
async function listCampaignProgress(db: Db): Promise<AdminStats['system']['campaigns']> {
  const rows = await db
    .collection<{ _id: string; status: string; sent?: number; total?: number }>(
      COLLECTIONS.campaignQueue,
    )
    .find({ status: { $ne: 'done' } })
    .sort({ createdAt: -1 })
    .limit(10)
    .toArray()
  return rows.map((row) => ({
    id: row._id,
    status: row.status,
    sent: row.sent ?? 0,
    total: row.total ?? 0,
  }))
}
