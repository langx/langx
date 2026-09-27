import { scheduleMessageSchema } from '@langx/shared'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { requireAuth, requireVerifiedEmail } from '../middleware/requireAuth'
import {
  cancelScheduledMessage,
  createScheduledMessage,
  listScheduledMessages,
  toScheduledMessageDto,
} from '../modules/chat/scheduled'

/**
 * "Send later". Three routes over the author's own rows; the sending is the
 * scheduler's (`modules/chat/scheduledSender.ts`), which is why there is no
 * socket twin — nothing here happens in real time.
 */
// eslint-disable-next-line @typescript-eslint/require-await -- Fastify plugin signature
export const scheduledMessageRoutes: FastifyPluginAsyncZod = async (app) => {
  /*
   * `requireVerifiedEmail` and the rate limit of the REST send twin in
   * `routes/messages.ts`: this is a send, only a late one, and it must not be
   * the softer door to either.
   */
  app.post(
    '/conversations/:id/scheduled',
    {
      preHandler: requireVerifiedEmail,
      schema: { params: z.object({ id: z.string().trim().min(1) }), body: scheduleMessageSchema },
      config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const row = await createScheduledMessage(
        app.mongo.db,
        request.userId,
        request.params.id,
        request.body,
      )
      return reply.code(201).send(toScheduledMessageDto(row))
    },
  )

  app.get(
    '/conversations/:id/scheduled',
    {
      preHandler: requireAuth,
      schema: { params: z.object({ id: z.string().trim().min(1) }) },
    },
    async (request, reply) => {
      const rows = await listScheduledMessages(app.mongo.db, request.userId, request.params.id)
      return reply.send({ items: rows.map(toScheduledMessageDto) })
    },
  )

  app.delete(
    '/scheduled/:id',
    {
      preHandler: requireAuth,
      schema: { params: z.object({ id: z.string().trim().min(1) }) },
    },
    async (request, reply) => {
      await cancelScheduledMessage(app.mongo.db, request.userId, request.params.id)
      return reply.code(204).send()
    },
  )
}
