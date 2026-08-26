import { onboardingProfileSchema, updateProfileSchema } from '@langx/shared'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { ApiError } from '../lib/ApiError'
import { requireAuth, requireVerifiedEmail } from '../middleware/requireAuth'
import { hashLegacyEmail } from '../modules/handles/legacyEmailHash'
import { createProfile, getProfile, updateProfile } from '../modules/profiles/profiles'

// eslint-disable-next-line @typescript-eslint/require-await -- Fastify plugin signature
export const profileRoutes: FastifyPluginAsyncZod = async (app) => {
  app.post(
    '/profiles',
    { preHandler: requireVerifiedEmail, schema: { body: onboardingProfileSchema } },
    async (request, reply) => {
      const legacyEmailHash = app.env.LEGACY_EMAIL_HASH_SALT
        ? hashLegacyEmail(request.userEmail, app.env.LEGACY_EMAIL_HASH_SALT)
        : null

      const profile = await createProfile(
        app.mongo.db,
        request.userId,
        legacyEmailHash,
        request.body,
      )
      return reply.code(201).send(profile)
    },
  )

  app.get('/profiles/me', { preHandler: requireAuth }, async (request, reply) => {
    const profile = await getProfile(app.mongo.db, request.userId)
    if (!profile) throw new ApiError('NOT_FOUND', 'Profile not found')
    return reply.send(profile)
  })

  app.patch(
    '/profiles/me',
    { preHandler: requireAuth, schema: { body: updateProfileSchema } },
    async (request, reply) => {
      const profile = await updateProfile(app.mongo.db, request.userId, request.body)
      return reply.send(profile)
    },
  )
}
