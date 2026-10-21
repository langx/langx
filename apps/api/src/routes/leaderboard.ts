import {
  badgeCatalogueQuerySchema,
  giveStickerPackSchema,
  leaderboardQuerySchema,
  pinBadgesSchema,
  purchaseSchema,
  stickerGiftOptionsQuerySchema,
  streakLeaderboardQuerySchema,
} from '@langx/shared'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { requireAuth, requireVerifiedEmail } from '../middleware/requireAuth'
import { getBadgeSummary, pinBadges } from '../modules/tokens/badges'
import { getLeaderboard } from '../modules/tokens/leaderboard'
import { getStreakLeaderboard } from '../modules/tokens/streakLeaderboard'
import { claimGift } from '../modules/tokens/gift'
import { getStickerGiftOptions, giveStickerPack } from '../modules/tokens/stickerGifts'
import { getWallet, purchase } from '../modules/tokens/wallet'
import { fanOutMessage } from '../ws/fanOut'

// eslint-disable-next-line @typescript-eslint/require-await -- Fastify plugin signature
export const leaderboardRoutes: FastifyPluginAsyncZod = async (app) => {
  // The four tabs are one endpoint with a `period` parameter, not four routes:
  // the query is identical apart from which key it reads.
  app.get(
    '/leaderboard',
    { preHandler: requireAuth, schema: { querystring: leaderboardQuerySchema } },
    async (request, reply) => {
      const board = await getLeaderboard(app.mongo.db, request.userId, request.query)
      return reply.send(board)
    },
  )

  /*
   * A second route rather than a fifth tab on the one above, despite the
   * comment there. The parameters genuinely differ — no period, no cursor,
   * and a metric the token board has no equivalent for — so folding them into
   * one query schema would make every field optional and the handler a switch.
   */
  app.get(
    '/leaderboard/streak',
    { preHandler: requireAuth, schema: { querystring: streakLeaderboardQuerySchema } },
    async (request, reply) => {
      const board = await getStreakLeaderboard(app.mongo.db, request.userId, request.query)
      return reply.send(board)
    },
  )

  // Beside the leaderboard rather than under /me/tokens: the badge screen and
  // the ranking tabs are one screen, and this keeps it to one round trip's
  // worth of routes.
  // `?catalogue=v3` adds the kinds only the v3 shelf can draw; see `getBadgeSummary`.
  app.get(
    '/me/badges',
    { preHandler: requireAuth, schema: { querystring: badgeCatalogueQuerySchema } },
    async (request, reply) => {
      return reply.send(
        await getBadgeSummary(app.mongo.db, request.userId, new Date(), request.query.catalogue),
      )
    },
  )

  // The badges worn on your profile, chosen on the v3 shelf.
  app.post(
    '/me/badges/pinned',
    { preHandler: requireAuth, schema: { body: pinBadgesSchema } },
    async (request, reply) => {
      return reply.send(await pinBadges(app.mongo.db, request.userId, request.body.ids))
    },
  )

  app.get('/me/wallet', { preHandler: requireAuth }, async (request, reply) => {
    return reply.send(await getWallet(app.mongo.db, request.userId))
  })

  app.post(
    '/me/wallet/purchase',
    { preHandler: requireAuth, schema: { body: purchaseSchema } },
    async (request, reply) => {
      const result = await purchase(app.mongo.db, request.userId, request.body.sku)
      return reply.send(result)
    },
  )

  /*
   * Giving a sticker pack to a chat partner, behind `flags.stickerGifts`.
   * Everything is decided in the repository functions — the switch included —
   * so a client that draws the button by mistake still gets a refusal.
   */
  app.get(
    '/me/wallet/sticker-gifts/options',
    { preHandler: requireVerifiedEmail, schema: { querystring: stickerGiftOptionsQuerySchema } },
    async (request, reply) => {
      return reply.send(
        await getStickerGiftOptions(app.mongo.db, request.userId, request.query.packId),
      )
    },
  )

  app.post(
    '/me/wallet/sticker-gifts',
    {
      preHandler: requireVerifiedEmail,
      schema: { body: giveStickerPackSchema },
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const given = await giveStickerPack(app.mongo.db, request.userId, request.body)
      // The gift's row reaches both of them live and knocks if the recipient
      // is away — the one funnel every message takes. Only once: a retry
      // answered from its client id was announced by the first attempt.
      if (given.created) {
        void fanOutMessage(app, app.io, given.conversation, given.message, { pushWhenAway: true })
      }
      return reply.send(given.result)
    },
  )

  /*
   * The hourly gift. No body: there is nothing to choose. The per-route limit
   * only keeps a stuck client from hammering the database — the real gate is
   * the cooldown inside `claimGift`, which answers RATE_LIMITED with `retryAt`.
   */
  app.post(
    '/me/wallet/gift',
    { preHandler: requireAuth, config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (request, reply) => {
      return reply.send(await claimGift(app.mongo.db, request.userId))
    },
  )
}
