import { createPostCorrectionSchema, createPostSchema, listFeedQuerySchema } from '@langx/shared'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { requireAuth } from '../middleware/requireAuth'
import { requireVerifiedEmail } from '../middleware/requireAuth'
import { correctPost, createPost, listFeed, listPostCorrections } from '../modules/feed/feed'

const postParamsSchema = z.object({ id: z.string() })

// eslint-disable-next-line @typescript-eslint/require-await -- Fastify plugin signature
export const feedRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/feed',
    { preHandler: requireAuth, schema: { querystring: listFeedQuerySchema } },
    async (request, reply) => {
      return reply.send(await listFeed(app.mongo.db, request.userId, request.query))
    },
  )

  // Verified, like starting a conversation: a post is visible to strangers and
  // is the cheapest thing in the app to write, so it is the first place an
  // unverified account would be used to reach people.
  app.post(
    '/posts',
    { preHandler: requireVerifiedEmail, schema: { body: createPostSchema } },
    async (request, reply) => {
      return reply.code(201).send(await createPost(app.mongo.db, request.userId, request.body))
    },
  )

  app.get(
    '/posts/:id/corrections',
    { preHandler: requireAuth, schema: { params: postParamsSchema } },
    async (request, reply) => {
      return reply.send(await listPostCorrections(app.mongo.db, request.params.id))
    },
  )

  app.post(
    '/posts/:id/corrections',
    {
      preHandler: requireVerifiedEmail,
      schema: { params: postParamsSchema, body: createPostCorrectionSchema },
    },
    async (request, reply) => {
      const correction = await correctPost(
        app.mongo.db,
        request.userId,
        request.params.id,
        request.body,
      )
      return reply.code(201).send(correction)
    },
  )
}
