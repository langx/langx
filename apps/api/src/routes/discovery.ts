import { discoveryQuerySchema, handleSearchQuerySchema } from '@langx/shared'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { requireAuth } from '../middleware/requireAuth'
import { discoverProfiles } from '../modules/discovery/discovery'
import { searchHandles } from '../modules/discovery/handleSearch'

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

  /*
   * Its own rate limit, tighter than the global 300/minute. A search box is
   * called per keystroke — the client debounces, but the client is not what
   * enforces this — and it is the one endpoint here that takes a pattern.
   */
  app.get(
    '/discovery/handles',
    {
      preHandler: requireAuth,
      schema: { querystring: handleSearchQuerySchema },
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      return reply.send(await searchHandles(app.mongo.db, request.userId, request.query.q))
    },
  )
}
