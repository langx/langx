import {
  attachEchoAudioSchema,
  captureEchoSchema,
  echoQueueQuerySchema,
  linkEchoAskSchema,
  listEchoCardsQuerySchema,
  startPackSchema,
  submitEchoReviewsSchema,
  updateEchoCardSchema,
} from '@langx/shared'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { requireAuth, requireMember } from '../middleware/requireAuth'
import {
  attachAnswerAudio,
  captureEcho,
  cardForPost,
  dueQueue,
  linkAsk,
  listCards,
  removeCard,
  summary,
  updateCard,
} from '../modules/echo/cards'
import { listPacks, startPack } from '../modules/echo/packs'
import { submitReviews } from '../modules/echo/reviews'
import { localeFromHeader } from '../i18n'

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

  /*
   * A card id only, unlike the `DELETE` below: the two shapes exist for the
   * chat screen, which holds a message id and never edits anything.
   */
  app.patch(
    '/echo/cards/:id',
    { preHandler: requireAuth, schema: { params: cardParamsSchema, body: updateEchoCardSchema } },
    async (request, reply) => {
      return reply.send(
        await updateCard(app.mongo.db, request.userId, request.params.id, request.body),
      )
    },
  )

  /*
   * The card asked the feed how its sentence is said, and this is the post it
   * asked on. Written by the composer once the post exists — see `linkAsk` for
   * why it is not part of creating the post.
   */
  app.post(
    '/echo/cards/:id/ask',
    { preHandler: requireAuth, schema: { params: cardParamsSchema, body: linkEchoAskSchema } },
    async (request, reply) => {
      return reply.send(
        await linkAsk(app.mongo.db, request.userId, request.params.id, request.body),
      )
    },
  )

  /*
   * An answer on that post, kept as the card's recording. A card that already
   * has one is overwritten — see `attachAnswerAudio`.
   */
  app.post(
    '/echo/cards/:id/audio',
    { preHandler: requireAuth, schema: { params: cardParamsSchema, body: attachEchoAudioSchema } },
    async (request, reply) => {
      return reply.send(
        await attachAnswerAudio(app.mongo.db, request.userId, request.params.id, request.body),
      )
    },
  )

  /*
   * Which of my cards asked this post, if any. Four segments, so it does not
   * collide with `/echo/cards/:id` above.
   */
  app.get(
    '/echo/cards/for-post/:postId',
    { preHandler: requireAuth, schema: { params: z.object({ postId: z.string().trim().min(1) }) } },
    async (request, reply) => {
      return reply.send(await cardForPost(app.mongo.db, request.userId, request.params.postId))
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

  app.get('/echo/packs', { preHandler: requireAuth }, async (request, reply) => {
    return reply.send(await listPacks(app.mongo.db, request.userId))
  })

  /*
   * `requireMember`, like reviewing and for the same reason: starting a pack
   * writes a schedule, and a schedule with nowhere to live is a promise that
   * cannot be kept. A guest can see every pack and is asked for an account at
   * the moment they would begin one.
   */
  app.post(
    '/echo/packs/:id/start',
    {
      preHandler: requireMember,
      schema: { params: cardParamsSchema, body: startPackSchema.omit({ packId: true }) },
    },
    async (request, reply) => {
      return reply.send(
        await startPack(
          app.mongo.db,
          request.userId,
          { packId: request.params.id, count: request.body.count },
          localeFromHeader(request.headers['accept-language']),
        ),
      )
    },
  )
}
