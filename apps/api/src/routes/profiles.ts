import {
  countryFromLocationSchema,
  handleSchema,
  hasFeature,
  locationInputSchema,
  onboardingProfileSchema,
  updateProfileSchema,
} from '@langx/shared'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { ApiError } from '../lib/ApiError'
import { findConversationBetween } from '../modules/chat/conversations'
import { countryFromHeaders } from '../lib/requestCountry'
import { requireAuth, requireVerifiedEmail } from '../middleware/requireAuth'
import { hashLegacyEmail } from '../modules/handles/legacyEmailHash'
import { blockedUserIds } from '../modules/moderation/blocks'
import { recordProfileView } from '../modules/moderation/profileViews'
import { effectiveTier } from '../modules/profiles/entitlement'
import {
  clearLocation,
  createProfile,
  setCountryFromLocation,
  findProfileByHandleOrId,
  getProfile,
  isEmailVerified,
  setLocation,
  toPublicProfile,
  updateProfile,
} from '../modules/profiles/profiles'
import { getSharedProfile } from '../modules/profiles/sharedProfile'
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
        // Where the connection says they are. Beats whatever the form sent,
        // and is the reason the form no longer asks.
        countryFromHeaders(request.headers, app.env.EDGE_SECRET),
      )
      return reply.code(201).send(profile)
    },
  )

  /**
   * The one way a country can change after onboarding.
   *
   * It is not in `PATCH /profiles/me` on purpose: the country is read off the
   * connection and is not a field to type into, or the age filter and the
   * country filter become self-declared. What this accepts is the answer a
   * *device* gave — the user granted location permission and the OS reverse-
   * geocoded a fix — which is the case the IP gets wrong: a VPN, a border
   * town, a trip.
   *
   * The server cannot verify it, and does not pretend to. It is a better
   * answer than the free-text picker it replaces, and worse than the header;
   * that is the trade, made once, here.
   */
  app.patch(
    '/profiles/me/country',
    { preHandler: requireAuth, schema: { body: countryFromLocationSchema } },
    async (request, reply) => {
      const profile = await setCountryFromLocation(
        app.mongo.db,
        request.userId,
        request.body.country,
      )
      return reply.send(profile)
    },
  )

  app.get('/profiles/me', { preHandler: requireAuth }, async (request, reply) => {
    const profile = await getProfile(app.mongo.db, request.userId)
    if (!profile) throw new ApiError('NOT_FOUND', 'Profile not found')
    return reply.send(profile)
  })

  // Deliberately after `/profiles/me` so the literal route wins over the
  // parameterised one — Fastify would otherwise treat "me" as a handle.
  /*
   * The one profile read with no `requireAuth`, because it is what a shared
   * link resolves to: `https://<host>/<handle>` opened by somebody who has
   * never signed in. It answers a deliberately smaller allow-list than the
   * member view — see `getSharedProfile`.
   *
   * Its own rate limit, because it is the only unauthenticated read in the
   * API and a handle is guessable: without one it is a way to enumerate the
   * user base at the global 300/minute.
   */
  app.get(
    '/public/profiles/:handle',
    {
      schema: { params: z.object({ handle: handleSchema }) },
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      return reply.send(await getSharedProfile(app.mongo.db, request.params.handle))
    },
  )

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
      const [emailVerified, follow, conversation] = await Promise.all([
        isEmailVerified(app.mongo.db, target._id),
        readFollowState(app.mongo.db, request.userId, target._id),
        // Only for somebody else's profile: a conversation with yourself is
        // not a thing, and `findConversationBetween` would answer for the
        // pair (you, you).
        target._id === request.userId
          ? Promise.resolve(null)
          : findConversationBetween(app.mongo.db, request.userId, target._id),
      ])
      return reply.send(
        toPublicProfile(target, emailVerified, follow, new Date(), conversation?._id.toHexString()),
      )
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
