import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { requireAuth } from '../middleware/requireAuth'
import { readReferralStatus } from '../modules/referrals/referrals'

// eslint-disable-next-line @typescript-eslint/require-await -- Fastify plugin signature
export const referralRoutes: FastifyPluginAsyncZod = async (app) => {
  /**
   * Everything the invite screen draws: the totals, who has been invited, and
   * who invited the caller.
   *
   * `requireAuth` rather than `requireMember`: a guest has no invitees and no
   * referrer, so this answers zeroes rather than refusing — the screen is
   * reachable from the token screen, and a 403 there would be a dead end
   * rather than an explanation.
   */
  app.get('/me/referrals', { preHandler: requireAuth }, async (request, reply) => {
    return reply.send(await readReferralStatus(app.mongo.db, request.userId))
  })
}
