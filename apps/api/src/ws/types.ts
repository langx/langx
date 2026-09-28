import type { InAppNotificationKind } from '@langx/shared'
import type { Server as SocketIOServer, Socket } from 'socket.io'
import type { PresenceThrottle } from '../modules/presence/presence'
import type { SocketRateLimiter } from './rateLimit'

export interface SocketData {
  userId: string
  /**
   * Which installation this connection belongs to, when the client is new
   * enough to say. Absent from every build that predates it, which the chat
   * fan-out treats as "cannot tell devices apart" rather than as an error.
   */
  deviceId?: string
  /**
   * The inbox kinds this connection's client can draw, from `auth.inboxKinds`
   * — `INBOX_KINDS_V2_7` when it said nothing. The socket joins one
   * `inboxRoom` per kind, which is how `notification:new` about a kind never
   * reaches a build that would crash drawing it.
   */
  inboxKinds: readonly InAppNotificationKind[]
  /** Per-connection token buckets; see ws/rateLimit.ts. */
  limiter: SocketRateLimiter
  /** Per-connection floor on presence writes; see modules/presence. */
  presence: PresenceThrottle
}

/** Socket.io's four generics default `data` to `any` — this pins it down so `.data.userId` typechecks. */
export type AppSocket = Socket<
  Record<string, never>,
  Record<string, never>,
  Record<string, never>,
  SocketData
>
export type AppServer = SocketIOServer<
  Record<string, never>,
  Record<string, never>,
  Record<string, never>,
  SocketData
>

export function userRoom(userId: string): string {
  return `user:${userId}`
}

/**
 * The sockets of one account that can draw one inbox kind.
 *
 * A room per kind rather than a filter at emit time, because the emit crosses
 * machines through the Mongo adapter and a room is the one thing it already
 * knows how to address. `userRoom` is still every socket of the account; this
 * is the subset that may hear about `kind`.
 */
export function inboxRoom(userId: string, kind: InAppNotificationKind): string {
  return `inbox:${userId}:${kind}`
}
