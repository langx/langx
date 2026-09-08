import {
  BOUNTY_MAX,
  BOUNTY_MIN,
  ERROR_CODES,
  bountyAwardSchema,
  feedbackSchema,
  feedbackUploadUrlSchema,
  mediaKindOfContentType,
} from '@langx/shared'
import { randomUUID } from 'node:crypto'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { ApiError } from '../lib/ApiError'
import {
  BOUNTY_TOKEN_TTL_MS,
  bountyAwardUrl,
  signBountyToken,
  verifyBountyToken,
} from '../email/bountyToken'
import { feedbackEmail } from '../email/templates'
import { publicApiUrl } from '../env'
import { requireVerifiedEmail } from '../middleware/requireAuth'
import { openFeedbackIssue } from '../modules/feedback/githubIssue'
import { assertAttachmentsAllowed } from '../modules/media/assertMedia'
import { objectExtension } from '../modules/media/objectExtension'
import { emailFor } from '../modules/profiles/emailFor'
import { getProfile } from '../modules/profiles/profiles'
import { awardTokens } from '../modules/tokens/ledger'

/**
 * Bug reports and feature requests from inside the app — and, in the email
 * each one becomes, paying for it.
 *
 * A report goes two places and into no table of ours: an email to
 * `SUPPORT_EMAIL`, and a public issue on the repository. That is the design,
 * not a shortcut. A confirmed report is paid for, and both halves of that —
 * whether it is real and what it is worth — are one person's judgement made
 * while reading the mail; the tracker is where the work then lives. A
 * collection here would hold a copy of a decision taken in an inbox, with no
 * screen in the app able to close a row and nobody looking at the ones left
 * open.
 *
 * `requireVerifiedEmail` on both of the routes the app calls. A signed URL is a
 * capability, so the upload route needs the same guard the feed's does — and
 * the report route needs a sender who can be written back to, since the reward
 * is agreed in that reply.
 *
 * The two award routes below are the other half, and they carry no session at
 * all: see `bountyToken.ts` for what authorises them and what bounds it.
 */
