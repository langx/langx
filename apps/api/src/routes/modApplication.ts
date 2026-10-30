import { modApplicationSchema } from '@langx/shared'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { requireVerifiedEmail } from '../middleware/requireAuth'
import { applyToModerate, modApplicationStatus } from '../modules/moderation/application'

/**
 * Asking to moderate, from the sheet behind the MOD badge.
 *
 * Not in `moderator.ts`: that file is every route a moderator can reach, and
 * these are for somebody who is not one. `requireVerifiedEmail` because an
 * operator's answer goes back by mail as well as in the app.
 */
// eslint-disable-next-line @typescript-eslint/require-await -- Fastify plugin signature
export const modApplicationRoutes: FastifyPluginAsyncZod = async (app) => {
  /** Off under test for the reason `feedback.ts` gives. */
  const limit = (max: number, timeWindow: string) =>
    app.env.NODE_ENV === 'test' ? false : { max, timeWindow }

  app.get('/mod-application', { preHandler: requireVerifiedEmail }, async (request, reply) => {
    return reply.send(await modApplicationStatus(app.mongo.db, request.userId))
  })

  app.post(
    '/mod-application',
    {
      preHandler: requireVerifiedEmail,
      schema: { body: modApplicationSchema },
      config: { rateLimit: limit(5, '1 hour') },
    },
    async (request, reply) => {
      await applyToModerate(app.mongo.db, request.userId, request.body)
      return reply.code(202).send({ ok: true })
    },
  )
}
