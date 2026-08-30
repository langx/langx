import { tokenHistoryQuerySchema } from '@langx/shared'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { requireAuth } from '../middleware/requireAuth'
import { getTokenHistory } from '../modules/tokens/history'
import { getTokenSummary } from '../modules/tokens/summary'

// eslint-disable-next-line @typescript-eslint/require-await -- Fastify plugin signature
export const xpRoutes: FastifyPluginAsyncZod = async (app) => {
  // Leaderboards are Faz 9; this is the caller's own view — the numbers a
  // profile header and the streak nudge need, with no ranking query.
  app.get('/me/tokens', { preHandler: requireAuth }, async (request, reply) => {
    return reply.send(await getTokenSummary(app.mongo.db, request.userId))
  })

  /*
   * Separate from the summary rather than a field on it: the summary is read on
   * every profile view and a history page is read only when someone opens it,
   * and the two page differently — one is a fixed shape, the other a cursor.
   */
  app.get(
    '/me/tokens/history',
    { preHandler: requireAuth, schema: { querystring: tokenHistoryQuerySchema } },
    async (request, reply) => {
      const { before } = request.query
      return reply.send(
        await getTokenHistory(app.mongo.db, request.userId, before ? { before } : {}),
      )
    },
  )
}
