import { shiftDayKey, utcDayKey, type AppConfig } from '@langx/shared'
import type { Db, Document } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import { getAppConfig } from '../appConfig/appConfig'
import { readJobHealth, type JobHealth } from './jobHealth'
import { countActiveToday } from '../tokens/dailyActivity'
import { DAILY_POOL_JOB, type JobRun, type PoolResult } from '../tokens/pool'
import { readPublicStats, type PublicStats } from '../insight/publicStats'
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

/** How many days the strips across the dashboard cover. */
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
  queue: {
    reports: number
    appeals: number
    feedback: number
  }
  audience: {
    /** Metadata counts, not scans — close enough for a headline, free to read. */
    profiles: number
    messages: number
    activeToday: number
    activeDaily: DayCount[]
    seenLastWeek: number
    joinedToday: number
    joinedLastWeek: number
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

let memory: { at: number; stats: AdminStats } | null = null

export async function readAdminStats(db: Db, now: Date = new Date()): Promise<AdminStats> {
  if (memory && now.getTime() - memory.at < ADMIN_STATS_TTL_MS) return memory.stats
  const stats = await computeAdminStats(db, now)
  memory = { at: now.getTime(), stats }
  return stats
}

/** For the tests, and for anything that has just written what it wants to read. */
export function forgetAdminStats(): void {
  memory = null
}

async function computeAdminStats(db: Db, now: Date): Promise<AdminStats> {
  const today = utcDayKey(now)
  const days = Array.from({ length: STATS_DAYS }, (_, i) => shiftDayKey(today, -i)).reverse()
  const weekAgo = new Date(now.getTime() - STATS_DAYS * 24 * 60 * 60 * 1000)

  const profiles = db.collection<Profile>(COLLECTIONS.profiles)
  const midnight = new Date(`${today}T00:00:00.000Z`)

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
      days.map(async (day) => ({
        day,
        count: await countActiveToday(db, new Date(`${day}T12:00:00.000Z`)),
      })),
    ),
    profiles.countDocuments({ 'stats.lastActiveAt': { $gte: weekAgo } }),
    profiles.countDocuments({ createdAt: { $gte: midnight }, guest: { $exists: false } }),
    profiles.countDocuments({ createdAt: { $gte: weekAgo }, guest: { $exists: false } }),
    countBuilds(db),
    countTiers(db, now),
    lastPool(db, today),
    tokensPerDay(db, days),
    readJobHealth(db),
    countSuppressions(db),
    profiles.countDocuments({ deletedAt: { $exists: true } }),
    db.collection(COLLECTIONS.analyticsDeletions).countDocuments({}),
    assistantCalls(db, today),
    listCampaignProgress(db),
    getAppConfig(db),
    readPublicStats(db, now),
  ])

  return {
    generatedAt: now.toISOString(),
    queue: { reports, appeals, feedback },
    audience: {
      profiles: profileCount,
      messages: messageCount,
      activeToday: activeDaily[activeDaily.length - 1]?.count ?? 0,
      activeDaily,
      seenLastWeek,
      joinedToday,
      joinedLastWeek,
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
  const live: Document = {
    $or: [
      { 'entitlement.expiresAt': { $exists: false } },
      { 'entitlement.expiresAt': { $gt: now } },
    ],
  }
  const profiles = db.collection<Profile>(COLLECTIONS.profiles)
  const member = { guest: { $exists: false }, deletedAt: { $exists: false } }
  const [total, pro, proPlus] = await Promise.all([
    profiles.countDocuments(member),
    profiles.countDocuments({ ...member, 'entitlement.tier': 'pro', ...live }),
    profiles.countDocuments({ ...member, 'entitlement.tier': 'pro_plus', ...live }),
  ])
  return { total, pro, proPlus, free: total - pro - proPlus }
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

/** Tokens awarded per day. `tokenLedger` carries a bare `day` index. */
async function tokensPerDay(db: Db, days: string[]): Promise<DayCount[]> {
  const rows = await db
    .collection(COLLECTIONS.tokenLedger)
    .aggregate<{ _id: string; count: number }>([
      { $match: { day: { $in: days } } },
      { $group: { _id: '$day', count: { $sum: '$amount' } } },
    ])
    .toArray()
  const byDay = new Map(rows.map((row) => [row._id, row.count]))
  // Zeros included: a chart needs the gaps, and a missing day reads as missing
  // data rather than as a quiet one.
  return days.map((day) => ({ day, count: byDay.get(day) ?? 0 }))
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
