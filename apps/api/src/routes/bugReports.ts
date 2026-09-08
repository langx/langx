import {
  ERROR_CODES,
  bugReportSchema,
  bugReportUploadUrlSchema,
  mediaKindOfContentType,
} from '@langx/shared'
import { randomUUID } from 'node:crypto'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { ApiError } from '../lib/ApiError'
import { bugReportEmail } from '../email/templates'
import { requireVerifiedEmail } from '../middleware/requireAuth'
import { assertAttachmentsAllowed } from '../modules/media/assertMedia'
import { objectExtension } from '../modules/media/objectExtension'
import { emailFor } from '../modules/profiles/emailFor'
import { getProfile } from '../modules/profiles/profiles'

/**
 * Reporting a bug from inside the app, with a screenshot or a screen recording
 * as proof.
 *
 * The report is emailed to `SUPPORT_EMAIL` and stored nowhere. That is the
 * design, not a shortcut: a confirmed bug is paid for, and both halves of that
 * — whether it is real and what it is worth — are one person's judgement made
 * in a reply. A collection here would hold a copy of a decision taken in an
 * inbox, with no screen in the app able to close a row and nobody looking at
 * the ones left open.
 *
 * `requireVerifiedEmail` on both routes. A signed URL is a capability, so the
 * upload route needs the same guard the feed's does — and the report route
 * needs a reporter who can be written back to, since the reward is agreed in
 * that reply.
 */
// eslint-disable-next-line @typescript-eslint/require-await -- Fastify plugin signature
export const bugReportRoutes: FastifyPluginAsyncZod = async (app) => {
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

      const mail = bugReportEmail({
        body: request.body.body,
        attachmentUrls: attachments.map((item) => item.url),
        reporter: {
          userId: request.userId,
          handle: profile?.handle ?? null,
          email: address?.email ?? null,
        },
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
}
