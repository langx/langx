import { listFollowsQuerySchema } from '@langx/shared'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { requireAuth, requireVerifiedEmail } from '../middleware/requireAuth'
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
      return reply.send(await followUser(app.mongo.db, request.userId, request.params.userId))
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
