import {
  listMyTestimonialsQuerySchema,
  listTestimonialsQuerySchema,
  testimonialInputSchema,
} from '@langx/shared'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { requireAuth, requireVerifiedEmail } from '../middleware/requireAuth'
import { recordNotification } from '../modules/notifications/inbox'
import { notifyTestimonial } from '../modules/notifications/social'
import {
  deleteTestimonial,
  listProfileTestimonials,
  listReceivedTestimonials,
  listWrittenTestimonials,
  setTestimonialOwnerHidden,
  upsertTestimonial,
} from '../modules/testimonials/testimonials'

const handleParamsSchema = z.object({ handle: z.string().trim().min(1) })
const userParamsSchema = z.object({ userId: z.string().trim().min(1) })
const idParamsSchema = z.object({ id: z.string().trim().min(1) })

/**
 * Testimonials — "reviews" on screen. Every rule about who may write, read,
 * hide or remove one lives in `modules/testimonials`; these handlers only
 * translate HTTP.
 */
// eslint-disable-next-line @typescript-eslint/require-await -- Fastify plugin signature
export const testimonialRoutes: FastifyPluginAsyncZod = async (app) => {
  /** None of it under `NODE_ENV=test` — see the same helper in `feedback.ts`. */
  const limit = (max: number, timeWindow: string) =>
    app.env.NODE_ENV === 'test' ? false : { max, timeWindow }

  app.get(
    '/profiles/:handle/testimonials',
    {
      preHandler: requireAuth,
      schema: { params: handleParamsSchema, querystring: listTestimonialsQuerySchema },
    },
    async (request, reply) => {
      return reply.send(
        await listProfileTestimonials(
          app.mongo.db,
          request.userId,
          request.params.handle,
          request.query,
        ),
      )
    },
  )

  /*
   * Verified, like following and posting: this puts your name and your words
   * on somebody else's public profile. Rate-limited because every write is an
   * edit after the first, and an edit loop is the only way to hammer it.
   */
  app.put(
    '/testimonials/:userId',
    {
      preHandler: requireVerifiedEmail,
      schema: { params: userParamsSchema, body: testimonialInputSchema },
      config: { rateLimit: limit(30, '1 hour') },
    },
    async (request, reply) => {
      const result = await upsertTestimonial(
        app.mongo.db,
        request.userId,
        request.params.userId,
        request.body.body,
      )
      /*
       * Only a first review is news; an edit is the same words reworded, and
       * a push each time somebody fixes a typo is how `social` gets switched
       * off. Not awaited, like a follow's: the review is written, and a push
       * service having a bad minute must not turn it into a 500.
       */
      if (result.created) {
        const testimonialId = result.testimonial._id
        void notifyTestimonial(
          app.mongo.db,
          { push: app.push, logger: app.log },
          { authorId: request.userId, subjectId: request.params.userId, testimonialId },
        ).catch((error: unknown) => {
          request.log.error({ err: error }, 'testimonial push failed')
        })
        // The row is ungated, as every row is: `social` push off asked not to
        // be buzzed, not to be kept from finding out.
        void recordNotification(
          app.mongo.db,
          {
            userId: request.params.userId,
            kind: 'testimonial',
            refId: testimonialId,
            actorId: request.userId,
          },
          { io: app.io, logger: app.log },
        )
      }
      return reply.send(result)
    },
  )

  // Plain `requireAuth` on the undo, as on unfollow: taking your words back
  // must never be blocked by a guard that could strand them on a profile.
  app.delete(
    '/testimonials/:userId',
    { preHandler: requireAuth, schema: { params: userParamsSchema } },
    async (request, reply) => {
      await deleteTestimonial(app.mongo.db, request.userId, request.params.userId)
      return reply.code(204).send()
    },
  )

  app.get(
    '/me/testimonials',
    { preHandler: requireAuth, schema: { querystring: listMyTestimonialsQuerySchema } },
    async (request, reply) => {
      const { tab, ...query } = request.query
      return reply.send(
        tab === 'written'
          ? await listWrittenTestimonials(app.mongo.db, request.userId, query)
          : await listReceivedTestimonials(app.mongo.db, request.userId, query),
      )
    },
  )

  // `requireAuth` for the same reason as the delete: what is on your own
  // profile is always yours to take down.
  app.post(
    '/me/testimonials/:id/hide',
    { preHandler: requireAuth, schema: { params: idParamsSchema } },
    async (request, reply) => {
      await setTestimonialOwnerHidden(app.mongo.db, request.userId, request.params.id, true)
      return reply.code(204).send()
    },
  )

  app.post(
    '/me/testimonials/:id/unhide',
    { preHandler: requireAuth, schema: { params: idParamsSchema } },
    async (request, reply) => {
      await setTestimonialOwnerHidden(app.mongo.db, request.userId, request.params.id, false)
      return reply.code(204).send()
    },
  )
}
