import { blockSchema, moderationListQuerySchema, reportSchema } from '@langx/shared'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { reportEmail } from '../email/templates'
import { requireAuth, requireMember } from '../middleware/requireAuth'
import { blockUser, listBlocked, reportUser, unblockUser } from '../modules/moderation/blocks'
import { getViewers } from '../modules/moderation/profileViews'
import { getProfile, type Profile } from '../modules/profiles/profiles'

/** As much of somebody as the report email can show; a profile may be missing. */
function party(userId: string, profile: Profile | null) {
  return {
    userId,
    handle: profile?.handle ?? null,
    displayName: profile?.displayName ?? null,
  }
}

// eslint-disable-next-line @typescript-eslint/require-await -- Fastify plugin signature
export const moderationRoutes: FastifyPluginAsyncZod = async (app) => {
  app.post(
    '/blocks',
    { preHandler: requireMember, schema: { body: blockSchema } },
    async (request, reply) => {
      const block = await blockUser(app.mongo.db, request.userId, request.body.userId)
      return reply.code(201).send(block)
    },
  )

  app.get(
    '/blocks',
    { preHandler: requireAuth, schema: { querystring: moderationListQuerySchema } },
    async (request, reply) => {
      return reply.send(await listBlocked(app.mongo.db, request.userId, request.query))
    },
  )

  app.delete('/blocks/:userId', { preHandler: requireMember }, async (request, reply) => {
    const { userId } = request.params as { userId: string }
    await unblockUser(app.mongo.db, request.userId, userId)
    return reply.code(204).send()
  })

  app.post(
    '/reports',
    { preHandler: requireMember, schema: { body: reportSchema } },
    async (request, reply) => {
      const result = await reportUser(app.mongo.db, request.userId, request.body)

      /*
       * Somebody has to be told. Nothing reads `reports` — the console is
       * still ahead of us — so without this a report is a row nobody opens.
       *
       * Never fatal, unlike `POST /feedback`, where the mail *is* the record
       * and a failed send means the report is genuinely lost. Here the row and
       * the freeze are already written: turning a mail provider's bad minute
       * into a 500 would tell somebody their report of harassment failed when
       * it did not, and invite a retry that files it twice.
       */
      const [reporter, reported] = await Promise.all([
        getProfile(app.mongo.db, request.userId),
        getProfile(app.mongo.db, request.body.userId),
      ])
      try {
        await app.email.send({
          to: app.env.SUPPORT_EMAIL,
          ...reportEmail({
            reportId: result.report._id.toHexString(),
            reason: request.body.reason,
            details: result.report.details ?? null,
            reporter: party(request.userId, reporter),
            reported: party(request.body.userId, reported),
            xpFrozen: result.xpFrozen,
            context: {
              conversationId: result.report.conversationId?.toHexString() ?? null,
              messageId: result.report.messageId?.toHexString() ?? null,
              postId: result.report.postId?.toHexString() ?? null,
            },
          }),
        })
      } catch (error) {
        request.log.warn(
          { err: error, reportId: result.report._id },
          'report notification email failed',
        )
      }

      // `xpFrozen` is deliberately not echoed to the reporter: whether someone
      // else's earning is suspended is not the reporter's business, and
      // telling them turns the threshold into a game to probe.
      return reply.code(201).send({ id: result.report._id, status: result.report.status })
    },
  )

  app.get(
    '/me/viewers',
    { preHandler: requireAuth, schema: { querystring: moderationListQuerySchema } },
    async (request, reply) => {
      return reply.send(await getViewers(app.mongo.db, request.userId, request.query))
    },
  )
}
