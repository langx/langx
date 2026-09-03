import { leaderboardQuerySchema, purchaseSchema, streakLeaderboardQuerySchema } from '@langx/shared'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { requireAuth } from '../middleware/requireAuth'
import { getBadgeSummary } from '../modules/tokens/badges'
import { getLeaderboard } from '../modules/tokens/leaderboard'
import { getStreakLeaderboard } from '../modules/tokens/streakLeaderboard'
import { getWallet, purchase } from '../modules/tokens/wallet'

// eslint-disable-next-line @typescript-eslint/require-await -- Fastify plugin signature
export const leaderboardRoutes: FastifyPluginAsyncZod = async (app) => {
  // The four tabs are one endpoint with a `period` parameter, not four routes:
  // the query is identical apart from which key it reads.
  app.get(
    '/leaderboard',
    { preHandler: requireAuth, schema: { querystring: leaderboardQuerySchema } },
    async (request, reply) => {
      const board = await getLeaderboard(app.mongo.db, request.userId, request.query)
      return reply.send(board)
    },
  )

  /*
   * A second route rather than a fifth tab on the one above, despite the
   * comment there. The parameters genuinely differ — no period, no cursor,
   * and a metric the token board has no equivalent for — so folding them into
   * one query schema would make every field optional and the handler a switch.
   */
  app.get(
    '/leaderboard/streak',
    { preHandler: requireAuth, schema: { querystring: streakLeaderboardQuerySchema } },
    async (request, reply) => {
      const board = await getStreakLeaderboard(app.mongo.db, request.userId, request.query)
      return reply.send(board)
    },
  )

  // Beside the leaderboard rather than under /me/tokens: the badge screen and
  // the ranking tabs are one screen, and this keeps it to one round trip's
  // worth of routes.
  app.get('/me/badges', { preHandler: requireAuth }, async (request, reply) => {
    return reply.send(await getBadgeSummary(app.mongo.db, request.userId))
  })

  app.get('/me/wallet', { preHandler: requireAuth }, async (request, reply) => {
    return reply.send(await getWallet(app.mongo.db, request.userId))
  })

  app.post(
    '/me/wallet/purchase',
    { preHandler: requireAuth, schema: { body: purchaseSchema } },
    async (request, reply) => {
      const result = await purchase(app.mongo.db, request.userId, request.body.sku)
      return reply.send(result)
    },
  )
}
