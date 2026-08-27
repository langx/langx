import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { requireAuth } from '../middleware/requireAuth'
import { getTokenSummary } from '../modules/tokens/summary'

// eslint-disable-next-line @typescript-eslint/require-await -- Fastify plugin signature
export const xpRoutes: FastifyPluginAsyncZod = async (app) => {
  // Leaderboards are Faz 9; this is the caller's own view — the numbers a
  // profile header and the streak nudge need, with no ranking query.
  app.get('/me/tokens', { preHandler: requireAuth }, async (request, reply) => {
    return reply.send(await getTokenSummary(app.mongo.db, request.userId))
  })
}
