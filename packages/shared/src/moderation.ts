import { z } from 'zod'

/**
 * Blocking is symmetric in effect and one-sided in record: only the blocker
 * has a row, but neither party can see or reach the other afterwards. Making
 * it one-sided would let a blocked user keep messaging, and making it
 * two-sided would tell the blocked user they were blocked — both wrong.
 */
export const blockSchema = z.object({
  userId: z.string().trim().min(1),
})
export type BlockInput = z.infer<typeof blockSchema>

/**
 * The order is the order the report screen lists them in, so it is a product
 * decision rather than an alphabetisation.
 *
 * `hate_speech` sits next to `harassment` because it is a kind of it, and
 * separating them out is the point: somebody reporting an attack on who they
 * are should not have to file it under a word that describes the volume rather
 * than the reason. What we can count, we can eventually act on.
 */
export const REPORT_REASONS = [
  'spam',
  'harassment',
  'hate_speech',
  'inappropriate_content',
  'fake_profile',
  'underage',
  'other',
] as const
export type ReportReason = (typeof REPORT_REASONS)[number]

export const reportReasonSchema = z.enum(REPORT_REASONS)

export const REPORT_DETAILS_MAX_LENGTH = 1000

export const reportSchema = z.object({
  userId: z.string().trim().min(1),
  reason: reportReasonSchema,
  details: z.string().trim().max(REPORT_DETAILS_MAX_LENGTH).optional(),
  /** Optional pointer to the conversation the reported behaviour happened in. */
  conversationId: z.string().trim().min(1).optional(),
  /**
   * Optional pointer to the specific message. Narrower than `conversationId`
   * and kept alongside it rather than replacing it: a report raised from a
   * profile has neither, and one raised from a thread has both.
   */
  messageId: z.string().trim().min(1).optional(),
  /**
   * Optional pointer to the post the report is about. A post is public and
   * has no conversation, so it is a third place a report can be raised from,
   * alongside a profile and a message.
   */
  postId: z.string().trim().min(1).optional(),
})
export type ReportInput = z.infer<typeof reportSchema>

/**
 * How many distinct reporters it takes to suspend a user's token automatically.
 *
 * Deliberately not one: a single report is too easy to weaponise against
 * someone who simply declined a conversation. Freezing token is reversible and
 * invisible to everyone else, which is what makes an automatic threshold
 * acceptable at all — nothing here bans anyone, that stays a human decision.
 */
export const REPORTS_TO_FREEZE_XP = 3

export const REPORT_STATUSES = ['open', 'reviewing', 'actioned', 'dismissed'] as const
export type ReportStatus = (typeof REPORT_STATUSES)[number]

/**
 * Paging for the two moderation lists.
 *
 * `GET /me/viewers` used to take the newest 100 and stop, which a Pro user
 * paying to see the list would experience as the list being wrong — the
 * `total` beside it counted everyone. `GET /blocks` had no limit at all.
 */
export const MODERATION_PAGE_SIZE_DEFAULT = 30
export const MODERATION_PAGE_SIZE_MAX = 100

export const moderationListQuerySchema = z.object({
  cursor: z.string().trim().min(1).optional(),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(MODERATION_PAGE_SIZE_MAX)
    .default(MODERATION_PAGE_SIZE_DEFAULT),
})
export type ModerationListQuery = z.infer<typeof moderationListQuerySchema>

/**
 * The longest a suspension may be set for in one decision. A year is longer
 * than any temporary suspension should need, and the review page's input is
 * bounded by it so a slipped keypress cannot hand out a century.
 */
export const SUSPENSION_MAX_DAYS = 365

/**
 * A permanent suspension is a date, not a flag.
 *
 * "Suspended" is `suspension.until > now`, computed on every check — that is
 * what makes expiry need no cron. A separate `permanent: true` would give
 * every one of those checks a second branch, and every Mongo filter a second
 * clause, for a state that behaves identically. So permanent stores a
 * far-future sentinel instead and one comparison covers both. The flag is
 * still stored beside it, but only so the app can say "permanently" rather
 * than print the year 9999.
 */
export const SUSPENSION_FOREVER = '9999-01-01T00:00:00.000Z'

/**
 * Long enough that "unfair" alone does not send, short enough to read.
 *
 * One appeal per suspension, so this is the only chance to say anything —
 * a floor that forces a sentence is worth more here than on a bug report.
 */
export const APPEAL_MIN_LENGTH = 20
export const APPEAL_MAX_LENGTH = 1000

export const appealSchema = z.object({
  text: z.string().trim().min(APPEAL_MIN_LENGTH).max(APPEAL_MAX_LENGTH),
})
export type AppealInput = z.infer<typeof appealSchema>

/**
 * What `GET /me/suspension` answers — the only route a suspended account may
 * read, and the whole of what it is told.
 *
 * The reporter is never named: `community-guidelines.md` says so, and a
 * suspension notice that identified whoever raised it would turn every report
 * into a thing with consequences for the person who filed it.
 */
export const suspensionStatusSchema = z.object({
  suspended: z.boolean(),
  /** ISO, or `null` when permanent — the sentinel never leaves the server. */
  until: z.string().nullable(),
  permanent: z.boolean(),
  reason: reportReasonSchema.nullable(),
  /** When the one appeal was sent, or `null` while it still can be. */
  appealedAt: z.string().nullable(),
})
export type SuspensionStatus = z.infer<typeof suspensionStatusSchema>

/** Which signed link a review page was opened with. */
export const REVIEW_KINDS = ['report', 'appeal'] as const
export type ReviewKind = (typeof REVIEW_KINDS)[number]

/** Deciding a report, and deciding an appeal against the decision. */
export const REPORT_REVIEW_ACTIONS = ['suspend', 'permanent', 'dismiss'] as const
export const APPEAL_REVIEW_ACTIONS = ['shorten', 'lift', 'keep'] as const
export const REVIEW_ACTIONS = [...REPORT_REVIEW_ACTIONS, ...APPEAL_REVIEW_ACTIONS] as const
export type ReviewAction = (typeof REVIEW_ACTIONS)[number]

/**
 * Which actions each kind of link may drive.
 *
 * The token says which report or which appeal it is for; this says what may
 * be done with it. Both halves are checked, so a report link cannot lift a
 * suspension it was never shown.
 */
export const REVIEW_ACTIONS_BY_KIND = {
  report: REPORT_REVIEW_ACTIONS,
  appeal: APPEAL_REVIEW_ACTIONS,
} as const satisfies Record<ReviewKind, readonly ReviewAction[]>

export const reviewDecisionSchema = z
  .object({
    action: z.enum(REVIEW_ACTIONS),
    /** Required by `suspend` and `shorten`, meaningless to the other four. */
    days: z.coerce.number().int().min(1).max(SUSPENSION_MAX_DAYS).optional(),
  })
  .refine((d) => !(d.action === 'suspend' || d.action === 'shorten') || d.days !== undefined, {
    message: 'A number of days is required',
    path: ['days'],
  })
export type ReviewDecision = z.infer<typeof reviewDecisionSchema>
