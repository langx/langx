import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { requireAdmin } from '../middleware/requireAuth'
import { getUserStats } from '../modules/analytics/stats'

const userStatsSchema = z.object({
  total: z.number(),
  guests: z.number(),
  fromV1: z.number(),
  onboarded: z.number(),
  newLast24h: z.number(),
  newLast7d: z.number(),
  lastSignUpAt: z.string().nullable(),
})

/**
 * The operator's answer to "how many people are on this thing", without a
 * database client and without anyone reading production by hand.
 *
 * Declared here rather than in `packages/shared` — unlike every DTO there,
 * nothing in the app renders this. It is read by whoever is on the other end
 * of a `curl`, which is the same reason `/health` keeps its schema local.
 *
 * Counted live on request. The numbers are small enough to count and rare
 * enough to ask for that a cached aggregate would be a second thing to keep
 * true for no gain; `getUserStats` says what each one actually means.
 */
// eslint-disable-next-line @typescript-eslint/require-await -- Fastify plugin signature
export const adminRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/admin/stats',
    { preHandler: requireAdmin, schema: { response: { 200: userStatsSchema } } },
    async () => getUserStats(app.mongo.db),
  )
}
