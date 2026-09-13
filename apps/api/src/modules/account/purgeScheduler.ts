import type { Db } from 'mongodb'
import type { StorageProvider } from '../../storage/StorageProvider'
import type { SchedulerLogger } from '../tokens/poolScheduler'
import type { PersonDeleter } from '../analytics/personDeleter'
import { drainAnalyticsDeletions } from './analyticsDeletions'
import { purgeExpiredAccounts } from './deletion'
import { purgeStaleGuests } from '../profiles/purgeGuests'
import { withJobHealth } from '../admin/jobHealth'

/** Hourly is plenty — the grace period is 30 days, nothing here is urgent. */
export const PURGE_INTERVAL_MS = 60 * 60 * 1000

/**
 * Same shape as `startDailyPoolScheduler` and for the same reason: a question
 * asked repeatedly ("is anything past its grace period?") survives downtime,
 * where a cron firing at one instant does not. Unlike the pool this needs no
 * lock — the purge is driven by `deletedAt <= cutoff`, and a purged account no
 * longer matches, so two instances racing simply both find nothing the second
 * time.
 */
export function startPurgeScheduler(
  db: Db,
  logger: SchedulerLogger,
  options: { intervalMs?: number; storage?: StorageProvider; analytics?: PersonDeleter } = {},
): { stop: () => void } {
  const intervalMs = options.intervalMs ?? PURGE_INTERVAL_MS
  let running = false

  async function tick(): Promise<void> {
    if (running) return
    running = true
    try {
      // One record for the whole tick. Its three halves fail apart on purpose
      // (see the note on the analytics drain below), but they run or do not
      // run together, and that is what a health row is asked about.
      await withJobHealth(db, 'purge', async () => {
        const result = await purgeExpiredAccounts(db, {
          ...(options.storage ? { storage: options.storage } : {}),
        })
        if (result.purged > 0) {
          logger.info(
            { purged: result.purged, objectsDeleted: result.objectsDeleted },
            'expired accounts purged',
          )
        }

        // Guest sessions ride the same tick rather than a second scheduler: the
        // question is the same shape ("is anything past its cutoff?") and neither
        // is urgent.
        const guests = await purgeStaleGuests(db)
        if (guests.purged > 0) {
          logger.info({ purged: guests.purged }, 'stale guest sessions purged')
        }

        /*
         * The deletions the purge above recorded, plus anything an earlier tick
         * could not send. Last in the tick and after the accounts, so a PostHog
         * outage delays the analytics half and never the account half — the
         * queue exists precisely so those two can fail apart.
         *
         * Unconfigured means leave it alone, not "nothing to do": an instance
         * that gains a key later still owes what it recorded without one.
         */
        if (options.analytics) {
          const analytics = await drainAnalyticsDeletions(db, options.analytics)
          if (analytics.deleted > 0 || analytics.failed > 0) {
            logger.info(analytics, 'analytics person deletions drained')
          }
        }
        return { purged: result.purged, guests: guests.purged }
      })
    } catch (error) {
      logger.error({ err: error }, 'account purge failed')
    } finally {
      running = false
    }
  }

  void tick()
  const timer = setInterval(() => void tick(), intervalMs)
  timer.unref?.()
  return {
    stop: () => {
      clearInterval(timer)
    },
  }
}
