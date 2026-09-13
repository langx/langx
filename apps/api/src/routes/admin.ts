import {
  ERROR_CODES,
  adminListQuerySchema,
  adminMessageSchema,
  adminReportListQuerySchema,
  adminFeedbackListQuerySchema,
  adminSuspendSchema,
  adminUserSearchSchema,
  bountyAwardSchema,
  broadcastCreateSchema,
  reviewDecisionSchema,
} from '@langx/shared'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { COLLECTIONS } from '../db/collections'
import { ApiError } from '../lib/ApiError'
import { authId } from '../lib/authId'
import { requireAdmin } from '../middleware/requireAuth'
import { recordAdminAction } from '../modules/admin/auditLog'
import {
  countBroadcastAudience,
  createBroadcast,
  deleteBroadcast,
  getBroadcast,
  listBroadcasts,
  setBroadcastStatus,
} from '../modules/admin/broadcast'
import { sendBroadcastTest } from '../modules/admin/broadcastQueue'
import { getReport, listAppeals, listReports, toObjectId } from '../modules/admin/reports'
import { readAdminStats } from '../modules/admin/stats'
import { findAdminUser, getAdminUser } from '../modules/admin/users'
import { payBounty } from '../modules/feedback/awardBounty'
import { getFeedback, listFeedback, updateFeedback } from '../modules/feedback/reports'
import { setPostHidden } from '../modules/feed/feed'
import { applyReviewDecision, type ReviewRefusal } from '../modules/moderation/decide'
import { deliverOfficialMessage } from '../modules/official/deliver'
import { getProfile, type Profile } from '../modules/profiles/profiles'
import { fanOutMessage } from '../ws/fanOut'
import { userRoom } from '../ws/types'

/**
 * The operator panel's API.
 *
 * Everything here is behind `requireAdmin`, which reads a flag on a profile —
 * see the note on that guard for why `ADMIN_USER_IDS` is not what authorises
 * it.
 *
 * JSON and nothing else. The two server-rendered pages in `moderation.ts` and
 * `feedback.ts` stay exactly where they are: a signed link in a mailbox is the
 * path that still works when nobody can sign in, and the one somebody can be
 * handed without an account. The panel is the surface you reach for; those are
 * the one you fall back to. Both drive `applyReviewDecision`, so neither can
 * drift from the other.
 *
 * Every mutating route records what it did *after* it did it, through
 * `recordAdminAction`, which never throws — see the note there.
 */

/** What a refusal from `applyReviewDecision` becomes over JSON. */
const REFUSALS: Record<ReviewRefusal, [code: string, status: number, message: string]> = {
  action_not_allowed: [ERROR_CODES.VALIDATION_FAILED, 400, 'That decision does not belong here'],
  account_gone: [ERROR_CODES.NOT_FOUND, 404, 'That account no longer exists'],
  not_a_post: [ERROR_CODES.VALIDATION_FAILED, 400, 'That report is not about a post'],
  post_gone: [ERROR_CODES.NOT_FOUND, 404, 'That post no longer exists'],
}

