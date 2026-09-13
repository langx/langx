import type { Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'

/**
 * When each scheduled pass last ran, and whether it worked.
 *
 * Two of the schedulers already leave a trace — `dailyPool` and
 * `campaignQueue` write to `jobRuns` — but that collection's unique
 * `{job, periodKey}` is a **lock**: the first inserter owns the tick. Giving
 * the other passes a row there would hand them lock semantics they were never
 * written for, and quietly change which instance runs what.
 *
 * So this is a record and only a record. One document per job, keyed by its
 * name, overwritten every run. It grants nothing, guards nothing, and cannot
 * change behaviour by being absent — which is the point, because it wraps
 * passes that must keep working if this write fails.
 *
 * It exists because the alternative is what we had: a pass that stops firing
 * says nothing at all, and the first sign is somebody asking why they stopped
 * getting streak reminders.
 */
export interface JobHealth {
  /** The pass's name, as the scheduler calls it. */
  _id: string
  lastStartedAt: Date
  lastFinishedAt?: Date
  lastDurationMs?: number
  /** Whatever the pass returned, when that was an object — usually `{ sent }`. */
  lastResult?: Record<string, unknown>
  /** The message from the last run that threw, cleared by the next that does not. */
  lastError?: string | null
  /** Runs since this collection existed, failed ones included. */
  runs: number
  failures: number
}

/**
 * Runs a pass and records what happened to it.
 *
 * Rethrows, so the caller's own error handling is unchanged — every scheduler
 * already catches, logs and carries on, and this must not take that over. Its
 * own writes are swallowed: a health record that could fail a healthy job
 * would be worse than no health record at all.
 */
export async function withJobHealth<T>(db: Db, job: string, pass: () => Promise<T>): Promise<T> {
  const startedAt = new Date()

  try {
    const result = await pass()
    await record(db, job, startedAt, {
      lastResult: isRecord(result) ? result : {},
      // Cleared rather than left behind: this describes the last run, and a
      // stale error beside a fresh success reads as a job still broken.
      lastError: null,
    })
    return result
  } catch (error) {
    await record(db, job, startedAt, {
      lastError: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}

async function record(
  db: Db,
  job: string,
  startedAt: Date,
  outcome: { lastResult?: Record<string, unknown>; lastError: string | null },
): Promise<void> {
  const finishedAt = new Date()
  try {
    await db.collection<JobHealth>(COLLECTIONS.jobHealth).updateOne(
      { _id: job },
      {
        $set: {
          lastStartedAt: startedAt,
          lastFinishedAt: finishedAt,
          lastDurationMs: finishedAt.getTime() - startedAt.getTime(),
          ...(outcome.lastResult ? { lastResult: outcome.lastResult } : {}),
          lastError: outcome.lastError,
        },
        $inc: { runs: 1, failures: outcome.lastError === null ? 0 : 1 },
      },
      { upsert: true },
    )
  } catch {
    // Deliberately silent. See the note above the interface.
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Every job that has ever run, stalest first. */
export async function readJobHealth(db: Db): Promise<JobHealth[]> {
  return db
    .collection<JobHealth>(COLLECTIONS.jobHealth)
    .find({})
    .sort({ lastFinishedAt: 1 })
    .toArray()
}
