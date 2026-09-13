import {
  SUSPENSION_MAX_DAYS,
  appealSchema,
  attachmentsOf,
  blockSchema,
  moderationListQuerySchema,
  reportSchema,
  reviewDecisionSchema,
  type ReviewAction,
} from '@langx/shared'
import { ObjectId } from 'mongodb'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { appealEmail, reportEmail } from '../email/templates'
import {
  REVIEW_TOKEN_TTL_MS,
  reviewUrl,
  signReviewToken,
  verifyReviewToken,
} from '../email/reviewToken'
import { COLLECTIONS } from '../db/collections'
import { publicApiUrl } from '../env'
import { requireAuth, requireMember } from '../middleware/requireAuth'
import type { Post } from '../modules/feed/feed'
import { blockUser, listBlocked, reportUser, unblockUser } from '../modules/moderation/blocks'
import {
  applyReviewDecision,
  type ReviewOutcome,
  type ReviewRefusal,
} from '../modules/moderation/decide'
import { getViewers } from '../modules/moderation/profileViews'
import { submitAppeal, suspensionStatus } from '../modules/moderation/suspension'
import { getProfile, type Profile } from '../modules/profiles/profiles'
import { escapeHtml, html, page, submitButton, who } from './operatorPage'

/** As much of somebody as the report email can show; a profile may be missing. */
function party(userId: string, profile: Profile | null) {
  return {
    userId,
    handle: profile?.handle ?? null,
    displayName: profile?.displayName ?? null,
  }
}

/** An id that came out of a URL. `new ObjectId` throws on anything else. */
function toObjectId(value: string | null): ObjectId | null {
  if (!value) return null
  try {
    return new ObjectId(value)
  } catch {
    return null
  }
}

const REVIEW_TITLE = 'Review'

/** A number-of-days field with the button that uses it, as one row. */
function daysForm(token: string, action: ReviewAction, label: string, value: number): string {
  return `<form method="post" action="/moderation/review?token=${encodeURIComponent(token)}" style="margin:0 0 12px;">
            <input type="hidden" name="action" value="${action}" />
            <input type="number" name="days" value="${value}" min="1" max="${SUSPENSION_MAX_DAYS}" required
                   style="font-size:18px;padding:10px;width:100px;border:1px solid #ccc;border-radius:8px;margin-right:8px;" />
            ${submitButton(label)}
          </form>`
}

function actionForm(token: string, action: ReviewAction, label: string): string {
  return `<form method="post" action="/moderation/review?token=${encodeURIComponent(token)}" style="margin:0 0 12px;">
            <input type="hidden" name="action" value="${action}" />
            ${submitButton(label)}
          </form>`
}

/**
 * The reported post, shown before the decisions about its author.
 *
 * Shown at all because the mail before it carries only an id and a link, and
 * following that link means signing in as somebody who can see the post — the
 * decision should not depend on being able to. The sentence is what is being
 * judged, so it is on the page that judges it.
 *
 * Nothing here for a report raised from a profile or a message: a post-shaped
 * empty box on those would suggest one is missing.
 */
function postSection(token: string, post: Post | null): string {
  if (!post) return ''
  const attachments = attachmentsOf(post).length
  const files = attachments > 0 ? ` · ${attachments} attachment${attachments > 1 ? 's' : ''}` : ''
  return `<p style="margin:24px 0 8px;"><strong>The post</strong> <span style="color:#888;">${escapeHtml(post.language)}${files}</span></p>
          <blockquote style="white-space:pre-wrap;border-left:3px solid #ddd;margin:0 0 12px;padding:0 0 0 12px;color:#333;">${escapeHtml(post.body)}</blockquote>
          ${
            post.hiddenAt
              ? `<p style="background:#fff3cd;padding:12px;border-radius:8px;">Hidden since <strong>${escapeHtml(post.hiddenAt.toISOString())}</strong>. Nobody can see it, its author included.</p>
                 ${actionForm(token, 'unhide_post', 'Show it again')}`
              : actionForm(token, 'hide_post', 'Hide this post')
          }`
}

/** Why a decision could not be made, as this page says it. */
const REFUSALS: Record<ReviewRefusal, [number, string]> = {
  action_not_allowed: [400, 'That link cannot make that decision.'],
  account_gone: [404, 'That account no longer exists.'],
  not_a_post: [400, 'That report is not about a post.'],
  post_gone: [404, 'That post no longer exists.'],
}

/** What was decided, in the one sentence this page answers with. */
function decided(outcome: ReviewOutcome, name: string): string {
  switch (outcome.action) {
    case 'hide_post':
      return `<p>Hidden. Nobody can see it, ${name} included${outcome.changed ? '' : ' — it already was'}.</p>`
    case 'unhide_post':
      return `<p>Back in the feed${outcome.changed ? '' : ' — it was never hidden'}.</p>`
    case 'dismiss':
      return `<p>Dismissed. Nothing changes on ${name}.</p>`
    case 'keep':
      return `<p>Kept as it is. ${name} was not told.</p>`
    case 'suspend':
    case 'permanent':
      return `<p>${name} is suspended ${
        outcome.permanent
          ? '<strong>permanently</strong>'
          : `until <strong>${escapeHtml(outcome.until.toISOString())}</strong>`
      }.</p>`
    case 'shorten':
      return `<p>${name} is now suspended until <strong>${escapeHtml(outcome.until.toISOString())}</strong>.</p>`
    case 'lift':
      return `<p>Lifted. ${name} can use the app again.</p>`
  }
}

