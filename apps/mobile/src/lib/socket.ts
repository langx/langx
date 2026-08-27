import { APP_SCHEME } from '@langx/shared'
import { Platform } from 'react-native'
import { io, type Socket } from 'socket.io-client'
import { authClient } from './auth-client'

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000'

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

/** Promise wrapper over socket.io's ack callback, with the API's error shape. */
export function emitWithAck<T>(s: Socket, event: string, payload: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    s.emit(
      event,
      payload,
      (response: { ok: boolean; data?: T; error?: { code: string; message: string } }) => {
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

export { APP_SCHEME }
