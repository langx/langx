import type { Db } from 'mongodb'
import type { NotificationEmailContext } from '../../email/notify'
import type { PushSender } from '../push/devices'
import type { SchedulerLogger } from '../tokens/poolScheduler'
import { runBadgeRoundUpPass } from './badges'
import { runCampaignQueuePass } from './campaignQueue'
import { runDailyDigestPass } from './digest'
import { runProfileVisitsPushPass } from './profileVisits'
import { runNewsletterPass } from './newsletter'
import { runLikesRoundUpPass } from './social'
import { runPromotionsPass } from './promotions'
import { runGiftReadyPass, runPoolPayoutPass } from './wallet'
import { runVerifyReminderPass } from './verifyReminder'

/**
 * Every thirty minutes, like the streak reminder — and for the same reason.
 * These passes fire on a whole local hour, and every IANA offset is a whole or
 * half hour, so a half-hourly tick catches all of them.
 */
export const NOTIFICATION_INTERVAL_MS = 30 * 60 * 1000

/**
 * One timer for the scheduled notification passes rather than one each —
 * and for the campaign drip, which is a pass like the others with a queue
 * for its condition.
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
  options: {
    intervalMs?: number
    storagePublicBaseUrl?: string
    /**
     * Asks Better Auth to mail a fresh verification link. Left out — as the
     * tests do — the reminder simply does not run; every other pass is
     * unaffected.
     */
    resendVerification?: (email: string) => Promise<void>
  } = {},
): { stop: () => void } {
  const intervalMs = options.intervalMs ?? NOTIFICATION_INTERVAL_MS
  let running = false

  async function tick(): Promise<void> {
    if (running) return
    running = true
    const now = new Date()
    try {
      await Promise.allSettled([
        run('profile visit push', () => runProfileVisitsPushPass(db, senders.push, now)),
        run('badge round-up', () => runBadgeRoundUpPass(db, senders.push, now, logger)),
        ...(options.resendVerification
          ? [
              run('verify reminder', () =>
                runVerifyReminderPass(
                  db,
                  options.resendVerification as (email: string) => Promise<void>,
                  now,
                ),
              ),
            ]
          : []),
        run('pool payout', () => runPoolPayoutPass(db, senders.push, now)),
        run('gift ready', () => runGiftReadyPass(db, senders.push, now)),
        run('likes round-up', () => runLikesRoundUpPass(db, senders.push, now)),
        /*
         * The one notification email, and everything after it in this list is
         * marketing that must not take its slot. The digest runs at 19:00 and
         * both of those at 20:00, so the ordering is settled by the clock
         * rather than by the position here — this array is concurrent, and a
         * guarantee that rested on it would be a guarantee resting on nothing.
         */
        run('daily digest', () =>
          runDailyDigestPass(db, senders.email, now, options.storagePublicBaseUrl, logger),
        ),
        run('newsletter', () => runNewsletterPass(db, senders.email, now)),
        run('promotions', () => runPromotionsPass(db, senders, now)),
        run('campaign queue', () =>
          runCampaignQueuePass(db, senders.email, now, {
            tickMinutes: intervalMs / 60_000,
            logger,
          }),
        ),
      ])
    } finally {
      running = false
    }
  }

  /** Each pass on its own, so one throwing does not starve the two after it. */
  async function run(
    name: string,
    pass: () => Promise<{ sent: number; failed?: number }>,
  ): Promise<void> {
    try {
      const { sent, failed } = await pass()
      if (sent > 0) logger.info({ sent, pass: name }, 'notifications sent')
      if (failed) logger.warn({ failed, pass: name }, 'notifications skipped')
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
