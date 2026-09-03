import { newestPayableDay, shiftDayKey, utcDayKey } from '@langx/shared'
import type { Db } from 'mongodb'
import { runDailyPool } from './pool'

export interface SchedulerLogger {
  info: (obj: object, msg: string) => void
  /** For the half-failures: a pass that finished, having skipped something. */
  warn: (obj: object, msg: string) => void
  error: (obj: object, msg: string) => void
}

/** How often to check whether a closed day still needs paying out. */
export const POOL_CHECK_INTERVAL_MS = 15 * 60 * 1000

/**
 * How many closed days back to catch up on. A process that was down over a
 * weekend should still pay those days out when it returns.
 */
export const POOL_CATCH_UP_DAYS = 7

/**
 * Not a cron expression, on purpose.
 *
 * A cron fires at one instant; if the process happens to be down, restarting,
 * or mid-deploy at that instant, the day is simply never paid and nothing
 * notices. This instead asks a question every 15 minutes — "is there a payable
 * day with no `jobRuns` row?" — and answers it by running the pool. A missed
 * window self-heals on the next tick, a redeploy costs nothing, and running
 * several API instances is safe because `jobRuns`'s unique `{job, periodKey}`
 * means only one of them can own a given day (see `runDailyPool`).
 *
 * The cost of asking is one indexed lookup per payable day per quarter hour.
 *
 * **Payable is not the same as closed.** A day closes at 00:00 UTC but is not
 * paid until `TOKEN_RULES.pool.payoutHourUtc`, so the first tick after midnight
 * deliberately leaves yesterday alone. Ticking is still every 15 minutes rather
 * than once at the hour, because the self-healing property is the whole design:
 * a process that was down at 04:00 pays the day at 04:15 instead of never.
 */
export function startDailyPoolScheduler(
  db: Db,
  logger: SchedulerLogger,
  options: { intervalMs?: number; catchUpDays?: number } = {},
): { stop: () => void } {
  const intervalMs = options.intervalMs ?? POOL_CHECK_INTERVAL_MS
  const catchUpDays = options.catchUpDays ?? POOL_CATCH_UP_DAYS

  let running = false

  async function tick(): Promise<void> {
    if (running) return // a slow run must not overlap itself
    running = true
    try {
      const now = new Date()
      const today = utcDayKey(now)
      const newestPayable = newestPayableDay(now)
      // Oldest first, so a catch-up pays days out in the order they happened.
      for (let back = catchUpDays; back >= 1; back--) {
        const day = shiftDayKey(today, -back)
        // Day keys are `YYYY-MM-DD`, so this compares chronologically.
        if (day > newestPayable) continue // closed, but its payout hour has not come
        const outcome = await runDailyPool(db, { day })
        if (outcome.ran) {
          logger.info({ ...outcome.result }, 'daily token pool distributed')
        }
      }
    } catch (error) {
      // Never let a bad day kill the timer — the next tick retries, and the
      // `jobRuns` row for a day that failed mid-flight is what needs a human.
      logger.error({ err: error }, 'daily token pool run failed')
    } finally {
      running = false
    }
  }

  void tick()
  const timer = setInterval(() => void tick(), intervalMs)
  // Don't hold the process open on shutdown.
  timer.unref?.()

  return {
    stop: () => {
      clearInterval(timer)
    },
  }
}
