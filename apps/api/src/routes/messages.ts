import {
  ERROR_CODES,
  listConversationsQuerySchema,
  listMessagesQuerySchema,
  listStarredQuerySchema,
} from '@langx/shared'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { ApiError } from '../lib/ApiError'
import { requireAuth } from '../middleware/requireAuth'
import {
  listConversations,
  listMessages,
  listMessagesAround,
  markConversationRead,
} from '../modules/chat/messages'
import { toMessageView } from '../modules/chat/messageView'
import { listStarredMessages } from '../modules/chat/mutations'

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
      const { around, ...rest } = request.query
      // Same path, same guard, same response shape — `around` only changes
      // which way the cursor is anchored, so it does not earn a second route.
      if (around !== undefined) {
        if (rest.cursor !== undefined || rest.after !== undefined) {
          throw new ApiError(
            ERROR_CODES.VALIDATION_FAILED,
            'Pass around on its own, without cursor or after',
          )
        }
        const window = await listMessagesAround(app.mongo.db, request.userId, id, {
          around,
          limit: rest.limit,
        })
        return reply.send(window)
      }
      const page = await listMessages(app.mongo.db, request.userId, id, rest)
      return reply.send(page)
    },
  )

  /**
   * Starred messages, across every conversation.
   *
   * REST rather than a socket event because it is a screen someone opens, not
   * a stream — and it is the only read in the chat area that is not scoped to
   * one thread, which is why it hangs off `/me` rather than `/conversations`.
   */
  app.get(
    '/me/starred',
    { preHandler: requireAuth, schema: { querystring: listStarredQuerySchema } },
    async (request, reply) => {
      const messages = await listStarredMessages(app.mongo.db, request.userId, request.query.limit)
      return reply.send({ items: messages.map((m) => toMessageView(m, request.userId)) })
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
