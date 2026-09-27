import { z } from 'zod'
import { clientMessageIdSchema, messageBodySchema } from './chat'
import { localDayKey, localTimeOn, shiftDayKey } from './periods'

/**
 * "Send later": a text message written now and delivered by the server at a
 * chosen time. The same for every tier — it costs nothing per message, so it
 * is not a plan limit and has no copy on the website.
 *
 * How many may wait in one conversation at once. A handful is what somebody
 * writing across time zones needs; more than that is a queue of monologue the
 * other person has not answered yet.
 */
export const MAX_SCHEDULED_PER_CONVERSATION = 5

/** How far ahead a message may be scheduled. A week, like a meeting proposal. */
export const MAX_SCHEDULE_AHEAD_DAYS = 7

/**
 * "In their morning" means this hour on the recipient's clock: late enough to
 * be awake, early enough to be read before the day takes over.
 */
export const THEIR_MORNING_HOUR = 9

/**
 * The life of one scheduled message. `sending` is the claim the scheduler
 * takes before it sends, so two passes cannot both send the same row; `sent`
 * keeps the id of the message it became; `failed` keeps why, and stays in the
 * thread until its author dismisses it.
 */
export const SCHEDULED_MESSAGE_STATUSES = ['pending', 'sending', 'sent', 'failed'] as const
export type ScheduledMessageStatus = (typeof SCHEDULED_MESSAGE_STATUSES)[number]

/**
 * Body of `POST /conversations/:id/scheduled`. Exactly one of `sendAt` and
 * `mode`: a time the sender picked, or "their morning", which the server works
 * out from the partner's timezone so the client never needs to see it when
 * their privacy setting withholds it.
 *
 * `clientId` is required here, unlike on a live send: a create whose answer
 * was lost is retried, and without the id a retry is a second scheduled copy.
 */
export const scheduleMessageSchema = z
  .object({
    body: messageBodySchema,
    clientId: clientMessageIdSchema,
    sendAt: z.iso.datetime().optional(),
    mode: z.literal('theirMorning').optional(),
  })
  .refine((input) => (input.sendAt === undefined) !== (input.mode === undefined), {
    message: 'Give either sendAt or mode, not both',
  })
export type ScheduleMessageInput = z.infer<typeof scheduleMessageSchema>

/** A scheduled message as its author sees it — nobody else ever does. */
export interface ScheduledMessageDto {
  _id: string
  conversationId: string
  body: string
  sendAt: string
  status: ScheduledMessageStatus
  /** An `ERROR_CODES` value, on `failed` only. */
  failureReason?: string
  createdAt: string
}

function isUsableTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone })
    return true
  } catch {
    return false
  }
}

/**
 * The next `THEIR_MORNING_HOUR`:00 on `timeZone`'s clock after `now` — today's
 * if it has not come yet, otherwise tomorrow's.
 *
 * `null` for a zone Intl does not know, unlike the period helpers, which fall
 * back to UTC. Those keep a streak counting; this would put a message in
 * somebody's inbox at 09:00 UTC while telling the sender it was their morning,
 * and saying nothing is the honest answer.
 */
export function nextMorningIn(
  timeZone: string,
  now: Date,
  hour: number = THEIR_MORNING_HOUR,
): Date | null {
  if (!isUsableTimeZone(timeZone)) return null
  const today = localDayKey(now, timeZone)
  const todays = localTimeOn(today, hour, timeZone)
  if (todays.getTime() > now.getTime()) return todays
  return localTimeOn(shiftDayKey(today, 1), hour, timeZone)
}
