import { SOCIAL_AUTOPOST_RULES } from '@langx/shared'
import type { FastifyBaseLogger } from 'fastify'
import type { Db } from 'mongodb'
import { withJobHealth } from '../admin/jobHealth'
import { getAppConfig } from '../appConfig/appConfig'
import { SOCIAL_CREDENTIALS, type SocialAdapters } from './adapters'
import {
  claimDueSocialPost,
  deferSocialPost,
  failStaleSocialClaims,
  markSocialFailed,
  markSocialPublished,
  type SocialPost,
} from './posts'
import { SocialPublishError } from './publish'

/** Once a minute, like scheduled messages: a 12:30 post should not go out at 12:45. */
export const SOCIAL_AUTOPOST_INTERVAL_MS = 60 * 1000

/**
 * The most rows one pass takes. A calendar day is four; this leaves room for
 * a day's retries without letting one pass, which waits on each platform's
 * processing, run for an hour.
 */
const MAX_PER_PASS = 8

const MINUTE = 60 * 1000

export interface SocialAutopostResult {
  /** `flags.socialAutopost` was off, and nothing was looked at. */
  off?: true
  published: number
  failed: number
  retrying: number
}

/**
 * Posts one claimed row, or records why not.
 *
 * In order: too late, not connected, then the platform. Too late comes first
 * because a row that should not go out should not go out whatever else is
 * true of it.
 */
async function publishClaimed(
  db: Db,
  adapters: SocialAdapters,
  row: SocialPost,
  clock: () => Date,
): Promise<'published' | 'failed' | 'retrying'> {
  const now = clock()
  const lateMs = now.getTime() - row.dueAt.getTime()
  if (lateMs > SOCIAL_AUTOPOST_RULES.maxLateMinutes * MINUTE) {
    await markSocialFailed(
      db,
      row._id,
      `Missed: due ${row.dueAt.toISOString()}, and more than ${SOCIAL_AUTOPOST_RULES.maxLateMinutes / 60} hours had passed when it was picked up. Retry posts it now.`,
      now,
    )
    return 'failed'
  }

  const adapter = adapters[row.platform]
  if (!adapter) {
    await markSocialFailed(
      db,
      row._id,
      `Not connected: set ${SOCIAL_CREDENTIALS[row.platform].join(', ')} on the API.`,
      now,
    )
    return 'failed'
  }

  try {
    const result = await adapter.publish({
      videoUrl: row.videoUrl,
      coverUrl: row.coverUrl,
      lang: row.lang,
      content: row.content,
      firstComment: row.firstComment,
    })
    await markSocialPublished(db, row._id, result, clock())
    return 'published'
  } catch (caught) {
    // Anything not shaped by an adapter is a bug somewhere in one, at a point
    // nobody can name — so it is treated as the dangerous kind.
    const retryable = caught instanceof SocialPublishError && caught.retryable
    const message = caught instanceof Error ? caught.message : String(caught)
    if (retryable && row.attempts < SOCIAL_AUTOPOST_RULES.maxAttempts) {
      const waits = SOCIAL_AUTOPOST_RULES.backoffMinutes
      const wait = waits[Math.min(row.attempts, waits.length) - 1] ?? 5
      const at = clock()
      await deferSocialPost(db, row._id, message, new Date(at.getTime() + wait * MINUTE), at)
      return 'retrying'
    }
    await markSocialFailed(db, row._id, message, clock())
    return 'failed'
  }
}

/**
 * One pass: fail the claims that died, then claim and post what is due.
 *
 * Split from the timer so a test can drive a pass at a chosen `now`, and run
 * two at once to show a row is posted once.
 */
export async function runSocialAutopostTick(
  db: Db,
  adapters: SocialAdapters,
  log: Pick<FastifyBaseLogger, 'error'>,
  now: Date = new Date(),
): Promise<SocialAutopostResult> {
  const result: SocialAutopostResult = { published: 0, failed: 0, retrying: 0 }

  // The kill switch, read every pass. Off, not even the stale claims are
  // touched: off means this module does nothing at all.
  const config = await getAppConfig(db)
  if (!config.flags.socialAutopost) return { ...result, off: true }

  result.failed += await failStaleSocialClaims(db, now)

  // `now` is when the pass began, and a pass that waits on four platforms'
  // processing runs for minutes. Each claim is stamped with the time it is
  // really taken: one stamped with the pass's start would look stale to the
  // other machine's pass while it is still uploading.
  const started = Date.now()
  const clock = () => new Date(now.getTime() + (Date.now() - started))

  for (let i = 0; i < MAX_PER_PASS; i++) {
    const row = await claimDueSocialPost(db, clock())
    if (!row) break
    try {
      result[await publishClaimed(db, adapters, row, clock)]++
    } catch (error) {
      // The database, not the platform. The row stays claimed and is failed
      // by `failStaleSocialClaims` — it may have posted before this threw.
      log.error({ err: error, socialPostId: row._id.toHexString() }, 'social post not recorded')
    }
  }
  return result
}

export function startSocialAutopostScheduler(
  db: Db,
  adapters: SocialAdapters,
  log: FastifyBaseLogger,
  options: { intervalMs?: number } = {},
): { stop: () => void } {
  const intervalMs = options.intervalMs ?? SOCIAL_AUTOPOST_INTERVAL_MS
  let running = false

  async function tick(): Promise<void> {
    if (running) return
    running = true
    try {
      const result = await withJobHealth(db, 'social autopost', () =>
        runSocialAutopostTick(db, adapters, log, new Date()),
      )
      if (result.published > 0 || result.failed > 0 || result.retrying > 0) {
        log.info(result, 'social posts')
      }
    } catch (error) {
      log.error({ err: error }, 'social autopost run failed')
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
