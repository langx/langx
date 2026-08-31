import { APP_SCHEME, SOCKET_ACK_TIMEOUT_MS } from '@langx/shared'
import { Platform } from 'react-native'
import { io, type Socket } from 'socket.io-client'
import { API_URL } from './apiUrl'
import { authClient } from './auth-client'

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

  const auth: Record<string, string> = {}
  if (Platform.OS !== 'web') {
    auth.cookie = (await authClient.getCookie()) ?? ''
  }

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
