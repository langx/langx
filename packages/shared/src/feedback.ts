import { attachmentsSchema, mediaKindSchema } from './media'
import { z } from 'zod'

/**
 * What somebody sends us from inside the app: a bug they hit, or a feature
 * they want.
 *
 * It is **mail and an issue, not a record of ours**: the message is sent to
 * the address the API's `SUPPORT_EMAIL` names and opened as an issue on the
 * repository, and nothing is written to our database. Whoever reads that
 * mailbox is the one who confirms it and decides what the sender is paid, so a
 * collection here would be a second copy of a decision made somewhere else —
 * and one nobody would ever go back and close.
 *
 * That is also why no amount appears on the screen that posts here. What a
 * confirmed report is worth is a judgement made per report; the bounds below
 * are the range that judgement is made *within*, and they are read by the
 * award page the email links to, never by the app.
 */
export const FEEDBACK_KINDS = ['bug', 'feature'] as const
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number]

export const feedbackKindSchema = z.enum(FEEDBACK_KINDS)

/**
 * What a confirmed bug or an accepted request can pay.
 *
 * A floor because a report worth answering is worth more than a day's
 * messaging, and a ceiling because the award page is reached with a link from
 * an inbox: a mistyped amount there is a payout nothing else in the system
 * would stop. Neither number is shown in the app.
 */
export const BOUNTY_MIN = 500
export const BOUNTY_MAX = 5000

/** What the award page posts back: how much, for the report the link names. */
export const bountyAwardSchema = z.object({
  amount: z.coerce.number().int().min(BOUNTY_MIN).max(BOUNTY_MAX),
})
export type BountyAwardInput = z.infer<typeof bountyAwardSchema>

/**
 * Long enough to be acted on. "It crashes" is not a report anyone can work
 * from, and the reply asking for the rest costs more than the field refusing
 * it while the person is still looking at it.
 */
export const FEEDBACK_MIN_LENGTH = 20

/** Room for steps to reproduce; past this it belongs in the mail thread. */
export const FEEDBACK_MAX_LENGTH = 2000

export const feedbackSchema = z.object({
  kind: feedbackKindSchema,
  body: z.string().trim().min(FEEDBACK_MIN_LENGTH).max(FEEDBACK_MAX_LENGTH),
  /** Screenshots and screen recordings. Optional — proof helps, it is not the report. */
  attachments: attachmentsSchema.optional(),
})
export type FeedbackInput = z.infer<typeof feedbackSchema>

/** Same shape as the feed's, kept apart because the two sign different key prefixes. */
export const feedbackUploadUrlSchema = z.object({
  kind: mediaKindSchema,
  contentType: z.string().trim().min(1),
})
export type FeedbackUploadUrlInput = z.infer<typeof feedbackUploadUrlSchema>
