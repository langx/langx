import {
  IN_APP_NOTIFICATION_KINDS,
  TRAY_SYNC_KIND,
  TRAY_SYNC_MAX_THREADS,
  type TraySync,
} from '@langx/shared'
import type { FastifyInstance } from 'fastify'
import type { Db } from 'mongodb'
import { countUnread, unreadThreadIds } from '../modules/chat/messages'
import { countUnreadNotifications } from '../modules/notifications/inbox'
import { devicesFor, devicesToPush, sendSilentPush } from '../modules/push/devices'
import { userRoom } from './types'

/**
 * What this reader has left unread, as the silent push states it.
 *
 * `at` is taken before the reads, not after. A message push delivered before
 * `at` belongs to a message written before the queries below ran, so its
 * thread is in the list if it is still unread; one delivered after `at` is
 * never touched by this sync at all. See `TraySync`.
 */
export async function traySyncFor(
  db: Db,
  userId: string,
  now: Date = new Date(),
): Promise<TraySync> {
  const [unread, threads, inboxUnread] = await Promise.all([
    countUnread(db, userId),
    // One over the limit, to know the list would have been cut short.
    unreadThreadIds(db, userId, TRAY_SYNC_MAX_THREADS + 1),
    /*
     * Every kind, whatever the phones can draw. This goes to devices with no
     * socket, so nothing says which JavaScript they run — and it carries no
     * row and no number, only whether the pushes about the centre may leave
     * the shade. Counting every kind can only keep a push there too long: a
     * 2.7 phone keeps its `social` pushes while a `commentReply` it cannot
     * show is unread, until its own sweep on the next open — which asks as
     * 2.7 does, row by row — clears the ones whose rows it has read. Counting
     * fewer could clear a newer phone's push about a row nobody has read,
     * which is the worse mistake.
     */
    countUnreadNotifications(db, userId, IN_APP_NOTIFICATION_KINDS),
  ])
  return {
    kind: TRAY_SYNC_KIND,
    at: now.getTime(),
    unread,
    ...(threads.length <= TRAY_SYNC_MAX_THREADS ? { unreadThreads: threads } : {}),
    inboxClear: inboxUnread === 0,
  }
}

/**
 * Tells this reader's other phones that something was read, so the
 * notifications for it leave their shades even while the app is closed.
 *
 * Only the devices without a socket. One holding a socket already had
 * `conversation:read` or `notification:read` and cleared itself; a silent
 * push to it would only spend its share of the few background pushes iOS
 * allows an hour. A socket too old to name its device cannot be excluded, and
 * gets one it does not need, which costs nothing.
 *
 * Called without awaiting by every read route, and never throws: a sync that
 * fails leaves the next app open to catch up, and must not fail the read.
 */
export async function sendTraySync(app: FastifyInstance, userId: string): Promise<void> {
  try {
    if (!app.push.sendSilent) return
    const at = new Date()
    const sockets = await app.io.in(userRoom(userId)).fetchSockets()
    const connected = sockets.flatMap((socket) =>
      socket.data.deviceId ? [socket.data.deviceId] : [],
    )
    const tokens = devicesToPush(await devicesFor(app.mongo.db, userId), connected)
    if (tokens.length === 0) return
    await sendSilentPush(app.mongo.db, app.push, {
      to: tokens,
      data: await traySyncFor(app.mongo.db, userId, at),
    })
  } catch (error) {
    app.log.warn({ err: error }, 'tray sync push failed')
  }
}
