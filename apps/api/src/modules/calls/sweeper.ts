import type { FastifyInstance } from 'fastify'
import { withJobHealth } from '../admin/jobHealth'
import { runCallSweepTick } from './service'

/**
 * How often each machine asks what time has ended.
 *
 * This is the backstop, not the clock. A ring that times out is normally ended
 * to the second by a timer on the machine that placed the call; this is for
 * the call whose machine is gone, and for the lease of a call whose devices
 * both vanished. Fifteen seconds is how late such a call can end, which nobody
 * is watching closely enough to mind — and each pass is two reads of indexes
 * that hold only live calls, so it costs nothing to ask.
 */
export const CALL_SWEEP_INTERVAL_MS = 15_000

/**
 * The app rather than the db, for `startScheduledMessageScheduler`'s reason:
 * ending a call tells sockets and writes to a thread through the same fan-out
 * a live message uses.
 *
 * Runs on every machine. There is no claim on the tick itself, because there
 * is nothing to protect: each call it ends is claimed individually, so two
 * machines sweeping the same second end each call once between them.
 */
export function startCallSweeper(
  app: FastifyInstance,
  options: { intervalMs?: number } = {},
): { stop: () => void } {
  const intervalMs = options.intervalMs ?? CALL_SWEEP_INTERVAL_MS
  let running = false

  async function tick(): Promise<void> {
    if (running) return
    running = true
    try {
      const result = await withJobHealth(app.mongo.db, 'call sweep', () =>
        runCallSweepTick(app, new Date()),
      )
      if (result.ended > 0 || result.logged > 0) app.log.info(result, 'calls swept')
    } catch (error) {
      app.log.error({ err: error }, 'call sweep failed')
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
