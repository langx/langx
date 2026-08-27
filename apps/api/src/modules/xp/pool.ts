import { XP_RULES, activityScore, poolShare, shiftDayKey, utcDayKey } from '@langx/shared'
import { MongoServerError, type Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import type { Profile } from '../profiles/profiles'
import { countersOf, type DailyActivity } from './dailyActivity'
import { awardXp } from './ledger'

export interface JobRun {
  job: string
  periodKey: string
  startedAt: Date
  finishedAt?: Date
  result?: PoolResult
}

export interface PoolResult {
  day: string
  /** Users with activity that day, before eligibility filtering. */
  active: number
  /** Users who actually received a share. */
  paid: number
  distributed: number
  totalScore: number
  /** Excluded because the account was younger than the ramp-up at day close. */
  skippedNewAccounts: number
  skippedFrozen: number
}

export type RunPoolOutcome =
  | { ran: true; result: PoolResult }
  | { ran: false; reason: 'already-ran'; result: PoolResult | null }

function isDuplicateKeyError(error: unknown, indexName: string): boolean {
  return (
    error instanceof MongoServerError && error.code === 11000 && error.message.includes(indexName)
  )
}

/** Midnight UTC at the end of `day` — the instant the day's activity is final. */
function dayCloseAt(day: string): Date {
  return new Date(`${shiftDayKey(day, 1)}T00:00:00.000Z`)
}

export const DAILY_POOL_JOB = 'dailyPool'

/**
 * Distributes one day's XP pool, proportional to each participant's activity
 * score and clamped to `maxShareOfPool` per user.
 *
 * **Two independent defences against paying twice**, because a cron that
 * double-fires is not a hypothetical:
 *
 * 1. `jobRuns`'s unique `{job, periodKey}` — the first caller to insert owns
 *    the day; a duplicate key means someone else already has it, so this call
 *    returns without distributing anything.
 * 2. every award carries `refId: <day>` with `kind: 'dailyPool'`, so even if
 *    the lock were bypassed entirely (a manual re-run against a wiped
 *    `jobRuns`, say) the ledger's unique index still refuses the second
 *    payment. The lock avoids the work; the ledger guarantees the outcome.
 *
 * The pool is deliberately *relative*: a share depends on how active everyone
 * else was, which is what keeps the table worth watching.
 */
export async function runDailyPool(
  db: Db,
  options: { day?: string; now?: Date } = {},
): Promise<RunPoolOutcome> {
  const now = options.now ?? new Date()
  // Default to yesterday: today's activity is still accumulating.
  const day = options.day ?? shiftDayKey(utcDayKey(now), -1)

  const jobRuns = db.collection<JobRun>(COLLECTIONS.jobRuns)
  try {
    await jobRuns.insertOne({ job: DAILY_POOL_JOB, periodKey: day, startedAt: now })
  } catch (error) {
    if (isDuplicateKeyError(error, 'job_period_unique')) {
      const existing = await jobRuns.findOne({ job: DAILY_POOL_JOB, periodKey: day })
      return { ran: false, reason: 'already-ran', result: existing?.result ?? null }
    }
    throw error
  }

  const activities = await db
    .collection<DailyActivity>(COLLECTIONS.dailyActivity)
    .find({ day })
    .toArray()

  const closedAt = dayCloseAt(day)
  const rampUpMs = XP_RULES.pool.accountAgeRampUpHours * 60 * 60 * 1000
  const profiles = db.collection<Profile>(COLLECTIONS.profiles)

  const eligible: { userId: string; score: number }[] = []
  let skippedNewAccounts = 0
  let skippedFrozen = 0

  for (const activity of activities) {
    const profile = await profiles.findOne(
      { _id: activity.userId },
      { projection: { createdAt: 1, xpFrozenAt: 1, deletedAt: 1 } },
    )
    if (!profile || profile.deletedAt) continue
    if (profile.xpFrozenAt) {
      skippedFrozen++
      continue
    }
    // Ramp-up: a brand new account earns no pool share, so churning throwaway
    // accounts through a day's activity is not a strategy.
    if (closedAt.getTime() - new Date(profile.createdAt).getTime() < rampUpMs) {
      skippedNewAccounts++
      continue
    }
    const score = activityScore(countersOf(activity))
    if (score > 0) eligible.push({ userId: activity.userId, score })
  }

  const totalScore = eligible.reduce((sum, e) => sum + e.score, 0)

  let distributed = 0
  let paid = 0
  for (const { userId, score } of eligible) {
    const amount = poolShare(score, totalScore)
    const award = await awardXp(db, {
      userId,
      kind: 'dailyPool',
      amount,
      refId: day,
      at: closedAt,
    })
    if (award.awarded) {
      distributed += award.amount
      paid++
    }
  }

  const result: PoolResult = {
    day,
    active: activities.length,
    paid,
    distributed,
    totalScore,
    skippedNewAccounts,
    skippedFrozen,
  }
  await jobRuns.updateOne(
    { job: DAILY_POOL_JOB, periodKey: day },
    { $set: { finishedAt: new Date(), result } },
  )

  return { ran: true, result }
}
