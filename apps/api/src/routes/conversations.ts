import { ERROR_CODES, startConversationSchema } from '@langx/shared'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { ApiError } from '../lib/ApiError'
import { getQuotaStatus } from '../lib/quota'
import { requireAuth, requireVerifiedEmail } from '../middleware/requireAuth'
import { startConversation } from '../modules/chat/conversations'
import { getProfile } from '../modules/profiles/profiles'

// eslint-disable-next-line @typescript-eslint/require-await -- Fastify plugin signature
export const conversationRoutes: FastifyPluginAsyncZod = async (app) => {
  app.post(
    '/conversations',
    { preHandler: requireVerifiedEmail, schema: { body: startConversationSchema } },
    async (request, reply) => {
      const conversation = await startConversation(app.mongo.db, request.userId, request.body)
      return reply.code(201).send(conversation)
    },
  )

  app.get('/me/quota', { preHandler: requireAuth }, async (request, reply) => {
    const profile = await getProfile(app.mongo.db, request.userId)
    if (!profile) throw new ApiError(ERROR_CODES.NOT_FOUND, 'Profile not found')

    const [initiations, translations] = await Promise.all([
      getQuotaStatus(app.mongo.db, request.userId, profile.entitlement.tier, 'initiations'),
      getQuotaStatus(app.mongo.db, request.userId, profile.entitlement.tier, 'translations'),
    ])
    return reply.send({ initiations, translations })
  })
}
