import { createShareCardSchema, publicShareCardSchema, webUrl } from '@langx/shared'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { ERROR_CODES } from '@langx/shared'
import { ApiError } from '../lib/ApiError'
import { requireMember } from '../middleware/requireAuth'
import { createShareCard, readShareCard } from '../modules/cards/shareCards'
import { COLLECTIONS } from '../db/collections'
import type { Profile } from '../modules/profiles/profiles'

/**
 * Making a share card, and reading one back.
 *
 * The wording arrives from the client rather than being built here, because it
 * is the *reader's* language and the eight catalogues live in the app. The
 * server owns everything that is not wording: whose handle goes on it, whose
 * profile the QR points at, where the file lands, and what the public page is
 * allowed to see.
 */
// eslint-disable-next-line @typescript-eslint/require-await -- Fastify plugin signature
export const shareCardRoutes: FastifyPluginAsyncZod = async (app) => {
  app.post(
    '/me/share-card',
    {
      preHandler: requireMember,
      schema: { body: createShareCardSchema },
      /*
       * Rendering is the most expensive thing this process does per request —
       * a layout pass and a rasterise — so it gets its own limit well under
       * the global one. Nobody legitimately makes twenty cards a minute.
       */
      config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const profile = await app.mongo.db
        .collection<Profile>(COLLECTIONS.profiles)
        .findOne({ _id: request.userId }, { projection: { handle: 1 } })
      if (!profile) throw new ApiError(ERROR_CODES.NOT_FOUND, 'Complete onboarding first')

      const result = await createShareCard(app.mongo.db, app.storage, {
        userId: request.userId,
        kind: request.body.kind,
        shape: request.body.shape,
        copy: {
          headline: request.body.headline,
          caption: request.body.caption,
          // The handle is read from the profile, never taken from the body:
          // a card is a claim about who did the thing.
          handle: `@${profile.handle}`,
        },
        webBaseUrl: webUrl('').replace(/\/$/, ''),
      })
      return reply.code(201).send(result)
    },
  )

  /**
   * What `app.langx.io/s/<id>` renders.
   *
   * Unauthenticated, and safe to be: everything here was put on a card by its
   * owner in order to be posted in public. No email, no age, no location, no
   * post text — the three things a card can be about are the owner's own
   * numbers, which is the same line `sharedProfile.ts` draws.
   */
  app.get(
    '/public/share/:id',
    {
      schema: {
        params: z.object({ id: z.string().min(8).max(40) }),
        response: { 200: publicShareCardSchema },
      },
      config: { rateLimit: { max: 120, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const card = await readShareCard(app.mongo.db, request.params.id)
      if (!card) throw new ApiError(ERROR_CODES.NOT_FOUND, 'No such card')
      return reply.send({
        id: card._id,
        kind: card.kind,
        shape: card.shape,
        imageUrl: card.imageUrl,
        headline: card.headline,
        caption: card.caption,
        handle: card.handle,
      })
    },
  )
}
