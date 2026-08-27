import { discoveryQuerySchema } from '@langx/shared'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { requireAuth } from '../middleware/requireAuth'
import { discoverProfiles } from '../modules/discovery/discovery'

// eslint-disable-next-line @typescript-eslint/require-await -- Fastify plugin signature
export const discoveryRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/discovery',
    { preHandler: requireAuth, schema: { querystring: discoveryQuerySchema } },
    async (request, reply) => {
      const page = await discoverProfiles(app.mongo.db, request.userId, request.query)
      return reply.send(page)
    },
  )
}
