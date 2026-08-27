import { translateRequestSchema } from '@langx/shared'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { requireVerifiedEmail } from '../middleware/requireAuth'
import { translateText } from '../modules/translation/translate'

// eslint-disable-next-line @typescript-eslint/require-await -- Fastify plugin signature
export const translationRoutes: FastifyPluginAsyncZod = async (app) => {
  app.post(
    '/translate',
    { preHandler: requireVerifiedEmail, schema: { body: translateRequestSchema } },
    async (request, reply) => {
      const result = await translateText(app.mongo.db, app.translation, request.userId, request.body)
      return reply.send(result)
    },
  )
}
