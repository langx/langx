import type { Server as SocketIOServer, Socket } from 'socket.io'
import type { PresenceThrottle } from '../modules/presence/presence'
import type { SocketRateLimiter } from './rateLimit'

export interface SocketData {
  userId: string
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
