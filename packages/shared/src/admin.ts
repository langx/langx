import { z } from 'zod'
import {
  MODERATION_PAGE_SIZE_DEFAULT,
  MODERATION_PAGE_SIZE_MAX,
  REPORT_REASONS,
  SUSPENSION_MAX_DAYS,
} from './moderation'

/**
 * What the operator panel sends.
 *
 * The decisions themselves are not here: `reviewDecisionSchema` in
 * `moderation.ts` is the shape the emailed review form already posts, and the
 * panel posts the same object to the same function. A second schema saying the
 * same thing is how the two surfaces would start to disagree.
 *
 * What is here is everything the panel needs that a mailbox never did —
 * paging, searching, and the two actions a report was never behind.
 */

export const ADMIN_REPORT_TABS = ['open', 'reviewing', 'actioned', 'dismissed'] as const
export type AdminReportTab = (typeof ADMIN_REPORT_TABS)[number]

export const adminListQuerySchema = z.object({
  cursor: z.string().trim().min(1).optional(),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(MODERATION_PAGE_SIZE_MAX)
    .default(MODERATION_PAGE_SIZE_DEFAULT),
})
export type AdminListQuery = z.infer<typeof adminListQuerySchema>

export const adminReportListQuerySchema = adminListQuerySchema.extend({
  status: z.enum(ADMIN_REPORT_TABS).default('open'),
})
export type AdminReportListQuery = z.infer<typeof adminReportListQuerySchema>

export const ADMIN_FEEDBACK_TABS = ['open', 'triaged', 'closed'] as const
export type AdminFeedbackTab = (typeof ADMIN_FEEDBACK_TABS)[number]

export const adminFeedbackListQuerySchema = adminListQuerySchema.extend({
  status: z.enum(ADMIN_FEEDBACK_TABS).default('open'),
})
export type AdminFeedbackListQuery = z.infer<typeof adminFeedbackListQuerySchema>

/**
 * Finding one person. A handle, a previous handle, a user id or an email
 * address — whichever the operator happens to have, which in a support thread
 * is usually the address.
 */
export const adminUserSearchSchema = z.object({
  q: z.string().trim().min(2).max(120),
})
export type AdminUserSearch = z.infer<typeof adminUserSearchSchema>

/**
 * Suspending somebody the panel found rather than somebody a report named.
 *
 * No `permanent` here, deliberately. A suspension that never ends should be
 * reached from the report that justifies it, where the reason and the evidence
 * are on the same screen — not from a search box. The panel offers permanence
 * on the report screen and a number of days here.
 */
export const adminSuspendSchema = z.object({
  reason: z.enum(REPORT_REASONS),
  days: z.coerce.number().int().min(1).max(SUSPENSION_MAX_DAYS),
})
export type AdminSuspendInput = z.infer<typeof adminSuspendSchema>

/** A message sent from `@langx` to one person, from the panel. */
export const ADMIN_MESSAGE_MAX_LENGTH = 2000
export const adminMessageSchema = z.object({
  body: z.string().trim().min(1).max(ADMIN_MESSAGE_MAX_LENGTH),
})
export type AdminMessageInput = z.infer<typeof adminMessageSchema>

/**
 * Every mutating thing the panel can do, as the audit log names it.
 *
 * A closed list rather than free text: these end up in a collection nobody
 * deletes from, and "what has been done to this account" is only answerable if
 * the answers are drawn from a fixed vocabulary.
 */
export const ADMIN_ACTIONS = [
  'report.decide',
  'appeal.decide',
  'user.suspend',
  'user.lift',
  'user.unfreeze',
  'user.signOut',
  'user.message',
  'post.hide',
  'post.unhide',
  'feedback.update',
  'feedback.award',
  'broadcast.create',
  'broadcast.test',
  'broadcast.start',
  'broadcast.pause',
  'broadcast.resume',
  'broadcast.delete',
] as const
export type AdminActionName = (typeof ADMIN_ACTIONS)[number]

/**
 * How many people one scheduler tick messages.
 *
 * Not a deliverability ramp. `campaignDayBudget` exists because mailbox
 * providers judge a domain by how suddenly it starts sending, and an in-app
 * message has no reputation to warm up — copying that ramp here would be
 * cargo cult. What this bounds is the Expo relay, the write rate, and the
 * blast radius of a broadcast somebody wants to stop halfway.
 */
export const BROADCAST_PER_TICK = 500

/**
 * The hours a broadcast may go out in, UTC.
 *
 * The *message* could land at any hour; the push beside it could not, and
 * there is one push per message. Recipients have timezones on file, but
 * batching by timezone would mean an audience query per zone per tick for a
 * gain nobody has asked for — so this is the same blunt compromise
 * `CAMPAIGN_SEND_WINDOW_UTC` makes, widened by an hour at each end because a
 * chat message is a smaller intrusion than a marketing mail.
 */
export const BROADCAST_SEND_WINDOW_UTC = { from: 7, to: 21 } as const

/**
 * How many this tick may send: the per-tick ceiling inside the window, zero
 * outside it.
 */
export function broadcastTickShare(now: Date): number {
  const hour = now.getUTCHours()
  if (hour < BROADCAST_SEND_WINDOW_UTC.from || hour >= BROADCAST_SEND_WINDOW_UTC.to) return 0
  return BROADCAST_PER_TICK
}

export const BROADCAST_STATUSES = ['draft', 'queued', 'sending', 'paused', 'done'] as const
export type BroadcastStatus = (typeof BROADCAST_STATUSES)[number]

/**
 * The slug is the primary key, so "you cannot start the same broadcast twice"
 * is the database's answer rather than a check. Same shape as the `--id` the
 * announcement script has always taken.
 */
export const broadcastCreateSchema = z
  .object({
    id: z
      .string()
      .trim()
      .min(3)
      .max(64)
      .regex(/^[a-z0-9][a-z0-9-]*$/, 'Lower case, digits and dashes'),
    /** One body per locale. `en` is required — it is the fallback. */
    bodies: z.record(z.string(), z.string().trim().min(1).max(4000)),
    pushTitle: z.string().trim().min(1).max(60).default('LangX'),
  })
  .refine((input) => typeof input.bodies.en === 'string', {
    message: 'An English body is required — it is the fallback',
    path: ['bodies', 'en'],
  })
export type BroadcastCreateInput = z.infer<typeof broadcastCreateSchema>
