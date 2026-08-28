import { ERROR_CODES, startConversationSchema } from '@langx/shared'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { ApiError } from '../lib/ApiError'
import { getQuotaStatus } from '../lib/quota'
import { requireAuth, requireVerifiedEmail } from '../middleware/requireAuth'
import { startConversation } from '../modules/chat/conversations'
import { effectiveTier } from '../modules/profiles/entitlement'
import { getProfile } from '../modules/profiles/profiles'
import { fanOutMessage } from '../ws/fanOut'

// eslint-disable-next-line @typescript-eslint/require-await -- Fastify plugin signature
export const conversationRoutes: FastifyPluginAsyncZod = async (app) => {
  app.post(
    '/conversations',
    { preHandler: requireVerifiedEmail, schema: { body: startConversationSchema } },
    async (request, reply) => {
      const { conversation, message } = await startConversation(
        app.mongo.db,
        request.userId,
        request.body,
      )
      // Starting a conversation *is* sending its first message, so it gets the
      // same treatment as every other send: it reaches the recipient live, it
      // advances the sender's ticks, and it notifies if they are away. This
      // was the one message path with no realtime at all — a first message sat
      // unannounced until something happened to refetch, which for the person
      // being contacted is the message that matters most.
      void fanOutMessage(app, app.io, conversation, message, { pushWhenAway: true })
      return reply.code(201).send(conversation)
    },
  )

  app.get('/me/quota', { preHandler: requireAuth }, async (request, reply) => {
    const profile = await getProfile(app.mongo.db, request.userId)
    if (!profile) throw new ApiError(ERROR_CODES.NOT_FOUND, 'Profile not found')

    const tier = effectiveTier(profile)
    // Every kind `quota.ts` tracks, so a client never has to guess why an
    // action was refused. `media` was missing here while being consumed on
    // the socket path, which left the chat screen with no way to say which
    // limit it had hit.
    const [initiations, translations, media] = await Promise.all([
      getQuotaStatus(app.mongo.db, request.userId, tier, 'initiations'),
      getQuotaStatus(app.mongo.db, request.userId, tier, 'translations'),
      getQuotaStatus(app.mongo.db, request.userId, tier, 'media'),
    ])
    return reply.send({ initiations, translations, media })
  })
}
