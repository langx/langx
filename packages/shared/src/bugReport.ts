import { attachmentsSchema, mediaKindSchema } from './media'
import { z } from 'zod'

/**
 * A bug report from inside the app.
 *
 * It is **mail, not a record**: the report is sent to the address the API's
 * `SUPPORT_EMAIL` names and nothing is written to the database. Whoever reads
 * that mailbox is the one who confirms the bug and decides what the finder is
 * paid, so a row here would be a second copy of a decision made somewhere
 * else — and one nobody would ever go back and close.
 *
 * That is also why no amount appears anywhere in this file or on the screen
 * that posts to it. What a confirmed bug is worth is a judgement about how bad
 * the bug was, made per report, in the reply.
 */

/**
 * Long enough to name what happened, what was expected and where. "It crashes"
 * is not a report anyone can act on, and the reply asking for the rest costs
 * more than the field refusing it while the person is still looking at it.
 */
export const BUG_REPORT_MIN_LENGTH = 20

/** Room for steps to reproduce; past this it belongs in the mail thread. */
export const BUG_REPORT_MAX_LENGTH = 2000

export const bugReportSchema = z.object({
  body: z.string().trim().min(BUG_REPORT_MIN_LENGTH).max(BUG_REPORT_MAX_LENGTH),
  /** Screenshots and screen recordings. Optional — proof helps, it is not the report. */
  attachments: attachmentsSchema.optional(),
})
export type BugReportInput = z.infer<typeof bugReportSchema>

/** Same shape as the feed's, kept apart because the two sign different key prefixes. */
export const bugReportUploadUrlSchema = z.object({
  kind: mediaKindSchema,
  contentType: z.string().trim().min(1),
})
export type BugReportUploadUrlInput = z.infer<typeof bugReportUploadUrlSchema>
