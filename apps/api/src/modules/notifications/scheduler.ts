import type { Db } from 'mongodb'
import type { NotificationEmailContext } from '../../email/notify'
import type { PushSender } from '../push/devices'
import type { SchedulerLogger } from '../tokens/poolScheduler'
import { runProfileVisitsEmailPass, runProfileVisitsPushPass } from './profileVisits'
import { runUnreadDigestPass } from './unreadDigest'

/**
 * Every thirty minutes, like the streak reminder — and for the same reason.
 * These passes fire on a whole local hour, and every IANA offset is a whole or
 * half hour, so a half-hourly tick catches all of them.
 */
export const NOTIFICATION_INTERVAL_MS = 30 * 60 * 1000

/**
 * One timer for the scheduled notification passes rather than one each.
 *
 * They share an interval, a `running` guard and a shutdown, and three separate
 * schedulers would be three chances for one of them to be left out of
 * `index.ts`. Each pass is caught on its own, though: a pass that throws must
 * not starve the ones after it, which is exactly what a single try/catch
 * around the sequence would do.
 */
export function startNotificationScheduler(
  db: Db,
  senders: { push: PushSender; email: NotificationEmailContext },
  logger: SchedulerLogger,
  options: { intervalMs?: number } = {},
): { stop: () => void } {
  const intervalMs = options.intervalMs ?? NOTIFICATION_INTERVAL_MS
  let running = false

  async function tick(): Promise<void> {
    if (running) return
    running = true
    const now = new Date()
    try {
      await Promise.allSettled([
        run('unread digest', () => runUnreadDigestPass(db, senders.email, now)),
        run('profile visit push', () => runProfileVisitsPushPass(db, senders.push, now)),
        run('profile visit email', () => runProfileVisitsEmailPass(db, senders.email, now)),
      ])
    } finally {
      running = false
    }
  }

  /** Each pass on its own, so one throwing does not starve the two after it. */
  async function run(name: string, pass: () => Promise<{ sent: number }>): Promise<void> {
    try {
      const { sent } = await pass()
      if (sent > 0) logger.info({ sent, pass: name }, 'notifications sent')
    } catch (error) {
      logger.error({ err: error, pass: name }, 'notification pass failed')
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
