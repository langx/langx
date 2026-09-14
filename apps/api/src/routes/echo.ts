import {
  captureEchoSchema,
  echoQueueQuerySchema,
  listEchoCardsQuerySchema,
  submitEchoReviewsSchema,
} from '@langx/shared'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { requireAuth, requireMember } from '../middleware/requireAuth'
import { captureEcho, dueQueue, listCards, removeCard, summary } from '../modules/echo/cards'
import { submitReviews } from '../modules/echo/reviews'

/**
 * The card id, or the source it was made from.
 *
 * Two shapes because the chat screen only ever holds a message id: it draws
 * the mark from `echoed` on the message and has no card id to send, and a
 * `DELETE` carries no body to put one in.
 */
const cardParamsSchema = z.object({ id: z.string().trim().min(1) })

// eslint-disable-next-line @typescript-eslint/require-await -- Fastify plugin signature
export const echoRoutes: FastifyPluginAsyncZod = async (app) => {
  /*
   * `requireAuth`, not `requireVerifiedEmail`. That guard exists for things
   * that reach another person — following puts your name on a stranger's
   * list, a post is readable by everyone — and a card is a note to yourself
   * that nobody else can see. The capture ceiling is the abuse control here.
   */
  app.post(
    '/echo/cards',
    { preHandler: requireAuth, schema: { body: captureEchoSchema } },
    async (request, reply) => {
      const result = await captureEcho(
        app.mongo.db,
        { translation: app.translation },
        request.userId,
        request.body,
      )
      // 201 only when something was written. A second tap is a 200 carrying
      // the card that was already there, which is what makes the gesture
      // idempotent rather than merely forgiving.
      return reply.code(result.created ? 201 : 200).send(result)
    },
  )

  app.delete(
    '/echo/cards/:id',
    { preHandler: requireAuth, schema: { params: cardParamsSchema } },
    async (request, reply) => {
      await removeCard(app.mongo.db, request.userId, request.params.id)
      return reply.code(204).send()
    },
  )

  app.get(
    '/echo/cards',
    { preHandler: requireAuth, schema: { querystring: listEchoCardsQuerySchema } },
    async (request, reply) => {
      return reply.send(await listCards(app.mongo.db, request.userId, request.query))
    },
  )

  app.get(
    '/echo/queue',
    { preHandler: requireAuth, schema: { querystring: echoQueueQuerySchema } },
    async (request, reply) => {
      return reply.send(await dueQueue(app.mongo.db, request.userId, request.query.lang))
    },
  )

  /*
   * The one guest gate in the module, and the one the design document asks
   * for: a guest sees the tab and everything on it, and is asked for an
   * account at the first grade. Reviewing is the thing worth keeping, and a
   * schedule with nowhere to live is a promise that cannot be kept.
   */
  app.post(
    '/echo/reviews',
    { preHandler: requireMember, schema: { body: submitEchoReviewsSchema } },
    async (request, reply) => {
      return reply.send(await submitReviews(app.mongo.db, request.userId, request.body))
    },
  )

  app.get('/echo/summary', { preHandler: requireAuth }, async (request, reply) => {
    return reply.send(await summary(app.mongo.db, request.userId))
  })
}