// eslint-disable-next-line @typescript-eslint/require-await -- Fastify plugin signature
export const adminRoutes: FastifyPluginAsyncZod = async (app) => {
  /**
   * Ceilings rather than anti-abuse limits: one person holds this flag, and
   * what these guard against is a stuck client or a slipped keypress. Disabled
   * under test, the way `moderation.ts` and `feedback.ts` both do it.
   */
  const limit = (max: number, timeWindow: string) =>
    app.env.NODE_ENV === 'test' ? false : { max, timeWindow }

  app.get('/admin/stats', { preHandler: requireAdmin }, async (_request, reply) => {
    return reply.send(await readAdminStats(app.mongo.db))
  })

  // ── reports ──────────────────────────────────────────────────────────────

  app.get(
    '/admin/reports',
    { preHandler: requireAdmin, schema: { querystring: adminReportListQuerySchema } },
    async (request, reply) => {
      return reply.send(await listReports(app.mongo.db, request.query))
    },
  )

  app.get(
    '/admin/reports/:id',
    { preHandler: requireAdmin, schema: { params: z.object({ id: z.string() }) } },
    async (request, reply) => {
      const report = await getReport(app.mongo.db, request.params.id)
      if (!report) throw new ApiError(ERROR_CODES.NOT_FOUND, 'No such report')
      return reply.send(report)
    },
  )

  app.post(
    '/admin/reports/:id/decision',
    {
      preHandler: requireAdmin,
      schema: { params: z.object({ id: z.string() }), body: reviewDecisionSchema },
      config: { rateLimit: limit(60, '1 minute') },
    },
    async (request, reply) => {
      const reportId = toObjectId(request.params.id)
      const report = reportId
        ? await app.mongo.db
            .collection<{ reportedId: string }>(COLLECTIONS.reports)
            .findOne({ _id: reportId })
        : null
      if (!report || !reportId) throw new ApiError(ERROR_CODES.NOT_FOUND, 'No such report')

      const result = await applyReviewDecision(app, {
        kind: 'report',
        userId: report.reportedId,
        reportId,
        action: request.body.action,
        ...(request.body.days === undefined ? {} : { days: request.body.days }),
        byAdminId: request.userId,
      })
      if (!result.ok) return refuse(reply, result.refusal)

      await recordAdminAction(app.mongo.db, request.log, {
        adminId: request.userId,
        action: 'report.decide',
        subjectUserId: report.reportedId,
        refId: request.params.id,
        payload: { ...request.body },
      })
      return reply.send(result.outcome)
    },
  )

  // ── appeals ──────────────────────────────────────────────────────────────

  app.get(
    '/admin/appeals',
    { preHandler: requireAdmin, schema: { querystring: adminListQuerySchema } },
    async (request, reply) => {
      return reply.send(await listAppeals(app.mongo.db, { ...request.query, status: 'open' }))
    },
  )

  app.post(
    '/admin/appeals/:userId/decision',
    {
      preHandler: requireAdmin,
      schema: { params: z.object({ userId: z.string() }), body: reviewDecisionSchema },
      config: { rateLimit: limit(60, '1 minute') },
    },
    async (request, reply) => {
      const profile = await getProfile(app.mongo.db, request.params.userId)
      if (!profile) throw new ApiError(ERROR_CODES.NOT_FOUND, 'No such account')

      const result = await applyReviewDecision(app, {
        kind: 'appeal',
        userId: request.params.userId,
        reportId: profile.suspension?.reportId ?? null,
        action: request.body.action,
        ...(request.body.days === undefined ? {} : { days: request.body.days }),
        byAdminId: request.userId,
      })
      if (!result.ok) return refuse(reply, result.refusal)

      await recordAdminAction(app.mongo.db, request.log, {
        adminId: request.userId,
        action: 'appeal.decide',
        subjectUserId: request.params.userId,
        payload: { ...request.body },
      })
      return reply.send(result.outcome)
    },
  )

  // ── one account ──────────────────────────────────────────────────────────

  app.get(
    '/admin/users',
    { preHandler: requireAdmin, schema: { querystring: adminUserSearchSchema } },
    async (request, reply) => {
      const profile = await findAdminUser(app.mongo.db, request.query.q)
      if (!profile) throw new ApiError(ERROR_CODES.NOT_FOUND, 'Nobody by that name or address')
      return reply.send(await getAdminUser(app.mongo.db, profile))
    },
  )

  app.get(
    '/admin/users/:userId',
    { preHandler: requireAdmin, schema: { params: z.object({ userId: z.string() }) } },
    async (request, reply) => {
      const profile = await getProfile(app.mongo.db, request.params.userId)
      if (!profile) throw new ApiError(ERROR_CODES.NOT_FOUND, 'No such account')
      return reply.send(await getAdminUser(app.mongo.db, profile))
    },
  )

  /**
   * Suspending somebody the panel found rather than somebody a report named.
   *
   * Through `applyReviewDecision` with no report, so the notice, the stamp and
   * the shape of the sub-document are identical to a decision taken from a
   * report. `adminSuspendSchema` offers no `permanent`: a suspension that
   * never ends should be reached from the evidence that justifies it.
   */
  app.post(
    '/admin/users/:userId/suspend',
    {
      preHandler: requireAdmin,
      schema: { params: z.object({ userId: z.string() }), body: adminSuspendSchema },
      config: { rateLimit: limit(60, '1 minute') },
    },
    async (request, reply) => {
      const result = await applyReviewDecision(app, {
        kind: 'report',
        userId: request.params.userId,
        reportId: null,
        action: 'suspend',
        days: request.body.days,
        // There is no report to read a reason from, so the one typed here is it.
        reason: request.body.reason,
        byAdminId: request.userId,
      })
      if (!result.ok) return refuse(reply, result.refusal)

      await recordAdminAction(app.mongo.db, request.log, {
        adminId: request.userId,
        action: 'user.suspend',
        subjectUserId: request.params.userId,
        payload: { ...request.body },
      })
      return reply.send(result.outcome)
    },
  )

  app.post(
    '/admin/users/:userId/lift',
    {
      preHandler: requireAdmin,
      schema: { params: z.object({ userId: z.string() }) },
      config: { rateLimit: limit(60, '1 minute') },
    },
    async (request, reply) => {
      const result = await applyReviewDecision(app, {
        kind: 'appeal',
        userId: request.params.userId,
        reportId: null,
        action: 'lift',
        byAdminId: request.userId,
      })
      if (!result.ok) return refuse(reply, result.refusal)

      await recordAdminAction(app.mongo.db, request.log, {
        adminId: request.userId,
        action: 'user.lift',
        subjectUserId: request.params.userId,
      })
      return reply.send(result.outcome)
    },
  )

  /**
   * Thaws an account's earning.
   *
   * `reportUser` freezes it once three distinct people have reported somebody
   * (`REPORTS_TO_FREEZE_XP`), and until this route existed **nothing in the
   * codebase ever cleared it** — a report that turned out to be wrong left
   * that person unable to earn a token, permanently and silently. This is the
   * other half of dismissing a report.
   */
  app.post(
    '/admin/users/:userId/unfreeze-tokens',
    {
      preHandler: requireAdmin,
      schema: { params: z.object({ userId: z.string() }) },
      config: { rateLimit: limit(60, '1 minute') },
    },
    async (request, reply) => {
      const result = await app.mongo.db
        .collection<Profile>(COLLECTIONS.profiles)
        .updateOne({ _id: request.params.userId }, { $unset: { tokenFrozenAt: '' } })
      if (result.matchedCount === 0) throw new ApiError(ERROR_CODES.NOT_FOUND, 'No such account')

      await recordAdminAction(app.mongo.db, request.log, {
        adminId: request.userId,
        action: 'user.unfreeze',
        subjectUserId: request.params.userId,
      })
      return reply.send({ thawed: result.modifiedCount > 0 })
    },
  )

  /**
   * Signs one account out everywhere — for the compromised account, where the
   * answer is not a suspension.
   *
   * Two halves, because a session and a socket are revoked by different
   * things. Deleting the rows shuts REST immediately; a socket that is already
   * open authenticated at its handshake and would not notice, so it is
   * disconnected here rather than left until its next reconnect.
   *
   * `authId` because Better Auth's collections store ids as ObjectId and ours
   * store the string — a string against `session` matches nothing and reports
   * success.
   */
  app.post(
    '/admin/users/:userId/sign-out',
    {
      preHandler: requireAdmin,
      schema: { params: z.object({ userId: z.string() }) },
      config: { rateLimit: limit(30, '1 minute') },
    },
    async (request, reply) => {
      const { deletedCount } = await app.mongo.db
        .collection(COLLECTIONS.session)
        .deleteMany({ userId: authId(request.params.userId) })
      app.io.in(userRoom(request.params.userId)).disconnectSockets(true)

      await recordAdminAction(app.mongo.db, request.log, {
        adminId: request.userId,
        action: 'user.signOut',
        subjectUserId: request.params.userId,
        payload: { sessions: deletedCount },
      })
      return reply.send({ sessions: deletedCount })
    },
  )

  // ── bug reports and ideas ────────────────────────────────────────────────

  app.get(
    '/admin/feedback',
    { preHandler: requireAdmin, schema: { querystring: adminFeedbackListQuerySchema } },
    async (request, reply) => {
      return reply.send(await listFeedback(app.mongo.db, request.query))
    },
  )

  app.get(
    '/admin/feedback/:id',
    { preHandler: requireAdmin, schema: { params: z.object({ id: z.string() }) } },
    async (request, reply) => {
      const row = await getFeedback(app.mongo.db, request.params.id)
      if (!row) throw new ApiError(ERROR_CODES.NOT_FOUND, 'No such report')
      return reply.send(row)
    },
  )

  app.patch(
    '/admin/feedback/:id',
    {
      preHandler: requireAdmin,
      schema: {
        params: z.object({ id: z.string() }),
        body: z.object({
          status: z.enum(['open', 'triaged', 'closed']).optional(),
          issueUrl: z.url().optional(),
          closeReason: z.enum(['fixed', 'shipped', 'wontfix', 'duplicate', 'invalid']).optional(),
          note: z.string().trim().max(1000).optional(),
        }),
      },
      config: { rateLimit: limit(60, '1 minute') },
    },
    async (request, reply) => {
      const row = await updateFeedback(
        app.mongo.db,
        request.params.id,
        {
          ...(request.body.status ? { status: request.body.status } : {}),
          ...(request.body.issueUrl ? { issueUrl: request.body.issueUrl } : {}),
          ...(request.body.closeReason ? { closeReason: request.body.closeReason } : {}),
          ...(request.body.note === undefined ? {} : { note: request.body.note }),
        },
        request.userId,
      )
      if (!row) throw new ApiError(ERROR_CODES.NOT_FOUND, 'No such report')

      await recordAdminAction(app.mongo.db, request.log, {
        adminId: request.userId,
        action: 'feedback.update',
        subjectUserId: row.userId,
        refId: request.params.id,
        payload: { ...request.body },
      })
      return reply.send(row)
    },
  )

  /**
   * Paying for a confirmed report.
   *
   * Through `payBounty`, which the emailed link also calls — so the ledger's
   * unique `{userId, kind, refId}` index makes it paid once *across both
   * doors*, not once per door. A second press of either says so and changes
   * nothing.
   */
  app.post(
    '/admin/feedback/:id/award',
    {
      preHandler: requireAdmin,
      schema: { params: z.object({ id: z.string() }), body: bountyAwardSchema },
      config: { rateLimit: limit(30, '1 hour') },
    },
    async (request, reply) => {
      const row = await getFeedback(app.mongo.db, request.params.id)
      if (!row) throw new ApiError(ERROR_CODES.NOT_FOUND, 'No such report')

      const result = await payBounty(app, {
        userId: row.userId,
        refId: row._id,
        amount: request.body.amount,
      })

      if (result.awarded) {
        await recordAdminAction(app.mongo.db, request.log, {
          adminId: request.userId,
          action: 'feedback.award',
          subjectUserId: row.userId,
          refId: row._id,
          payload: { amount: result.amount },
        })
      }
      return reply.send(result)
    },
  )

  // ── one message, and a message to everybody ──────────────────────────────

  /**
   * A message from `@langx` to one person.
   *
   * **One way.** `OFFICIAL_WRITABLE.langx` is false, so `recordMessage`
   * refuses anything addressed back and the chat screen draws no composer —
   * which is a deliberate product decision (a broadcast account that sometimes
   * replies is a promise about attention nobody can keep) and is not being
   * undone here. So this is right for "your report was received", "the bounty
   * is paid", "your suspension was lifted", and wrong for a conversation: what
   * is written should say where a reply goes.
   */
  app.post(
    '/admin/users/:userId/message',
    {
      preHandler: requireAdmin,
      schema: { params: z.object({ userId: z.string() }), body: adminMessageSchema },
      config: { rateLimit: limit(60, '1 minute') },
    },
    async (request, reply) => {
      const delivered = await deliverOfficialMessage(app.mongo.db, {
        fromHandle: 'langx',
        toUserId: request.params.userId,
        body: request.body.body,
        // Unique per send rather than per subject: the same words twice are
        // two messages here, unlike a broadcast, which must never repeat.
        clientId: `admin:${request.userId}:${Date.now()}`,
      })
      if (!delivered) {
        throw new ApiError(ERROR_CODES.NOT_FOUND, 'There is no @langx account to send from')
      }
      await fanOutMessage(app, app.io, delivered.conversation, delivered.message, {
        pushWhenAway: true,
      })

      await recordAdminAction(app.mongo.db, request.log, {
        adminId: request.userId,
        action: 'user.message',
        subjectUserId: request.params.userId,
        // The body is deliberately not stored here: it is already a message
        // row, and the audit log is a record of decisions rather than a second
        // copy of everything anybody was told.
        refId: delivered.message._id.toHexString(),
      })
      return reply.code(201).send({ conversationId: delivered.conversation._id.toHexString() })
    },
  )

  app.get('/admin/broadcasts', { preHandler: requireAdmin }, async (_request, reply) => {
    return reply.send({
      items: await listBroadcasts(app.mongo.db),
      audience: await countBroadcastAudience(app.mongo.db),
    })
  })

  app.post(
    '/admin/broadcasts',
    {
      preHandler: requireAdmin,
      schema: { body: broadcastCreateSchema },
      config: { rateLimit: limit(30, '1 hour') },
    },
    async (request, reply) => {
      if (await getBroadcast(app.mongo.db, request.body.id)) {
        throw new ApiError(ERROR_CODES.VALIDATION_FAILED, 'That slug has already been used')
      }
      const job = await createBroadcast(app.mongo.db, {
        id: request.body.id,
        bodies: request.body.bodies,
        pushTitle: request.body.pushTitle,
        createdBy: request.userId,
      })

      await recordAdminAction(app.mongo.db, request.log, {
        adminId: request.userId,
        action: 'broadcast.create',
        refId: job._id,
        payload: { total: job.total, locales: Object.keys(job.bodies) },
      })
      return reply.code(201).send(job)
    },
  )

  app.get(
    '/admin/broadcasts/:id',
    { preHandler: requireAdmin, schema: { params: z.object({ id: z.string() }) } },
    async (request, reply) => {
      const job = await getBroadcast(app.mongo.db, request.params.id)
      if (!job) throw new ApiError(ERROR_CODES.NOT_FOUND, 'No such broadcast')
      return reply.send(job)
    },
  )

  /** To the operator and nobody else — see `sendBroadcastTest`. */
  app.post(
    '/admin/broadcasts/:id/test',
    {
      preHandler: requireAdmin,
      schema: { params: z.object({ id: z.string() }) },
      config: { rateLimit: limit(30, '1 hour') },
    },
    async (request, reply) => {
      const job = await getBroadcast(app.mongo.db, request.params.id)
      if (!job) throw new ApiError(ERROR_CODES.NOT_FOUND, 'No such broadcast')

      const delivered = await sendBroadcastTest(app.mongo.db, app.push, job, request.userId)
      await recordAdminAction(app.mongo.db, request.log, {
        adminId: request.userId,
        action: 'broadcast.test',
        refId: job._id,
      })
      return reply.send({ delivered })
    },
  )

  /*
   * Arming, stopping and letting go again. The transitions live in
   * `setBroadcastStatus` as a table; a refused one is a 409 rather than a
   * silent no-op, because "I pressed Start and nothing happened" is the one
   * thing this screen must never do.
   */
  for (const [path, next, action] of [
    ['start', 'queued', 'broadcast.start'],
    ['pause', 'paused', 'broadcast.pause'],
    ['resume', 'queued', 'broadcast.resume'],
  ] as const) {
    app.post(
      `/admin/broadcasts/:id/${path}`,
      {
        preHandler: requireAdmin,
        schema: { params: z.object({ id: z.string() }) },
        // Five an hour on the irreversible one. Not anti-abuse — one person
        // holds this flag — but a bound on the blast radius of a stuck client.
        config: { rateLimit: limit(path === 'start' ? 5 : 30, '1 hour') },
      },
      async (request, reply) => {
        const job = await setBroadcastStatus(app.mongo.db, request.params.id, next)
        if (!job) {
          throw new ApiError(
            ERROR_CODES.VALIDATION_FAILED,
            'That broadcast is not in a state this can change',
          )
        }
        await recordAdminAction(app.mongo.db, request.log, {
          adminId: request.userId,
          action,
          refId: job._id,
          payload: { status: job.status, sent: job.sent, total: job.total },
        })
        return reply.send(job)
      },
    )
  }

  /** Only a draft: once it has been armed there may be messages out. */
  app.delete(
    '/admin/broadcasts/:id',
    { preHandler: requireAdmin, schema: { params: z.object({ id: z.string() }) } },
    async (request, reply) => {
      if (!(await deleteBroadcast(app.mongo.db, request.params.id))) {
        throw new ApiError(ERROR_CODES.VALIDATION_FAILED, 'Only a draft can be deleted')
      }
      await recordAdminAction(app.mongo.db, request.log, {
        adminId: request.userId,
        action: 'broadcast.delete',
        refId: request.params.id,
      })
      return reply.code(204).send()
    },
  )

  // ── one post ─────────────────────────────────────────────────────────────

  /**
   * Hiding a post nobody reported.
   *
   * `setPostHidden` has existed since the feed did, and the only way to reach
   * it was a report — so a post you found yourself could not be hidden until
   * somebody else complained about it. Reversible, and deliberately still no
   * delete: see `REPORT_REVIEW_ACTIONS` for why that stays a script.
   */
  for (const hidden of [true, false]) {
    app.post(
      `/admin/posts/:postId/${hidden ? 'hide' : 'unhide'}`,
      {
        preHandler: requireAdmin,
        schema: { params: z.object({ postId: z.string() }) },
        config: { rateLimit: limit(60, '1 minute') },
      },
      async (request, reply) => {
        const before = await setPostHidden(app.mongo.db, request.params.postId, hidden)
        if (!before) throw new ApiError(ERROR_CODES.NOT_FOUND, 'No such post')

        await recordAdminAction(app.mongo.db, request.log, {
          adminId: request.userId,
          action: hidden ? 'post.hide' : 'post.unhide',
          subjectUserId: before.authorId,
          refId: request.params.postId,
        })
        return reply.send({ hidden, changed: Boolean(before.hiddenAt) !== hidden })
      },
    )
  }
}

function refuse(
  reply: { code: (status: number) => { send: (body: unknown) => unknown } },
  refusal: ReviewRefusal,
) {
  const [code, status, message] = REFUSALS[refusal]
  return reply.code(status).send({ code, message })
}
