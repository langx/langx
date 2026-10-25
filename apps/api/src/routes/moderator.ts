import {
  ERROR_CODES,
  REPORT_WARNINGS,
  adminListQuerySchema,
  moderatorDecisionSchema,
  moderatorWarnSchema,
} from '@langx/shared'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { COLLECTIONS } from '../db/collections'
import { ApiError } from '../lib/ApiError'
import { requireAuth, requireModerator } from '../middleware/requireAuth'
import { getReport, listReports, toObjectId } from '../modules/admin/reports'
import type { Report } from '../modules/moderation/blocks'
import { applyReviewDecision } from '../modules/moderation/decide'
import {
  listPublicModerators,
  moderatorReportScope,
  recordModeratorAction,
  toModReportDetail,
  toModReportRow,
} from '../modules/moderation/moderatorActions'
import { warnReported } from '../modules/moderation/warn'
import { emailOfficialNote } from '../modules/official/noteEmail'
import { refuse } from './admin'

/**
 * The moderator's API: the open report queue, and the decisions a moderator
 * may make from it.
 *
 * Its own prefix rather than `requireModerator` sprinkled over `/admin`, so
 * that every route a moderator can reach is in this one file. What is *not*
 * here is the point — Pro, tokens, appeals, lifting, permanence, the search
 * box — and adding any of it means adding it here, where a reviewer sees it.
 *
 * Every decision is written to `moderatorActions` with the reason the
 * moderator gave, which is what the operator panel reviews.
 */
// eslint-disable-next-line @typescript-eslint/require-await -- Fastify plugin signature
export const moderatorRoutes: FastifyPluginAsyncZod = async (app) => {
  const limit = (max: number, timeWindow: string) =>
    app.env.NODE_ENV === 'test' ? false : { max, timeWindow }

  /**
   * The report, if this moderator may act on it: open, not theirs, and not
   * about anybody protected. Anything else is answered as missing — from a
   * moderator's side, a report that is not theirs to decide does not exist.
   */
  const reportInScope = async (moderatorId: string, id: string) => {
    const reportId = toObjectId(id)
    const report = reportId
      ? await app.mongo.db
          .collection<Report>(COLLECTIONS.reports)
          .findOne({ _id: reportId, ...(await moderatorReportScope(app.mongo.db, moderatorId)) })
      : null
    if (!report || !reportId) throw new ApiError(ERROR_CODES.NOT_FOUND, 'No such report')
    return report
  }

  app.get(
    '/mod/reports',
    { preHandler: requireModerator, schema: { querystring: adminListQuerySchema } },
    async (request, reply) => {
      const page = await listReports(
        app.mongo.db,
        { ...request.query, status: 'open' },
        new Date(),
        await moderatorReportScope(app.mongo.db, request.userId),
      )
      return reply.send({ ...page, items: page.items.map(toModReportRow) })
    },
  )

  app.get(
    '/mod/reports/:id',
    { preHandler: requireModerator, schema: { params: z.object({ id: z.string() }) } },
    async (request, reply) => {
      await reportInScope(request.userId, request.params.id)
      const detail = await getReport(app.mongo.db, request.params.id)
      if (!detail) throw new ApiError(ERROR_CODES.NOT_FOUND, 'No such report')
      return reply.send(toModReportDetail(detail))
    },
  )

  app.post(
    '/mod/reports/:id/decision',
    {
      preHandler: requireModerator,
      schema: { params: z.object({ id: z.string() }), body: moderatorDecisionSchema },
      config: { rateLimit: limit(30, '1 minute') },
    },
    async (request, reply) => {
      const report = await reportInScope(request.userId, request.params.id)
      const { action, days, note } = request.body

      const result = await applyReviewDecision(app, {
        kind: 'report',
        userId: report.reportedId,
        reportId: report._id,
        action,
        ...(days === undefined ? {} : { days }),
        byAdminId: request.userId,
        ...(action === 'suspend' && note ? { moderatorNote: note } : {}),
      })
      if (!result.ok) return refuse(reply, result.refusal)

      await recordModeratorAction(app.mongo.db, {
        moderatorId: request.userId,
        reportId: report._id,
        subjectUserId: report.reportedId,
        action,
        ...(action === 'suspend' && days !== undefined ? { days } : {}),
        ...(note ? { note } : {}),
      })
      return reply.send(result.outcome)
    },
  )

  /**
   * Warning from @langx in words we wrote. The body names a reason, never a
   * sentence — see `moderatorWarnSchema` — and is otherwise the operator's
   * warning: once per report, and mailed too.
   */
  app.post(
    '/mod/reports/:id/warn',
    {
      preHandler: requireModerator,
      schema: { params: z.object({ id: z.string() }), body: moderatorWarnSchema },
      config: { rateLimit: limit(30, '1 minute') },
    },
    async (request, reply) => {
      const report = await reportInScope(request.userId, request.params.id)
      const body = REPORT_WARNINGS[request.body.reason]
      const result = await warnReported(app, {
        reportId: request.params.id,
        body,
        byAdminId: request.userId,
      })
      if (!result) throw new ApiError(ERROR_CODES.NOT_FOUND, 'No such report')

      let emailed = false
      if (result.warned && result.messageId) {
        try {
          emailed =
            (await emailOfficialNote(app.mongo.db, app.email, {
              userId: result.reportedId,
              messageId: result.messageId,
              body,
            })) === 'sent'
        } catch (error) {
          request.log.warn({ err: error, userId: result.reportedId }, 'warning email failed')
        }
      }

      if (result.warned) {
        await recordModeratorAction(app.mongo.db, {
          moderatorId: request.userId,
          reportId: report._id,
          subjectUserId: report.reportedId,
          action: 'warn',
          warningReason: request.body.reason,
        })
      }
      return reply.send({ warned: result.warned, emailed })
    },
  )

  /** Who moderates, for anybody signed in — the list in Settings. */
  app.get('/moderators', { preHandler: requireAuth }, async (_request, reply) => {
    return reply.send({ items: await listPublicModerators(app.mongo.db) })
  })
}