// eslint-disable-next-line @typescript-eslint/require-await -- Fastify plugin signature
export const feedbackRoutes: FastifyPluginAsyncZod = async (app) => {
  /*
   * The award page posts a form, and Fastify parses JSON and nothing else
   * until it is told to. Registered inside this plugin, so it is these routes
   * that gain a form parser and not every POST in the API.
   */
  app.addContentTypeParser(
    'application/x-www-form-urlencoded',
    { parseAs: 'string' },
    (_request, body: string, done) => {
      done(null, Object.fromEntries(new URLSearchParams(body)))
    },
  )

  /**
   * A per-route ceiling, and none of it under `NODE_ENV=test` — the same
   * exemption `app.ts` makes for the global limiter, for the same reason. A
   * suite drives its requests through one synthetic connection in seconds, so
   * the limiter measures the harness rather than a person: six reports an hour
   * is spent on fixtures before the first assertion about anything else, and
   * the symptom is whichever test ran last failing on a 429.
   */
  const limit = (max: number, timeWindow: string) =>
    app.env.NODE_ENV === 'test' ? false : { max, timeWindow }

  app.post(
    '/feedback/upload-url',
    { preHandler: requireVerifiedEmail, schema: { body: feedbackUploadUrlSchema } },
    async (request, reply) => {
      const { kind, contentType } = request.body
      if (mediaKindOfContentType(contentType) !== kind) {
        throw new ApiError(
          ERROR_CODES.UNSUPPORTED_MEDIA_TYPE,
          `${contentType} is not a supported ${kind} type`,
        )
      }

      // Its own prefix, keyed by user, for the same reason `posts/` is: the
      // account-deletion purge finds a person's objects by prefix, and proof
      // of a bug is still their file.
      const extension = objectExtension(contentType)
      const key = `feedback/${request.userId}/${randomUUID()}.${extension}`
      return reply.send(await app.storage.getUploadUrl(key, contentType))
    },
  )

  app.post(
    '/feedback',
    {
      preHandler: requireVerifiedEmail,
      schema: { body: feedbackSchema },
      /*
       * Tighter than anything else that writes, because the cost of abuse is
       * not a row we can delete: it is a mailbox a person has to empty by hand
       * and a public tracker they have to close issues on. Six an hour is more
       * than anyone reporting in good faith needs.
       */
      config: { rateLimit: limit(6, '1 hour') },
    },
    async (request, reply) => {
      const attachments = request.body.attachments ?? []
      // Before anything leaves this process: the same ceilings and the same
      // bucket check every other attachment goes through. A URL outside our own
      // storage would put a link to wherever the sender liked in a public issue.
      if (attachments.length > 0) {
        assertAttachmentsAllowed(attachments, app.env.STORAGE_PUBLIC_BASE_URL)
      }

      const profile = await getProfile(app.mongo.db, request.userId)
      const address = await emailFor(app.mongo.db, request.userId)
      const attachmentUrls = attachments.map((item) => item.url)

      /*
       * The issue first, so the mail can carry its link. It answers `null`
       * rather than throwing on every failure there is — a tracker being down
       * must not tell somebody their report failed, when the mail below is
       * what actually delivers it.
       */
      const issueUrl = await openFeedbackIssue(
        { token: app.env.GITHUB_ISSUE_TOKEN, repo: app.env.GITHUB_ISSUE_REPO },
        { kind: request.body.kind, body: request.body.body, attachmentCount: attachments.length },
      )

      /*
       * The report's own id, and the only place it is ever written down is the
       * link below — which is enough, because the one thing it has to be is
       * the ledger's `refId`, and the ledger is what remembers it after that.
       */
      const reportId = randomUUID()
      const awardUrl = bountyAwardUrl(
        publicApiUrl(app.env),
        signBountyToken(app.env.BETTER_AUTH_SECRET, {
          userId: request.userId,
          reportId,
          expiresAt: Date.now() + BOUNTY_TOKEN_TTL_MS,
        }),
      )

      const mail = feedbackEmail({
        kind: request.body.kind,
        body: request.body.body,
        attachmentUrls,
        sender: {
          userId: request.userId,
          handle: profile?.handle ?? null,
          email: address?.email ?? null,
        },
        awardUrl,
        issueUrl,
      })

      await app.email.send({
        to: app.env.SUPPORT_EMAIL,
        ...mail,
        // So that confirming a report — or asking for the step that is missing
        // — is a reply rather than a lookup.
        ...(address ? { headers: { 'Reply-To': address.email } } : {}),
      })

      // Accepted, not created: there is nothing of ours to fetch afterwards,
      // and the client has nothing to do with the answer but say thank you.
      return reply.code(202).send({ ok: true, issueUrl })
    },
  )

  /**
   * The page the email's button opens: who is being paid, and a field for how
   * much.
   *
   * A GET that only asks. Mail clients and link scanners follow links in a
   * mailbox on their own, so the page a link opens must never be the thing
   * that pays — that is the POST below, behind a button a person pressed.
   */
  app.get(
    '/feedback/award',
    { config: { rateLimit: limit(30, '1 minute') } },
    async (request, reply) => {
      const token = (request.query as { token?: string }).token
      const claim = verifyBountyToken(app.env.BETTER_AUTH_SECRET, token)
      if (!claim) return html(reply.code(400), page('That link is no longer valid.'))

      const profile = await getProfile(app.mongo.db, claim.userId)
      if (!profile || profile.deletedAt) {
        return html(reply.code(404), page('That account is gone; there is nobody to pay.'))
      }

      return html(
        reply,
        page(
          `<p>Reward <strong>${escapeHtml(who(profile.handle, claim.userId))}</strong> for what they sent.</p>
           <form method="post" action="/feedback/award?token=${encodeURIComponent(token ?? '')}">
             <label style="display:block;margin-bottom:8px;color:#555;font-size:14px;">
               Tokens (${BOUNTY_MIN}–${BOUNTY_MAX}), by how much it turned out to be worth
             </label>
             <input type="number" name="amount" value="${BOUNTY_MIN}" min="${BOUNTY_MIN}" max="${BOUNTY_MAX}" step="100" required
                    style="font-size:18px;padding:10px;width:140px;border:1px solid #ccc;border-radius:8px;" />
             <p style="color:#888;font-size:13px;">Paid once. Opening this link again pays nothing.</p>
             <button type="submit" style="background:#111;color:#fff;border:0;border-radius:8px;padding:12px 20px;font-weight:600;font-size:15px;cursor:pointer;">
               Send the reward
             </button>
           </form>`,
        ),
      )
    },
  )

  /**
   * And this is what pays.
   *
   * `refId` is the report's id, so the ledger's unique `{userId, kind, refId}`
   * index — not a check here — is what makes a second press, a refresh or a
   * forwarded mail worth nothing.
   */
  app.post(
    '/feedback/award',
    { config: { rateLimit: limit(30, '1 minute') } },
    async (request, reply) => {
      const body = (request.body ?? {}) as { token?: string; amount?: unknown }
      const token = (request.query as { token?: string }).token ?? body.token
      const claim = verifyBountyToken(app.env.BETTER_AUTH_SECRET, token)
      if (!claim) return html(reply.code(400), page('That link is no longer valid.'))

      const parsed = bountyAwardSchema.safeParse({ amount: body.amount })
      if (!parsed.success) {
        return html(
          reply.code(400),
          page(`A reward is between ${BOUNTY_MIN} and ${BOUNTY_MAX} tokens.`),
        )
      }

      const profile = await getProfile(app.mongo.db, claim.userId)
      if (!profile || profile.deletedAt) {
        return html(reply.code(404), page('That account is gone; there is nobody to pay.'))
      }

      const result = await awardTokens(app.mongo.db, {
        userId: claim.userId,
        kind: 'bounty',
        amount: parsed.data.amount,
        refId: claim.reportId,
      })

      return html(
        reply,
        page(
          result.awarded
            ? `<p>Paid <strong>${result.amount}</strong> tokens to ${escapeHtml(who(profile.handle, claim.userId))}.</p>`
            : '<p>This report has already been paid.</p>',
        ),
      )
    },
  )
}

/** The sender, as the person deciding would recognise them. */
function who(handle: string | null | undefined, userId: string): string {
  return handle ? `@${handle}` : userId
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
}

/**
 * English, and no locale anywhere near it: every other page this API renders
 * is read by the person it is about, and this one is read by us.
 */
function page(bodyHtml: string): string {
  return `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Bounty</title></head>
  <body style="font-family: -apple-system, system-ui, sans-serif; color:#111; background:#f7f7f7; padding:24px;">
    <div style="max-width:480px; margin:0 auto; background:#fff; border-radius:12px; padding:32px;">
      <h1 style="font-size:18px;margin:0 0 16px;">Bounty</h1>
      ${bodyHtml.trimStart().startsWith('<') ? bodyHtml : `<p>${bodyHtml}</p>`}
    </div>
  </body>
</html>`
}

function html(
  reply: { type: (value: string) => { send: (body: string) => unknown } },
  body: string,
) {
  return reply.type('text/html; charset=utf-8').send(body)
}
