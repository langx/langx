import { blockSchema, moderationListQuerySchema, reportSchema } from '@langx/shared'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { requireAuth, requireMember } from '../middleware/requireAuth'
import { blockUser, listBlocked, reportUser, unblockUser } from '../modules/moderation/blocks'
import { getViewers } from '../modules/moderation/profileViews'

// eslint-disable-next-line @typescript-eslint/require-await -- Fastify plugin signature
export const moderationRoutes: FastifyPluginAsyncZod = async (app) => {
  app.post(
    '/blocks',
    { preHandler: requireMember, schema: { body: blockSchema } },
    async (request, reply) => {
      const block = await blockUser(app.mongo.db, request.userId, request.body.userId)
      return reply.code(201).send(block)
    },
  )

  app.get(
    '/blocks',
    { preHandler: requireAuth, schema: { querystring: moderationListQuerySchema } },
    async (request, reply) => {
      return reply.send(await listBlocked(app.mongo.db, request.userId, request.query))
    },
  )

  app.delete('/blocks/:userId', { preHandler: requireMember }, async (request, reply) => {
    const { userId } = request.params as { userId: string }
    await unblockUser(app.mongo.db, request.userId, userId)
    return reply.code(204).send()
  })

  app.post(
    '/reports',
    { preHandler: requireMember, schema: { body: reportSchema } },
    async (request, reply) => {
      const result = await reportUser(app.mongo.db, request.userId, request.body)
      // `xpFrozen` is deliberately not echoed to the reporter: whether someone
      // else's earning is suspended is not the reporter's business, and
      // telling them turns the threshold into a game to probe.
      return reply.code(201).send({ id: result.report._id, status: result.report.status })
    },
  )

  app.get(
    '/me/viewers',
    { preHandler: requireAuth, schema: { querystring: moderationListQuerySchema } },
    async (request, reply) => {
      return reply.send(await getViewers(app.mongo.db, request.userId, request.query))
    },
  )
}
