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

export const REPORT_REASONS = [
  'spam',
  'harassment',
  'inappropriate_content',
  'fake_profile',
  'underage',
  'other',
] as const
export type ReportReason = (typeof REPORT_REASONS)[number]

export const REPORT_DETAILS_MAX_LENGTH = 1000

export const reportSchema = z.object({
  userId: z.string().trim().min(1),
  reason: z.enum(REPORT_REASONS),
  details: z.string().trim().max(REPORT_DETAILS_MAX_LENGTH).optional(),
  /** Optional pointer to the conversation the reported behaviour happened in. */
  conversationId: z.string().trim().min(1).optional(),
  /**
   * Optional pointer to the specific message. Narrower than `conversationId`
   * and kept alongside it rather than replacing it: a report raised from a
   * profile has neither, and one raised from a thread has both.
   */
  messageId: z.string().trim().min(1).optional(),
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
