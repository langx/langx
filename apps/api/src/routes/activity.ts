import {
  activityRangeSchema,
  ERROR_CODES,
  localDayKey,
  repairDaySchema,
  TOKEN_RULES,
  ACTIVITY_MAX_RANGE_DAYS,
  shiftDayKey,
} from '@langx/shared'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { ApiError } from '../lib/ApiError'
import { requireAuth } from '../middleware/requireAuth'
import { getProfile } from '../modules/profiles/profiles'
import { blockedUserIds } from '../modules/moderation/blocks'
import { getPublicSummary } from '../modules/tokens/publicSummary'
import { listStreakDays, repairsInMonth } from '../modules/tokens/streakDays'
import { recordCheckIn } from '../modules/tokens/streak'
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
      /**
       * Clamped, at last. `activityRangeSchema` validates the *shape* of the
       * two keys and nothing else — no span, no ordering — while the client has
       * carried a comment claiming "the server clamps the range" since the map
       * shipped. Anyone could ask for a decade.
       */
      const oldest = shiftDayKey(today, -ACTIVITY_MAX_RANGE_DAYS)
      const start = from < oldest ? oldest : from
      const days = await listStreakDays(app.mongo.db, request.userId, start, to)

      return reply.send({
        today,
        /**
         * The streak, alongside the days.
         *
         * `streakDays` only started existing when the map shipped, so an
         * account older than that has a streak counter with no squares behind
         * it — and the map drew six months of empty boxes under a "🔥 40".
         * The client fills the current run from these two numbers when a day
         * has no row of its own; see `activityGrid`.
         */
        streak: {
          current: profile.streak.current,
          lastQualifiedDay: profile.streak.lastQualifiedDay,
        },
        days: days.map((d) => ({
          day: d.day,
          actions: d.actions,
          source: d.source,
          /**
           * Absent on days recorded before the field existed, and on a bought
           * day, which has no check-in. The client says so rather than
           * inventing a time.
           */
          ...(d.firstAt ? { firstAt: d.firstAt.toISOString() } : {}),
        })),
        repair: {
          price: TOKEN_RULES.sinks.dayRepair,
          maxAgeDays: TOKEN_RULES.sinks.dayRepairMaxAgeDays,
          perMonth: TOKEN_RULES.sinks.dayRepairPerMonth,
          usedThisMonth: await repairsInMonth(app.mongo.db, request.userId, today),
        },
      })
    },
  )

  /**
   * Opening the app, as far as the streak is concerned.
   *
   * A route of its own rather than a side effect of `GET /me/activity` or of
   * the socket connecting: a write hidden inside a read is the kind of thing
   * that fires from a background refresh, a prefetch or a test, and "your
   * streak advanced because something polled" is not a rule anybody could
   * predict. The client says so explicitly, once a day.
   *
   * Idempotent by construction — the second call of the day finds the day
   * already credited and changes nothing — so a client that loses the response
   * and retries costs a document read.
   */
  app.post('/me/check-in', { preHandler: requireAuth }, async (request, reply) => {
    const profile = await getProfile(app.mongo.db, request.userId)
    if (!profile) throw new ApiError(ERROR_CODES.NOT_FOUND, 'Complete onboarding first')

    const result = await recordCheckIn(app.mongo.db, profile, new Date())
    return reply.send({
      current: result.current,
      longest: result.longest,
      lastQualifiedDay: result.lastQualifiedDay,
      advanced: result.advanced,
      freezeUsed: result.freezeUsed,
    })
  })

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
        .collection<{
          _id: string
          timezone?: string
          streak?: { current: number; lastQualifiedDay: string | null }
          privacy?: { activityMapVisible?: boolean }
        }>('profiles')
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
        today: localDayKey(new Date(), target.timezone ?? 'UTC'),
        streak: {
          current: target.streak?.current ?? 0,
          lastQualifiedDay: target.streak?.lastQualifiedDay ?? null,
        },
        // No counts and no source: how hard someone worked on a Tuesday, and
        // whether they paid for it, are theirs.
        days: days.map((d) => ({ day: d.day, intensity: intensityOf(d.actions) })),
      })
    },
  )

  /**
   * The numbers a profile shows about how somebody uses the app.
   *
   * Beside the map rather than inside `toPublicProfile` for the same two
   * reasons: it costs three queries the profile route should not pay for, and
   * its privacy flag is then checked in exactly one place.
   */
  app.get('/profiles/:handle/summary', { preHandler: requireAuth }, async (request, reply) => {
    const { handle } = request.params as { handle: string }
    const target = await app.mongo.db
      .collection<{ _id: string }>('profiles')
      .findOne({ handle }, { projection: { _id: 1 } })

    const hidden = await blockedUserIds(app.mongo.db, request.userId)
    if (!target || hidden.includes(target._id)) {
      throw new ApiError(ERROR_CODES.NOT_FOUND, 'Profile not found')
    }

    const summary = await getPublicSummary(app.mongo.db, target._id)
    if (!summary) throw new ApiError(ERROR_CODES.NOT_FOUND, 'Profile not found')
    return reply.send(summary)
  })
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
