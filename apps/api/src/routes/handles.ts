import { handleSchema } from '@langx/shared'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { requireVerifiedEmail } from '../middleware/requireAuth'
import { findReservationForEmail, isHandleAvailable } from '../modules/handles/handleReservations'
import { hashLegacyEmail } from '../modules/handles/legacyEmailHash'

// eslint-disable-next-line @typescript-eslint/require-await -- Fastify plugin signature
export const handleRoutes: FastifyPluginAsyncZod = async (app) => {
  // "Your old handle @x is waiting" — read-only, onboarding calls this on
  // load. Claiming itself only happens as a side effect of POST /profiles.
  app.get('/handle-reservation', { preHandler: requireVerifiedEmail }, async (request, reply) => {
    if (!app.env.LEGACY_EMAIL_HASH_SALT) return reply.send({ reservation: null })

    const legacyEmailHash = hashLegacyEmail(request.userEmail, app.env.LEGACY_EMAIL_HASH_SALT)
    const reservation = await findReservationForEmail(app.mongo.db, legacyEmailHash)
    return reply.send({
      reservation: reservation
        ? { handle: reservation.handle, expiresAt: reservation.expiresAt }
        : null,
    })
  })

  app.get(
    '/handles/:handle/availability',
    {
      preHandler: requireVerifiedEmail,
      schema: { params: z.object({ handle: handleSchema }) },
    },
    async (request, reply) => {
      const legacyEmailHash = app.env.LEGACY_EMAIL_HASH_SALT
        ? hashLegacyEmail(request.userEmail, app.env.LEGACY_EMAIL_HASH_SALT)
        : null

      const available = await isHandleAvailable(
        app.mongo.db,
        request.params.handle,
        legacyEmailHash,
      )
      return reply.send({ available })
    },
  )
}
