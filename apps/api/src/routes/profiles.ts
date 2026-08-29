import {
  hasFeature,
  locationInputSchema,
  onboardingProfileSchema,
  updateProfileSchema,
} from '@langx/shared'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { ApiError } from '../lib/ApiError'
import { requireAuth, requireVerifiedEmail } from '../middleware/requireAuth'
import { hashLegacyEmail } from '../modules/handles/legacyEmailHash'
import { blockedUserIds } from '../modules/moderation/blocks'
import { recordProfileView } from '../modules/moderation/profileViews'
import { effectiveTier } from '../modules/profiles/entitlement'
import {
  clearLocation,
  createProfile,
  findProfileByHandleOrId,
  getProfile,
  isEmailVerified,
  setLocation,
  toPublicProfile,
  updateProfile,
} from '../modules/profiles/profiles'
import { readFollowState } from '../modules/social/follows'

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
        app.env.STORAGE_PUBLIC_BASE_URL,
        app.revenueCat,
      )
      return reply.code(201).send(profile)
    },
  )

  app.get('/profiles/me', { preHandler: requireAuth }, async (request, reply) => {
    const profile = await getProfile(app.mongo.db, request.userId)
    if (!profile) throw new ApiError('NOT_FOUND', 'Profile not found')
    return reply.send(profile)
  })

  // Deliberately after `/profiles/me` so the literal route wins over the
  // parameterised one — Fastify would otherwise treat "me" as a handle.
  app.get(
    '/profiles/:handleOrId',
    { preHandler: requireAuth, config: { rateLimit: false } },
    async (request, reply) => {
      const { handleOrId } = request.params as { handleOrId: string }

      const [target, viewer, hidden] = await Promise.all([
        findProfileByHandleOrId(app.mongo.db, handleOrId),
        getProfile(app.mongo.db, request.userId),
        blockedUserIds(app.mongo.db, request.userId),
      ])
      // A blocked user is not "forbidden", they are *absent* — a 403 would
      // confirm the account exists, which is exactly what blocking should not do.
      if (!target || hidden.includes(target._id)) {
        throw new ApiError('NOT_FOUND', 'Profile not found')
      }

      if (viewer) await recordProfileView(app.mongo.db, viewer, target._id)
      // Read after the block check, not with it: an unverified-email lookup
      // for a profile this viewer is not allowed to see is a query we should
      // never run.
      const [emailVerified, follow] = await Promise.all([
        isEmailVerified(app.mongo.db, target._id),
        readFollowState(app.mongo.db, request.userId, target._id),
      ])
      return reply.send(toPublicProfile(target, emailVerified, follow))
    },
  )

  app.patch(
    '/profiles/me',
    { preHandler: requireAuth, schema: { body: updateProfileSchema } },
    async (request, reply) => {
      /**
       * The one field gated on *write* rather than at read time.
       *
       * `incognito` re-checks the tier every time it is honoured, which is
       * right for it: nothing is lost if a lapsed subscriber starts leaving
       * profile-view rows again. Doing that here would silently make someone
       * visible as online because a payment failed — a privacy setting
       * revoked by a billing event, without telling them. Turning it *off* is
       * always allowed, so nobody is ever stuck hidden either.
       */
      if (request.body.privacy?.hideOnlineStatus === true) {
        const current = await getProfile(app.mongo.db, request.userId)
        if (!current) throw new ApiError('NOT_FOUND', 'Profile not found')
        if (!hasFeature(effectiveTier(current), 'hideOnlineStatus')) {
          throw new ApiError('UPGRADE_REQUIRED', 'Hiding your online status is a Pro feature', {
            feature: 'hideOnlineStatus',
          })
        }
      }

      const profile = await updateProfile(app.mongo.db, request.userId, request.body)
      return reply.send(profile)
    },
  )

  /**
   * Location is its own pair of routes rather than two more keys on
   * `PATCH /profiles/me`, because it is the only profile data a *device*
   * writes on its own initiative. Keeping it separate means the capture path
   * cannot touch anything else, and revoking is a single call with no body to
   * get wrong — which matters when the caller is a settings toggle someone
   * has just switched off.
   *
   * Free on every tier. `PLAN_LIMITS.nearby` gates reading distance, not
   * contributing to it.
   */
  app.post(
    '/profiles/me/location',
    { preHandler: requireAuth, schema: { body: locationInputSchema } },
    async (request, reply) => {
      const profile = await setLocation(app.mongo.db, request.userId, request.body)
      return reply.send(profile)
    },
  )

  app.delete('/profiles/me/location', { preHandler: requireAuth }, async (request, reply) => {
    const profile = await clearLocation(app.mongo.db, request.userId)
    return reply.send(profile)
  })
}
