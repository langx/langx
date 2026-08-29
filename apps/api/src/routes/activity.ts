import {
  activityRangeSchema,
  ERROR_CODES,
  localDayKey,
  repairDaySchema,
  TOKEN_RULES,
} from '@langx/shared'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { ApiError } from '../lib/ApiError'
import { requireAuth } from '../middleware/requireAuth'
import { getProfile } from '../modules/profiles/profiles'
import { blockedUserIds } from '../modules/moderation/blocks'
import { listStreakDays, repairsInMonth } from '../modules/tokens/streakDays'
import { repairDay } from '../modules/tokens/wallet'

/**
 * The activity map, and buying back a day of it.
 *
 * Under `/me` rather than `/profiles/me`, because what it reads is the token
 * economy's record of a user's days rather than anything on their profile —
 * the same reason `/me/tokens` and `/me/wallet` live there.
 */
// eslint-disable-next-line @typescript-eslint/require-await -- Fastify plugin signature
export const activityRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/me/activity',
    { preHandler: requireAuth, schema: { querystring: activityRangeSchema } },
    async (request, reply) => {
      const profile = await getProfile(app.mongo.db, request.userId)
      if (!profile) throw new ApiError(ERROR_CODES.NOT_FOUND, 'Complete onboarding first')

      const { from, to } = request.query
      const today = localDayKey(new Date(), profile.timezone ?? 'UTC')
      const days = await listStreakDays(app.mongo.db, request.userId, from, to)

      return reply.send({
        today,
        days: days.map((d) => ({ day: d.day, actions: d.actions, source: d.source })),
        repair: {
          price: TOKEN_RULES.sinks.dayRepair,
          maxAgeDays: TOKEN_RULES.sinks.dayRepairMaxAgeDays,
          perMonth: TOKEN_RULES.sinks.dayRepairPerMonth,
          usedThisMonth: await repairsInMonth(app.mongo.db, request.userId, today),
        },
      })
    },
  )

  app.post(
    '/me/activity/repair',
    { preHandler: requireAuth, schema: { body: repairDaySchema } },
    async (request, reply) => {
      return reply.send(await repairDay(app.mongo.db, request.userId, request.body.day))
    },
  )

  /**
   * Somebody else's map: filled or not, and how busy, but never the counts and
   * never which squares were bought.
   *
   * A separate endpoint rather than a field on the public profile, because
   * `toPublicProfile` is an allow-list and a range query does not belong in
   * it — and because this way the privacy flag is checked in one place.
   */
  app.get(
    '/profiles/:handle/activity',
    { preHandler: requireAuth, schema: { querystring: activityRangeSchema } },
    async (request, reply) => {
      const { handle } = request.params as { handle: string }
      const target = await app.mongo.db
        .collection<{ _id: string; privacy?: { activityMapVisible?: boolean } }>('profiles')
        .findOne({ handle })

      // Blocked either way reads as "no such person", the same as the profile
      // itself — a 403 here would confirm the account exists.
      const hidden = await blockedUserIds(app.mongo.db, request.userId)
      if (!target || hidden.includes(target._id)) {
        throw new ApiError(ERROR_CODES.NOT_FOUND, 'Profile not found')
      }
      // Absent means on: the flag was added after these profiles were written.
      if (target.privacy?.activityMapVisible === false) {
        return reply.send({ visible: false, days: [] })
      }

      const { from, to } = request.query
      const days = await listStreakDays(app.mongo.db, target._id, from, to)
      return reply.send({
        visible: true,
        // No counts and no source: how hard someone worked on a Tuesday, and
        // whether they paid for it, are theirs.
        days: days.map((d) => ({ day: d.day, intensity: intensityOf(d.actions) })),
      })
    },
  )
}

/**
 * Four buckets, because the exact count is the private part and the shape of a
 * habit is not. Thresholds rather than a scale so one very loud day cannot
 * flatten a year of ordinary ones.
 */
function intensityOf(actions: number): 1 | 2 | 3 | 4 {
  if (actions >= 30) return 4
  if (actions >= 10) return 3
  if (actions >= 3) return 2
  return 1
}
