import { APP_SCHEME, SOCKET_ACK_TIMEOUT_MS } from '@langx/shared'
import { Platform } from 'react-native'
import { io, type Socket } from 'socket.io-client'
import { API_URL } from './apiUrl'
import { authClient } from './auth-client'
import { deviceId } from './deviceId'

let socket: Socket | null = null

/**
 * One socket for the whole app, not one per chat screen.
 *
 * The server puts every client in a single `user:<id>` room, so one connection
 * already receives every conversation's events — opening a socket per screen
 * would multiply connections for no extra delivery, and leak them on fast
 * navigation.
 *
 * Auth mirrors `apiFetch`: the browser attaches the session cookie to the
 * WebSocket handshake by itself, while native has no cookie jar and must pass
 * the value explicitly. It goes in `auth`, not a header, because React Native
 * cannot set headers on this transport.
 */
export async function getSocket(): Promise<Socket> {
  if (socket?.connected) return socket

  /*
   * `active` is socket.io's own word for "still trying", and it goes false for
   * good when a *middleware* error refuses the handshake — an expired session,
   * or the server's auth lookup having a bad second. The client stops
   * reconnecting at that point and nothing here noticed: the check above only
   * asks whether the socket is connected, so every later call was handed the
   * dead one back. Realtime stayed dead until the app was force-quit, and
   * every message typed meanwhile waited out its ack timeout and turned red.
   * Throwing it away is enough; the lines below build a fresh one, with a
   * cookie read fresh as well, which is the other half of an expired session.
   */
  if (socket && !socket.active) {
    socket.close()
    socket = null
  }

  const auth: Record<string, string> = {}
  if (Platform.OS !== 'web') {
    auth.cookie = (await authClient.getCookie()) ?? ''
  }
  /*
   * Which phone is holding this connection, on both platforms.
   *
   * The server used to know only *that* the account had a socket, and skipped
   * the push notification for every one of its devices on the strength of it —
   * so the phone you had open silenced the one in your pocket. With this it
   * can push to the devices that are not here.
   */
  auth.deviceId = await deviceId()

  socket ??= io(API_URL, {
    auth,
    transports: ['websocket'],
    autoConnect: true,
  })
  return socket
}

export function closeSocket(): void {
  socket?.close()
  socket = null
}

/**
 * Starts the one socket over without losing the handlers `useSocket` hung on
 * it.
 *
 * A tunnel does not close a connection, it stops carrying it — so socket.io
 * goes on believing it is connected until its own ping times out, which the
 * server's defaults put at 45 seconds. Measured: 45.1. The OS knows within a
 * second, and this is what turns that knowledge into a working connection
 * instead of a socket that is quietly writing into a pipe nobody is reading.
 *
 * `disconnect()` and `connect()` in the same tick, deliberately: in between
 * them the socket is `!active`, which is the exact state `getSocket()` throws a
 * socket away for, and nothing can observe it because nothing here awaits. The
 * app's own listeners survive — socket.io's `destroy()` drops the manager's
 * subscriptions, not the events the app registered.
 */
export function restartSocket(): void {
  if (!socket) return
  socket.disconnect()
  socket.connect()
}

/**
 * Promise wrapper over socket.io's ack callback, with the API's error shape.
 *
 * `.timeout()` is not optional decoration. Without it socket.io registers the
 * ack with no timer, and `_clearAcks` on close only invokes handlers that were
 * created with one — so a connection dying after the frame is sent but before
 * the ack returns left this promise unsettled *forever*. The caller's
 * `finally` never ran, `sending` stayed true, and the send button was disabled
 * until the reader left the screen.
 */
export function emitWithAck<T>(s: Socket, event: string, payload: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    s.timeout(SOCKET_ACK_TIMEOUT_MS).emit(
      event,
      payload,
      (
        timeout: Error | null,
        response?: { ok: boolean; data?: T; error?: { code: string; message: string } },
      ) => {
        if (timeout || !response) {
          reject(Object.assign(new Error('ack timed out'), { code: ACK_TIMEOUT }))
          return
        }
        if (response.ok) resolve(response.data as T)
        else
          reject(
            Object.assign(new Error(response.error?.message ?? 'failed'), {
              code: response.error?.code,
            }),
          )
      },
    )
  })
}

/** The code an ack timeout rejects with, so callers can word it as "not sent". */
export const ACK_TIMEOUT = 'ACK_TIMEOUT'

export { APP_SCHEME }
