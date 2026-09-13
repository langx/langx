import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { requireAdmin } from '../middleware/requireAuth'
import { readAdminStats } from '../modules/admin/stats'

/**
 * The operator panel's API.
 *
 * Everything here is behind `requireAdmin`, which is a flag on a profile and
 * not an env var — see the note on that guard for why `ADMIN_USER_IDS` is not
 * what authorises this.
 *
 * It is JSON and nothing else. The two server-rendered pages in
 * `moderation.ts` and `feedback.ts` stay exactly where they are: a signed link
 * in a mailbox is the path that still works when nobody can sign in, and it is
 * the one somebody else can be handed without an account. The panel is the
 * surface you reach for; those are the one you fall back to.
 */
// eslint-disable-next-line @typescript-eslint/require-await -- Fastify plugin signature
export const adminRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get('/admin/stats', { preHandler: requireAdmin }, async (_request, reply) => {
    return reply.send(await readAdminStats(app.mongo.db))
  })
}
