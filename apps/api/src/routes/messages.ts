import { listConversationsQuerySchema, listMessagesQuerySchema } from '@langx/shared'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { requireAuth } from '../middleware/requireAuth'
import { listConversations, listMessages, markConversationRead } from '../modules/chat/messages'

// eslint-disable-next-line @typescript-eslint/require-await -- Fastify plugin signature
export const messageRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/conversations',
    { preHandler: requireAuth, schema: { querystring: listConversationsQuerySchema } },
    async (request, reply) => {
      const page = await listConversations(app.mongo.db, request.userId, request.query)
      return reply.send(page)
    },
  )

  app.get(
    '/conversations/:id/messages',
    {
      preHandler: requireAuth,
      schema: { querystring: listMessagesQuerySchema },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const page = await listMessages(app.mongo.db, request.userId, id, request.query)
      return reply.send(page)
    },
  )

  // REST fallback for marking a thread read (e.g. opened from a push
  // notification before a socket connection exists) — still fans the
  // realtime `conversation:read` event out over `app.io`, so the sender's
  // UI updates the same way regardless of which transport the reader used.
  app.post('/conversations/:id/read', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const conversation = await markConversationRead(app.mongo.db, request.userId, id)
    const otherId = conversation.participants.find((p) => p !== request.userId)
    if (otherId) {
      app.io.to(`user:${otherId}`).emit('conversation:read', {
        conversationId: id,
        readBy: request.userId,
        readAt: new Date().toISOString(),
      })
    }
    return reply.send(conversation)
  })
}
