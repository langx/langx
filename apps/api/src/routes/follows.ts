import { listFollowsQuerySchema } from '@langx/shared'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { requireAuth, requireVerifiedEmail } from '../middleware/requireAuth'
import { recordNotification } from '../modules/notifications/inbox'
import { notifyFollowed } from '../modules/notifications/social'
import { followUser, listFollowers, listFollowing, unfollowUser } from '../modules/social/follows'

const userParamsSchema = z.object({ userId: z.string().trim().min(1) })

// eslint-disable-next-line @typescript-eslint/require-await -- Fastify plugin signature
export const followRoutes: FastifyPluginAsyncZod = async (app) => {
  // Verified, like posting: following puts your name and avatar on a list a
  // stranger can open, which is the same reachability argument `POST /posts`
  // makes.
  app.post(
    '/profiles/:userId/follow',
    { preHandler: requireVerifiedEmail, schema: { params: userParamsSchema } },
    async (request, reply) => {
      const state = await followUser(app.mongo.db, request.userId, request.params.userId)
      /*
       * Not awaited: the follow is written, and a push service having a bad
       * minute must not turn it into a 500. `notifyFollowed` claims the
       * ledger row itself, so following, unfollowing and following again is
       * one notification rather than three.
       */
      void notifyFollowed(
        app.mongo.db,
        { push: app.push, logger: app.log },
        { followerId: request.userId, followeeId: request.params.userId },
      ).catch((error: unknown) => {
        request.log.error({ err: error }, 'follow push failed')
      })
      /*
       * And the row that outlives the push. The notification centre is
       * ungated on purpose — somebody who turned social push off asked not to
       * be buzzed, not to be kept from ever finding out.
       */
      void recordNotification(
        app.mongo.db,
        {
          userId: request.params.userId,
          kind: 'follow',
          // One row per follower: refollowing next week is not news, and the
          // unique index is what says so.
          refId: request.userId,
          actorId: request.userId,
        },
        { io: app.io, logger: app.log },
      )
      return reply.send(state)
    },
  )

  // Plain `requireAuth` on the undo. Taking your name back off a list must
  // never be blocked by a guard that could strand you on it.
  app.delete(
    '/profiles/:userId/follow',
    { preHandler: requireAuth, schema: { params: userParamsSchema } },
    async (request, reply) => {
      return reply.send(await unfollowUser(app.mongo.db, request.userId, request.params.userId))
    },
  )

  app.get(
    '/profiles/:userId/followers',
    {
      preHandler: requireAuth,
      schema: { params: userParamsSchema, querystring: listFollowsQuerySchema },
    },
    async (request, reply) => {
      return reply.send(
        await listFollowers(app.mongo.db, request.userId, request.params.userId, request.query),
      )
    },
  )

  app.get(
    '/profiles/:userId/following',
    {
      preHandler: requireAuth,
      schema: { params: userParamsSchema, querystring: listFollowsQuerySchema },
    },
    async (request, reply) => {
      return reply.send(
        await listFollowing(app.mongo.db, request.userId, request.params.userId, request.query),
      )
    },
  )
}
