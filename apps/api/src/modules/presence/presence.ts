import { PRESENCE_WRITE_MIN_GAP_MS } from '@langx/shared'
import type { Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import type { Profile } from '../profiles/profiles'

/**
 * Records that someone is here, now.
 *
 * `stats.lastActiveAt` and nothing else. Until this existed the field was
 * written only when a message was sent (`tokens/awards.ts`), so "online" meant
 * "sent a message in the last five minutes" — someone who opened the app and
 * browsed for an hour was never online, and the person who closed the app
 * stayed online for five minutes after their last message rather than after
 * they left.
 */
export async function touchPresence(db: Db, userId: string, at: Date): Promise<void> {
  await db
    .collection<Profile>(COLLECTIONS.profiles)
    .updateOne({ _id: userId }, { $set: { 'stats.lastActiveAt': at } })
}

/**
 * Per-socket floor on how often presence is written.
 *
 * A heartbeat is cheap to send and not cheap to store: without this every
 * connected client is a write per interval per tab. Lives on the socket, so it
 * dies with the connection — same shape and same lifetime as
 * `SocketRateLimiter`, and injectable clock for the same reason.
 */
export class PresenceThrottle {
  readonly #now: () => number
  #lastWriteMs: number | null = null

  constructor(now: () => number = Date.now) {
    this.#now = now
  }

  /** True when enough time has passed to write again. */
  shouldWrite(): boolean {
    const now = this.#now()
    if (this.#lastWriteMs !== null && now - this.#lastWriteMs < PRESENCE_WRITE_MIN_GAP_MS) {
      return false
    }
    this.#lastWriteMs = now
    return true
  }
}
