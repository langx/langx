import { listNotificationsQuerySchema } from '@langx/shared'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { requireAuth } from '../middleware/requireAuth'
import {
  countUnreadNotifications,
  listNotifications,
  markNotificationsRead,
} from '../modules/notifications/inbox'
import { userRoom } from '../ws/types'

/**
 * The notification centre.
 *
 * `requireAuth` throughout, never `requireVerifiedEmail`. Reading what has
 * happened to your own account must not be blocked by a guard you might not be
 * able to pass — the same argument `DELETE /likes` makes about taking your name
 * off a list.
 */
// eslint-disable-next-line @typescript-eslint/require-await -- Fastify plugin signature
export const notificationRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/me/notifications',
    { preHandler: requireAuth, schema: { querystring: listNotificationsQuerySchema } },
    async (request, reply) => {
      return reply.send(await listNotifications(app.mongo.db, request.userId, request.query))
    },
  )

  /*
   * One number for the bell, on its own route rather than a field on the page
   * above — the same reasoning `GET /me/unread` gives. The badge has to be
   * right on the Feed tab, which never opens this list, and the list is paged
   * besides.
   */
  app.get('/me/notifications/unread', { preHandler: requireAuth }, async (request, reply) => {
    const total = await countUnreadNotifications(app.mongo.db, request.userId)
    return reply.send({ total })
  })

  app.post('/me/notifications/read', { preHandler: requireAuth }, async (request, reply) => {
    const result = await markNotificationsRead(app.mongo.db, request.userId)
    /*
     * And say so to this account's *other* devices.
     *
     * Exactly the hole `conversation:read` exists to close: a phone that
     * cleared the bell knows the number is zero, and the tablet in the next
     * room is still drawing the old one with no way of finding out. The
     * emitter is the reader's own room, so this is the one socket event whose
     * sender and audience are the same person.
     */
    app.io.to(userRoom(request.userId)).emit('notification:read', {})
    return reply.send(result)
  })
}
