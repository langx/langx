import { TOKEN_RULES, activityScore, poolShare, shiftDayKey, utcDayKey } from '@langx/shared'
import { MongoServerError, type Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import type { Profile } from '../profiles/profiles'
import { countersOf, type DailyActivity } from './dailyActivity'
import { awardTokens, type TokenLedgerEntry } from './ledger'

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
 * How long a lock may sit without a `finishedAt` before it is treated as the
 * wreckage of a run that died rather than as a run still going.
 *
 * A whole pool pass is a few seconds even on a busy day, so half an hour is
 * not a judgement call about how slow a healthy run can be — it is long enough
 * that nothing healthy is anywhere near it, and short enough that a day
 * recovers within the same morning.
 */
export const POOL_LOCK_STALE_MS = 30 * 60 * 1000

/**
 * Clears a lock left behind by a run that died partway.
 *
 * `runDailyPool` writes its lock *before* it does any work, which is what
 * makes the lock a lock. The cost is that a throw anywhere after it — the
 * profile read, an award, a dropped connection — leaves a row with no
 * `finishedAt`, and every later tick then reads that row as "someone already
 * owns this day" and returns without paying it. Nothing retried, nothing
 * alerted: the day was simply never distributed, for everybody, permanently.
 *
 * Deleting the row is safe because it is not what prevents double payment.
 * Every award carries `refId: <day>` under a unique index, so a day that was
 * half paid before the crash pays out only the rest on the retry — the lock
 * saves the work, the ledger guarantees the outcome (see `runDailyPool`).
 *
 * The delete is conditional on `finishedAt` still being absent, so it cannot
 * race a run that completed in the meantime.
 */
async function clearStaleLock(db: Db, day: string, now: Date): Promise<boolean> {
  const result = await db.collection<JobRun>(COLLECTIONS.jobRuns).deleteOne({
    job: DAILY_POOL_JOB,
    periodKey: day,
    finishedAt: { $exists: false },
    startedAt: { $lt: new Date(now.getTime() - POOL_LOCK_STALE_MS) },
  })
  return result.deletedCount > 0
}

/**
 * Distributes one day's token pool, proportional to each participant's activity
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
    if (!isDuplicateKeyError(error, 'job_period_unique')) throw error

    // Somebody owns the day. Either they finished it, they are working on it
    // right now, or they died holding it — and only the last of those should
    // let this call proceed.
    if (!(await clearStaleLock(db, day, now))) {
      const existing = await jobRuns.findOne({ job: DAILY_POOL_JOB, periodKey: day })
      return { ran: false, reason: 'already-ran', result: existing?.result ?? null }
    }
    try {
      await jobRuns.insertOne({ job: DAILY_POOL_JOB, periodKey: day, startedAt: now })
    } catch (retryError) {
      // Another instance cleared the same corpse first and took the day.
      if (!isDuplicateKeyError(retryError, 'job_period_unique')) throw retryError
      const existing = await jobRuns.findOne({ job: DAILY_POOL_JOB, periodKey: day })
      return { ran: false, reason: 'already-ran', result: existing?.result ?? null }
    }
  }

  const activities = await db
    .collection<DailyActivity>(COLLECTIONS.dailyActivity)
    .find({ day })
    .toArray()

  const closedAt = dayCloseAt(day)
  const rampUpMs = TOKEN_RULES.pool.accountAgeRampUpHours * 60 * 60 * 1000
  const profiles = db.collection<Profile>(COLLECTIONS.profiles)

  const eligible: { userId: string; score: number }[] = []
  let skippedNewAccounts = 0
  let skippedFrozen = 0

  /*
   * One query for every active user, not one per user.
   *
   * The per-user `findOne` this replaces was the longest-running thing in the
   * pass and therefore the likeliest place for it to die — which mattered more
   * than the latency did, because a death here used to poison the day's lock
   * permanently (see `clearStaleLock`).
   */
  const eligibility = new Map(
    (
      await profiles
        .find(
          { _id: { $in: activities.map((activity) => activity.userId) } },
          { projection: { createdAt: 1, tokenFrozenAt: 1, deletedAt: 1 } },
        )
        .toArray()
    ).map((profile) => [profile._id, profile]),
  )

  for (const activity of activities) {
    const profile = eligibility.get(activity.userId)
    if (!profile || profile.deletedAt) continue
    if (profile.tokenFrozenAt) {
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
    const award = await awardTokens(db, {
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

/**
 * The most recent pool share credited to one user, or null if they have never
 * been paid one.
 *
 * Sorted by `refId`, not `day` or `createdAt`, for two reasons. `refId` is the
 * day the share was *earned for*, which is the day the app shows it against —
 * a pool row's own `day` is already the morning after, because `awardTokens`
 * files it at `dayCloseAt`. And `{userId, kind, refId}` is the unique index
 * that guards double payment, so sorting on its third key makes this a walk of
 * one index rather than a scan and a sort. Day keys are `YYYY-MM-DD`, so
 * lexicographic descending is chronological descending.
 */
export async function readLastPoolPayout(
  db: Db,
  userId: string,
): Promise<{ day: string; amount: number } | null> {
  const row = await db
    .collection<TokenLedgerEntry>(COLLECTIONS.tokenLedger)
    .findOne({ userId, kind: 'dailyPool' }, { sort: { refId: -1 } })

  // `refId` is always written for a pool award, but the type allows its
  // absence and a row without one has no day to be shown against.
  return row?.refId ? { day: row.refId, amount: row.amount } : null
}
