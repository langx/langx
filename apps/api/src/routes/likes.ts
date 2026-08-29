import { likeTargetSchema, listLikersQuerySchema } from '@langx/shared'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { requireAuth, requireVerifiedEmail } from '../middleware/requireAuth'
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
      return reply.send(await likeTarget(app.mongo.db, request.userId, request.body))
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