/**
 * Blocks, reports, and what a report can lead to.
 *
 * Suspension is decided from the signed link in the report email, not from a
 * route with a session behind it. There is no moderation console and this
 * does not build one: the review happens in the mailbox where the report
 * already arrives, which is the same trade `feedback.ts` makes for a bounty.
 * See `email/reviewToken.ts` for what authorises those two routes.
 */
// eslint-disable-next-line @typescript-eslint/require-await -- Fastify plugin signature
export const moderationRoutes: FastifyPluginAsyncZod = async (app) => {
  /*
   * The review page posts a form, and Fastify parses JSON and nothing else
   * until it is told to. Registered inside this plugin, so it is these routes
   * that gain a form parser and not every POST in the API — the same thing
   * `feedback.ts` does for the award page.
   */
  app.addContentTypeParser(
    'application/x-www-form-urlencoded',
    { parseAs: 'string' },
    (_request, body: string, done) => {
      done(null, Object.fromEntries(new URLSearchParams(body)))
    },
  )

  /** None of it under `NODE_ENV=test` — see the same helper in `feedback.ts`. */
  const limit = (max: number, timeWindow: string) =>
    app.env.NODE_ENV === 'test' ? false : { max, timeWindow }

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
       * Somebody has to be told, and — since this mail now carries the link
       * that decides the report — it is also the only way the decision can be
       * made at all.
       *
       * Never fatal, unlike `POST /feedback`, where the mail *is* the record
       * and a failed send means the report is genuinely lost. Here the row and
       * the freeze are already written: turning a mail provider's bad minute
       * into a 500 would tell somebody their report of harassment failed when
       * it did not, and invite a retry that files it twice.
       */
      const [reporter, reported, post] = await Promise.all([
        getProfile(app.mongo.db, request.userId),
        getProfile(app.mongo.db, request.body.userId),
        result.report.postId
          ? app.mongo.db
              .collection<Post>(COLLECTIONS.posts)
              .findOne({ _id: result.report.postId }, { projection: { body: 1 } })
          : null,
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
            postBody: post?.body ?? null,
            reviewUrl: reviewUrl(
              publicApiUrl(app.env),
              signReviewToken(app.env.BETTER_AUTH_SECRET, {
                kind: 'report',
                userId: request.body.userId,
                reportId: result.report._id.toHexString(),
                expiresAt: Date.now() + REVIEW_TOKEN_TTL_MS,
              }),
            ),
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
      // telling them turns the threshold into a game to probe. Nor is the
      // outcome, later — see `docs/community-guidelines.md`.
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

  /**
   * The page the report email's button opens: what was reported, what is
   * already in force, and the three decisions.
   *
   * A GET that only asks. Mail clients and link scanners follow links in a
   * mailbox on their own, so the page a link opens must never be the thing
   * that suspends somebody — that is the POST below, behind a button a person
   * pressed.
   */
  app.get(
    '/moderation/review',
    { config: { rateLimit: limit(30, '1 minute') } },
    async (request, reply) => {
      const token = (request.query as { token?: string }).token
      const claim = verifyReviewToken(app.env.BETTER_AUTH_SECRET, token)
      if (!claim || !token) {
        return html(reply.code(400), page(REVIEW_TITLE, 'That link is no longer valid.'))
      }

      const profile = await getProfile(app.mongo.db, claim.userId)
      if (!profile) {
        return html(reply.code(404), page(REVIEW_TITLE, 'That account no longer exists.'))
      }

      const name = escapeHtml(who(profile.handle, claim.userId))
      const suspension = profile.suspension
      const inForce = suspension
        ? `<p style="background:#fff3cd;padding:12px;border-radius:8px;">Already suspended ${
            suspension.permanent
              ? '<strong>permanently</strong>'
              : `until <strong>${escapeHtml(new Date(suspension.until).toISOString())}</strong>`
          }, for ${escapeHtml(suspension.reason)}. Deciding again replaces that.</p>`
        : ''

      if (claim.kind === 'appeal') {
        const appeal = suspension?.appeal
        if (!appeal) {
          return html(reply.code(404), page(REVIEW_TITLE, 'That appeal is no longer on file.'))
        }
        return html(
          reply,
          page(
            REVIEW_TITLE,
            `<p><strong>${name}</strong> has appealed.</p>
           ${inForce}
           <blockquote style="white-space:pre-wrap;border-left:3px solid #ddd;margin:0 0 20px;padding:0 0 0 12px;color:#333;">${escapeHtml(appeal.text)}</blockquote>
           ${daysForm(token, 'shorten', 'Shorten to N days', 7)}
           ${actionForm(token, 'lift', 'Lift now')}
           ${actionForm(token, 'keep', 'Keep as is')}`,
          ),
        )
      }

      const reportId = toObjectId(claim.reportId)
      const report = reportId
        ? await app.mongo.db
            .collection('reports')
            .findOne<{ reason: string; details?: string; postId?: ObjectId }>({
              _id: reportId,
            })
        : null

      /*
       * The post itself, when the report named one — read unfiltered, because
       * this is the one reader that must still find a post it has already
       * hidden. Everything else treats hidden as missing.
       */
      const post = report?.postId
        ? await app.mongo.db.collection<Post>(COLLECTIONS.posts).findOne({ _id: report.postId })
        : null

      return html(
        reply,
        page(
          REVIEW_TITLE,
          `<p><strong>${name}</strong> was reported${
            report ? ` for <strong>${escapeHtml(report.reason.replace(/_/g, ' '))}</strong>` : ''
          }.</p>
         ${report?.details ? `<blockquote style="white-space:pre-wrap;border-left:3px solid #ddd;margin:0 0 20px;padding:0 0 0 12px;color:#333;">${escapeHtml(report.details)}</blockquote>` : '<p style="color:#888;">No details were given.</p>'}
         ${postSection(token, post)}
         ${
           /* Two groups of buttons now, and "hide this sentence" and "suspend
              this person forever" are not things to mistake for each other. A
              heading is what keeps the second from reading as more of the
              first — but only when there is a first. */
           post ? '<p style="margin:24px 0 8px;"><strong>The account</strong></p>' : ''
         }
         ${inForce}
         ${daysForm(token, 'suspend', 'Suspend for N days', 7)}
         ${actionForm(token, 'permanent', 'Suspend permanently')}
         ${actionForm(token, 'dismiss', 'Dismiss the report')}`,
        ),
      )
    },
  )

  /** And this is what decides. */
  app.post(
    '/moderation/review',
    { config: { rateLimit: limit(30, '1 minute') } },
    async (request, reply) => {
      const body = (request.body ?? {}) as { token?: string; action?: unknown; days?: unknown }
      const token = (request.query as { token?: string }).token ?? body.token
      const claim = verifyReviewToken(app.env.BETTER_AUTH_SECRET, token)
      if (!claim) return html(reply.code(400), page(REVIEW_TITLE, 'That link is no longer valid.'))

      const parsed = reviewDecisionSchema.safeParse({ action: body.action, days: body.days })
      if (!parsed.success) {
        return html(
          reply.code(400),
          page(REVIEW_TITLE, 'That is not a decision this page can make.'),
        )
      }

      const result = await applyReviewDecision(app, {
        kind: claim.kind,
        userId: claim.userId,
        reportId: toObjectId(claim.reportId),
        action: parsed.data.action,
        days: parsed.data.days,
      })
      if (!result.ok) {
        const [status, sentence] = REFUSALS[result.refusal]
        return html(reply.code(status), page(REVIEW_TITLE, sentence))
      }

      return html(
        reply,
        page(REVIEW_TITLE, decided(result.outcome, escapeHtml(who(result.handle, claim.userId)))),
      )
    },
  )

  /**
   * The one route a suspended account may read, beside the appeal below.
   *
   * It answers for everybody, not only the suspended: the app asks it after a
   * 403 and again on "Check again", and an unsuspended answer is how the
   * screen knows to let go.
   */
  app.get('/me/suspension', { preHandler: requireAuth }, async (request, reply) => {
    const profile = await getProfile(app.mongo.db, request.userId)
    return reply.send(suspensionStatus(profile))
  })

  app.post(
    '/me/suspension/appeal',
    {
      preHandler: requireAuth,
      schema: { body: appealSchema },
      config: { rateLimit: limit(5, '1 hour') },
    },
    async (request, reply) => {
      const at = await submitAppeal(app.mongo.db, request.userId, request.body.text)
      const profile = await getProfile(app.mongo.db, request.userId)

      // Same try/catch as the report route: the appeal is stored, and a
      // failed send must not tell somebody their one appeal did not go.
      try {
        await app.email.send({
          to: app.env.SUPPORT_EMAIL,
          ...appealEmail({
            text: request.body.text,
            user: party(request.userId, profile),
            until: profile?.suspension?.permanent
              ? null
              : profile?.suspension
                ? new Date(profile.suspension.until)
                : null,
            reason: profile?.suspension?.reason ?? '',
            reviewUrl: reviewUrl(
              publicApiUrl(app.env),
              signReviewToken(app.env.BETTER_AUTH_SECRET, {
                kind: 'appeal',
                userId: request.userId,
                reportId: profile?.suspension?.reportId?.toHexString() ?? null,
                expiresAt: Date.now() + REVIEW_TOKEN_TTL_MS,
              }),
            ),
          }),
          ...(request.userEmail ? { headers: { 'Reply-To': request.userEmail } } : {}),
        })
      } catch (error) {
        request.log.warn({ err: error, userId: request.userId }, 'appeal email failed')
      }

      return reply.code(202).send({ appealedAt: at.toISOString() })
    },
  )
}
