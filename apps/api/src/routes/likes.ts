import { likeTargetSchema, listLikersQuerySchema } from '@langx/shared'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { ObjectId } from 'mongodb'
import { requireAuth, requireVerifiedEmail } from '../middleware/requireAuth'
import { likeTargetOwner, recordNotification } from '../modules/notifications/inbox'
import { likeTarget, listLikers, unlikeTarget } from '../modules/feed/likes'

/**
 * `PUT` and `DELETE`, not one toggling `POST`.
 *
 * A toggle is not idempotent, and this is HTTP: a request whose response is
 * lost gets retried, and the retry would undo the like the first attempt
 * applied. The chat reaction toggles because a socket ack makes it safe to;
 * nothing here has that guarantee. See `likeTarget`.
 */
// eslint-disable-next-line @typescript-eslint/require-await -- Fastify plugin signature
export const likeRoutes: FastifyPluginAsyncZod = async (app) => {
  // Verified, like posting: a like puts your name and avatar on a list a
  // stranger can open.
  app.put(
    '/likes',
    { preHandler: requireVerifiedEmail, schema: { body: likeTargetSchema } },
    async (request, reply) => {
      const state = await likeTarget(app.mongo.db, request.userId, request.body)
      /*
       * The first notification a like has ever produced at the moment it
       * happens.
       *
       * There is still no push here, and there must not be: a like is the
       * cheapest thing anybody can do in this app, and a post that does well
       * would be twenty buzzes about twenty taps — which is why
       * `runLikesRoundUpPass` batches them to one a day. The inbox is the
       * other half of that ruling. Nothing interrupts, so every like can have
       * its row, and the daily push stays exactly as it was.
       *
       * Not awaited, and never allowed to throw: the like is already written.
       */
      void (async () => {
        const owner = await likeTargetOwner(
          app.mongo.db,
          request.body.targetType,
          new ObjectId(request.body.targetId),
        )
        if (!owner) return
        await recordNotification(
          app.mongo.db,
          {
            userId: owner.authorId,
            kind: 'like',
            /*
             * One row per person per thing, for good. Unliking and liking
             * again is a tap, not news, and `createdAt` staying at the first
             * one is correct — that is when it happened.
             */
            refId: `${request.body.targetType}:${request.body.targetId}:${request.userId}`,
            actorId: request.userId,
            postId: owner.postId,
          },
          { io: app.io, logger: app.log },
        )
      })().catch((error: unknown) => {
        request.log.error({ err: error }, 'like notification failed')
      })
      return reply.send(state)
    },
  )

  // Plain `requireAuth` on the undo. Taking your name off a list must never be
  // blocked by a guard that could leave you stranded on it.
  app.delete(
    '/likes',
    { preHandler: requireAuth, schema: { body: likeTargetSchema } },
    async (request, reply) => {
      return reply.send(await unlikeTarget(app.mongo.db, request.userId, request.body))
    },
  )

  app.get(
    '/likes',
    { preHandler: requireAuth, schema: { querystring: listLikersQuerySchema } },
    async (request, reply) => {
      return reply.send(await listLikers(app.mongo.db, request.userId, request.query))
    },
  )
}
