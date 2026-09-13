import { APP_PLATFORM_HEADER, APP_VERSION_HEADER, PRESENCE_WRITE_MIN_GAP_MS } from '@langx/shared'
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
export async function touchPresence(
  db: Db,
  userId: string,
  at: Date,
  client: ClientBuild | null = null,
): Promise<void> {
  await db.collection<Profile>(COLLECTIONS.profiles).updateOne(
    { _id: userId },
    {
      $set: {
        'stats.lastActiveAt': at,
        ...(client
          ? { 'stats.appVersion': client.appVersion, 'stats.appPlatform': client.appPlatform }
          : {}),
      },
    },
  )
}

/** Which build somebody is on, when the headers said something we recognise. */
export interface ClientBuild {
  appVersion: string
  appPlatform: 'ios' | 'android' | 'web'
}

const PLATFORMS = new Set<ClientBuild['appPlatform']>(['ios', 'android', 'web'])

/** Three numbers and two dots, at most — nothing else is a version of ours. */
const VERSION = /^\d{1,3}(\.\d{1,3}){0,2}$/

/**
 * The build behind a connection, from the two headers every request already
 * carries (`app-config.ts` reads the same pair to decide whether an update is
 * required).
 *
 * Validated rather than stored as sent. These are client headers, so anything
 * at all can arrive in them, and what this feeds is a `$group` on the admin
 * dashboard — an unbounded string there is an unbounded number of rows in a
 * chart, written by whoever felt like it. Anything unrecognised is simply not
 * recorded, which leaves the field as it was.
 */
export function clientBuildOf(
  headers: Record<string, string | string[] | undefined>,
): ClientBuild | null {
  const first = (value: string | string[] | undefined): string =>
    (Array.isArray(value) ? value[0] : value)?.trim().toLowerCase() ?? ''
  const appVersion = first(headers[APP_VERSION_HEADER])
  const appPlatform = first(headers[APP_PLATFORM_HEADER]) as ClientBuild['appPlatform']
  if (!VERSION.test(appVersion) || !PLATFORMS.has(appPlatform)) return null
  return { appVersion, appPlatform }
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
