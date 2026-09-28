import {
  acceptedInboxKinds,
  ERROR_CODES,
  INBOX_KINDS_HEADER,
  listNotificationsQuerySchema,
  markNotificationsReadSchema,
} from '@langx/shared'
import type { FastifyRequest } from 'fastify'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { ObjectId } from 'mongodb'
import { ApiError } from '../lib/ApiError'
import { requireAuth } from '../middleware/requireAuth'
import {
  countUnreadNotifications,
  listNotifications,
  markNotificationsRead,
} from '../modules/notifications/inbox'
import { sendTraySync } from '../ws/traySync'
import { inboxRoom } from '../ws/types'

/**
 * The kinds this request's client can draw.
 *
 * Read on every route here, the reads included, because the three answers
 * have to agree: a bell counting a row the list will not show, or a "Mark all
 * read" reaching one, is the list and the badge disagreeing again. A request
 * without the header is a build from 2.7 or before. See `INBOX_KINDS_V2_7`.
 */
function kindsOf(request: FastifyRequest) {
  return acceptedInboxKinds(request.headers[INBOX_KINDS_HEADER])
}

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
      return reply.send(
        await listNotifications(app.mongo.db, request.userId, request.query, kindsOf(request)),
      )
    },
  )

  /*
   * One number for the bell, on its own route rather than a field on the page
   * above — the same reasoning `GET /me/unread` gives. The badge has to be
   * right on the Feed tab, which never opens this list, and the list is paged
   * besides.
   */
  app.get('/me/notifications/unread', { preHandler: requireAuth }, async (request, reply) => {
    const total = await countUnreadNotifications(app.mongo.db, request.userId, kindsOf(request))
    return reply.send({ total })
  })

  /**
   * One row, or all of them.
   *
   * Opening the centre marks nothing — somebody who came to check one name has
   * not dealt with the other eleven, and clearing them on their behalf throws
   * away the only record of what they have not looked at. So the client sends
   * an `id` when a row is opened, and none when the header button is pressed.
   */
  app.post(
    '/me/notifications/read',
    /*
     * `.optional()`, because "read everything" sends no body at all and an
     * object schema rejects a missing one outright — a 400 on the plainest
     * call the route has.
     */
    { preHandler: requireAuth, schema: { body: markNotificationsReadSchema.optional() } },
    async (request, reply) => {
      let only: ObjectId | undefined
      if (request.body?.id) {
        try {
          only = new ObjectId(request.body.id)
        } catch {
          throw new ApiError(ERROR_CODES.VALIDATION_FAILED, 'Malformed notification id')
        }
      }
      const { kinds, ...result } = await markNotificationsRead(
        app.mongo.db,
        request.userId,
        kindsOf(request),
        only,
      )
      /*
       * And say so to this account's *other* devices.
       *
       * Exactly the hole `conversation:read` exists to close: a phone that
       * cleared the bell knows the number is zero, and the tablet in the next
       * room is still drawing the old one with no way of finding out. The
       * emitter is the reader's own room, so this is the one socket event whose
       * sender and audience are the same person.
       *
       * Addressed to the rooms of the kinds the read could have touched, not
       * to the whole account: a build that cannot draw a `commentReply` has
       * nothing to refetch when one is read, and on a single row that read
       * nothing, there is nobody to tell.
       */
      if (kinds.length > 0) {
        app.io
          .to(kinds.map((kind) => inboxRoom(request.userId, kind)))
          .emit('notification:read', {})
      }
      // And the phones with no socket to hear that on. See `ws/traySync.ts`.
      if (result.read > 0) void sendTraySync(app, request.userId)
      return reply.send(result)
    },
  )
}
