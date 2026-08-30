import { handleSchema } from '@langx/shared'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { requireVerifiedEmail } from '../middleware/requireAuth'
import { findReservationForEmail, isHandleAvailable } from '../modules/handles/handleReservations'
import { findLegacyProfile } from '../modules/handles/legacyProfiles'
import { hashLegacyEmail } from '../modules/handles/legacyEmailHash'

// eslint-disable-next-line @typescript-eslint/require-await -- Fastify plugin signature
export const handleRoutes: FastifyPluginAsyncZod = async (app) => {
  // "Your old handle @x is waiting" — read-only, onboarding calls this on
  // load. Claiming itself only happens as a side effect of POST /profiles.
  app.get('/handle-reservation', { preHandler: requireVerifiedEmail }, async (request, reply) => {
    if (!app.env.LEGACY_EMAIL_HASH_SALT) return reply.send({ reservation: null })

    const legacyEmailHash = hashLegacyEmail(request.userEmail, app.env.LEGACY_EMAIL_HASH_SALT)
    const [reservation, legacy] = await Promise.all([
      findReservationForEmail(app.mongo.db, legacyEmailHash),
      findLegacyProfile(app.mongo.db, legacyEmailHash),
    ])

    // The staged v1 profile rides along with the reservation so onboarding can
    // pre-fill in one round-trip. Only the fields the form asks for — the rest
    // (avatar, gallery, legacy streak) is applied server-side at creation, out
    // of reach of a client that could otherwise claim someone else's avatar.
    return reply.send({
      reservation: reservation
        ? { handle: reservation.handle, expiresAt: reservation.expiresAt }
        : null,
      legacyProfile: legacy
        ? {
            displayName: legacy.displayName ?? null,
            bio: legacy.bio ?? null,
            birthDate: legacy.birthDate ?? null,
            gender: legacy.gender ?? null,
            country: legacy.countryCode ?? null,
            nativeLanguages: legacy.nativeLanguages,
            learning: legacy.learning,
            hasAvatar: Boolean(legacy.avatarUrl),
            photoCount: legacy.photos.length,
          }
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
