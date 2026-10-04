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
  /**
   * The call protocol this connection's client speaks, from `auth.calls` —
   * absent for a build that has no calling, which is every build that said
   * nothing. Only a socket with one joins `callsRoom`, so only such a socket
   * is ever told a call is coming in.
   */
  callProtocol?: number
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

/**
 * The sockets of one account that can take a call.
 *
 * A room for `inboxRoom`'s reason: a ring crosses machines, and a room is what
 * the adapter can address. `userRoom` would reach every build on every
 * device, and a build with no call screen that was told somebody is calling
 * can do nothing with it but ignore it — while the server counts it as rung.
 */
export function callsRoom(userId: string): string {
  return `calls:${userId}`
}

/**
 * The two sockets actually in one call, and nobody else.
 *
 * Joined in exactly three places, each behind a check: the caller's socket
 * when it starts the call, the socket that wins the answer, and a socket that
 * comes back with the right resume key. Membership is then the whole of the
 * authorisation for relaying — a signal is passed on if and only if its
 * sender is in the room — which is what lets a relay cost no database read.
 */
export function callRoom(callId: string): string {
  return `call:${callId}`
}
