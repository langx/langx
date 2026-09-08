import {
  BUG_BOUNTY_MAX,
  BUG_BOUNTY_MIN,
  ERROR_CODES,
  bugBountyAwardSchema,
  bugReportSchema,
  bugReportUploadUrlSchema,
  mediaKindOfContentType,
} from '@langx/shared'
import { randomUUID } from 'node:crypto'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { ApiError } from '../lib/ApiError'
import {
  BUG_BOUNTY_TOKEN_TTL_MS,
  bugBountyAwardUrl,
  signBugBountyToken,
  verifyBugBountyToken,
} from '../email/bugBountyToken'
import { bugReportEmail } from '../email/templates'
import { publicApiUrl } from '../env'
import { requireVerifiedEmail } from '../middleware/requireAuth'
import { assertAttachmentsAllowed } from '../modules/media/assertMedia'
import { objectExtension } from '../modules/media/objectExtension'
import { emailFor } from '../modules/profiles/emailFor'
import { getProfile } from '../modules/profiles/profiles'
import { awardTokens } from '../modules/tokens/ledger'

/**
 * Reporting a bug from inside the app, with a screenshot or a screen recording
 * as proof — and, in the email that report becomes, paying for it.
 *
 * The report is emailed to `SUPPORT_EMAIL` and stored nowhere. That is the
 * design, not a shortcut: a confirmed bug is paid for, and both halves of that
 * — whether it is real and what it is worth — are one person's judgement made
 * while reading the mail. A collection here would hold a copy of a decision
 * taken in an inbox, with no screen in the app able to close a row and nobody
 * looking at the ones left open.
 *
 * `requireVerifiedEmail` on both of the routes the app calls. A signed URL is a
 * capability, so the upload route needs the same guard the feed's does — and
 * the report route needs a reporter who can be written back to, since the
 * reward is agreed in that reply.
 *
 * The two award routes below are the other half, and they carry no session at
 * all: see `bugBountyToken.ts` for what authorises them and what bounds it.
 */
// eslint-disable-next-line @typescript-eslint/require-await -- Fastify plugin signature
export const bugReportRoutes: FastifyPluginAsyncZod = async (app) => {
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

  app.post(
    '/bug-reports/upload-url',
    { preHandler: requireVerifiedEmail, schema: { body: bugReportUploadUrlSchema } },
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
      const key = `bug-reports/${request.userId}/${randomUUID()}.${extension}`
      return reply.send(await app.storage.getUploadUrl(key, contentType))
    },
  )

  app.post(
    '/bug-reports',
    {
      preHandler: requireVerifiedEmail,
      schema: { body: bugReportSchema },
      /*
       * Tighter than anything else that writes, because the cost of abuse is
       * not a row we can delete: it is a mailbox a person has to empty by
       * hand. Six an hour is more than anyone reporting in good faith needs.
       */
      config: { rateLimit: { max: 6, timeWindow: '1 hour' } },
    },
    async (request, reply) => {
      const attachments = request.body.attachments ?? []
      // Before anything is mailed: the same ceilings and the same bucket check
      // every other attachment goes through. A URL outside our own storage
      // would turn this mail into a link to wherever the sender liked.
      if (attachments.length > 0) {
        assertAttachmentsAllowed(attachments, app.env.STORAGE_PUBLIC_BASE_URL)
      }

      const profile = await getProfile(app.mongo.db, request.userId)
      const address = await emailFor(app.mongo.db, request.userId)

      /*
       * The report's own id, and the only place it is ever written down is the
       * link below — which is enough, because the one thing it has to be is
       * the ledger's `refId`, and the ledger is what remembers it after that.
       */
      const reportId = randomUUID()
      const awardUrl = bugBountyAwardUrl(
        publicApiUrl(app.env),
        signBugBountyToken(app.env.BETTER_AUTH_SECRET, {
          userId: request.userId,
          reportId,
          expiresAt: Date.now() + BUG_BOUNTY_TOKEN_TTL_MS,
        }),
      )

      const mail = bugReportEmail({
        body: request.body.body,
        attachmentUrls: attachments.map((item) => item.url),
        reporter: {
          userId: request.userId,
          handle: profile?.handle ?? null,
          email: address?.email ?? null,
        },
        awardUrl,
      })

      await app.email.send({
        to: app.env.SUPPORT_EMAIL,
        ...mail,
        // So that confirming a bug — or asking for the step that is missing —
        // is a reply rather than a lookup.
        ...(address ? { headers: { 'Reply-To': address.email } } : {}),
      })

      // Accepted, not created: there is nothing to fetch afterwards, and the
      // client has nothing to do with the answer but say thank you.
      return reply.code(202).send({ ok: true })
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
    '/bug-reports/award',
    { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const token = (request.query as { token?: string }).token
      const claim = verifyBugBountyToken(app.env.BETTER_AUTH_SECRET, token)
      if (!claim) return html(reply.code(400), page('That link is no longer valid.'))

      const profile = await getProfile(app.mongo.db, claim.userId)
      if (!profile || profile.deletedAt) {
        return html(reply.code(404), page('That account is gone; there is nobody to pay.'))
      }

      return html(
        reply,
        page(
          `<p>Reward <strong>${escapeHtml(who(profile.handle, claim.userId))}</strong> for the bug they reported.</p>
           <form method="post" action="/bug-reports/award?token=${encodeURIComponent(token ?? '')}">
             <label style="display:block;margin-bottom:8px;color:#555;font-size:14px;">
               Tokens (${BUG_BOUNTY_MIN}–${BUG_BOUNTY_MAX}), by how serious the bug was
             </label>
             <input type="number" name="amount" value="${BUG_BOUNTY_MIN}" min="${BUG_BOUNTY_MIN}" max="${BUG_BOUNTY_MAX}" step="100" required
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
    '/bug-reports/award',
    { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const body = (request.body ?? {}) as { token?: string; amount?: unknown }
      const token = (request.query as { token?: string }).token ?? body.token
      const claim = verifyBugBountyToken(app.env.BETTER_AUTH_SECRET, token)
      if (!claim) return html(reply.code(400), page('That link is no longer valid.'))

      const parsed = bugBountyAwardSchema.safeParse({ amount: body.amount })
      if (!parsed.success) {
        return html(
          reply.code(400),
          page(`A reward is between ${BUG_BOUNTY_MIN} and ${BUG_BOUNTY_MAX} tokens.`),
        )
      }

      const profile = await getProfile(app.mongo.db, claim.userId)
      if (!profile || profile.deletedAt) {
        return html(reply.code(404), page('That account is gone; there is nobody to pay.'))
      }

      const result = await awardTokens(app.mongo.db, {
        userId: claim.userId,
        kind: 'bugBounty',
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

/** The reporter, as the person deciding would recognise them. */
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
  <title>Bug bounty</title></head>
  <body style="font-family: -apple-system, system-ui, sans-serif; color:#111; background:#f7f7f7; padding:24px;">
    <div style="max-width:480px; margin:0 auto; background:#fff; border-radius:12px; padding:32px;">
      <h1 style="font-size:18px;margin:0 0 16px;">Bug bounty</h1>
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
