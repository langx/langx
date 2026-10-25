import { z } from 'zod'
import { adminListQuerySchema } from './admin'
import { REPORT_REASONS, type ReportReason } from './moderation'

/**
 * Moderators: members we pick from among our users to work the report queue.
 *
 * Everything here is narrower than the operator panel's version of it, and
 * the narrowing is the design. An operator is one of us; a moderator is a
 * member we trust *so far*. So every decision they make is written down with
 * the reason they gave, lands in a queue an operator reviews, and can be
 * undone from there — see `docs/decisions.md` → _Moderators are members, so
 * every decision is reviewed_.
 */

/**
 * The longest a moderator may suspend somebody for. A month is enough to stop
 * whatever was happening; anything longer, and anything permanent, is an
 * operator's call made from the same report.
 */
export const MOD_SUSPENSION_MAX_DAYS = 30

/**
 * Bounds of the reason a moderator writes for a suspension. The floor is
 * there so "spam" or "." cannot pass for an explanation — the operator who
 * reviews it has to be able to tell what the moderator saw.
 */
export const MOD_NOTE_MIN = 10
export const MOD_NOTE_MAX = 1000

/**
 * What a moderator may decide about a report. `permanent` is missing on
 * purpose, and so is everything an appeal drives: lifting a suspension is how
 * an operator corrects a moderator, not something a moderator does.
 */
export const MOD_REPORT_ACTIONS = [
  'suspend',
  'dismiss',
  'hide_post',
  'unhide_post',
  'hide_comment',
  'unhide_comment',
  'hide_testimonial',
  'unhide_testimonial',
] as const
export type ModReportAction = (typeof MOD_REPORT_ACTIONS)[number]

const modNoteSchema = z.string().trim().min(MOD_NOTE_MIN).max(MOD_NOTE_MAX)

export const moderatorDecisionSchema = z
  .object({
    action: z.enum(MOD_REPORT_ACTIONS),
    /** Required by `suspend`, meaningless to the rest. */
    days: z.coerce.number().int().min(1).max(MOD_SUSPENSION_MAX_DAYS).optional(),
    /** Required by `suspend`; optional, and still kept, for the rest. */
    note: modNoteSchema.optional(),
  })
  .refine((d) => d.action !== 'suspend' || d.days !== undefined, {
    message: 'A number of days is required',
    path: ['days'],
  })
  .refine((d) => d.action !== 'suspend' || d.note !== undefined, {
    message: 'A reason is required',
    path: ['note'],
  })
export type ModeratorDecision = z.infer<typeof moderatorDecisionSchema>

/**
 * A moderator's warning names a reason, never words. The server sends the
 * matching `REPORT_WARNINGS` text, so whatever a moderator does, @langx only
 * ever says something we wrote.
 */
export const moderatorWarnSchema = z.object({ reason: z.enum(REPORT_REASONS) })
export type ModeratorWarnInput = z.infer<typeof moderatorWarnSchema>

/**
 * The first warning for a reported account, in the shape the hand-written
 * ones of 28 Sept took. @langx is one way, so it names where a reply goes.
 */
function warning(what: string): string {
  return `Hi, this is the LangX Team.

We've received a report that your account ${what}. This goes against our community rules, so this is a warning.

Please review our Terms: https://langx.io/terms-conditions

If it happens again, your account may be suspended. Questions: hi@langx.io`
}

/**
 * One warning per report reason. The operator panel fills its editable box
 * from these; a moderator can only send them as they are. Here rather than in
 * the panel's strings because the server has to be the one that picks the
 * words for a moderator. In English whatever the reader's language, like
 * everything @langx says by hand. Keyed by the reason, so a reason added to
 * `REPORT_REASONS` does not compile without one.
 */
export const REPORT_WARNINGS: Record<ReportReason, string> = {
  spam: warning('has been sending spam or unwanted promotion'),
  scam: warning('has been asking other users for money'),
  harassment: warning('has been harassing other users'),
  hate_speech: warning('has been attacking people for who they are'),
  inappropriate_content: warning('has been sharing inappropriate content'),
  fake_profile: warning('is using a fake or misleading profile'),
  underage: `Hi, this is the LangX Team.

We've received a report that you may be under 16. LangX is only for people aged 16 and over.

If this is a mistake, please write to hi@langx.io. Otherwise your account may be suspended.`,
  other: warning('has broken our community rules'),
}

/**
 * Where a moderator's decision is in an operator's review. `pending` is the
 * absence of a review, not a stored value.
 */
export const MOD_ACTION_TABS = ['pending', 'approved', 'reverted'] as const
export type ModActionTab = (typeof MOD_ACTION_TABS)[number]

export const adminModActionListQuerySchema = adminListQuerySchema.extend({
  status: z.enum(MOD_ACTION_TABS).default('pending'),
  moderatorId: z.string().trim().min(1).optional(),
})
export type AdminModActionListQuery = z.infer<typeof adminModActionListQuerySchema>

/** The chip beside a moderator's name, next to `TIER_BADGES`' PRO. */
export const MOD_BADGE = 'MOD'

/** One row of the public list of moderators in Settings. */
export interface ModeratorListItem {
  userId: string
  handle: string | null
  /** Already shortened to "First L.", as everybody else sees names. */
  displayName: string
  avatarUrl: string | null
  since: string
}
