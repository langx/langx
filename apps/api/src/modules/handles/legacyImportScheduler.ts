import type { Db } from 'mongodb'
import type { SchedulerLogger } from '../tokens/poolScheduler'
import { sweepLegacyImports } from './legacyConversations'

/**
 * Slow on purpose. The fast path is the restore hook, which imports a
 * returning user's threads inside the sign-in that brought them back; this
 * only exists to catch what that path dropped, and a thread arriving a few
 * minutes late is invisible next to one that has been waiting two years.
 */
export const LEGACY_IMPORT_INTERVAL_MS = 10 * 60 * 1000

/**
 * Same shape as the pool and purge sweeps, and needs no lock for the same
 * reason the purge does not: the work is claimed by a conditional update on
 * the room, so two instances racing simply find nothing the second time.
 */
export function startLegacyImportScheduler(
  db: Db,
  logger: SchedulerLogger,
  options: { intervalMs?: number; limit?: number } = {},
): { stop: () => void } {
  const intervalMs = options.intervalMs ?? LEGACY_IMPORT_INTERVAL_MS
  let running = false

  async function tick(): Promise<void> {
    if (running) return
    running = true
    try {
      const result = await sweepLegacyImports(db, {
        ...(options.limit !== undefined ? { limit: options.limit } : {}),
      })
      if (result.conversationsImported > 0) {
        logger.info(
          {
            conversations: result.conversationsImported,
            messages: result.messagesImported,
          },
          'v1 conversations imported',
        )
      }
    } catch (error) {
      logger.error({ err: error }, 'legacy conversation import failed')
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
