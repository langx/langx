import { z } from 'zod'

/**
 * Testimonials: a few sentences one person leaves on another's profile after
 * they have actually talked. The screens call them "reviews"; the code does
 * not, because that word already means three other things here — a moderation
 * review link, an Echo card coming due and the store's rating prompt.
 *
 * Text only, no stars. A star rating turns a language partner into a product
 * with a score, and a score is the thing people game; a sentence has to be
 * written by somebody who has something to say.
 */

/**
 * Messages *each* person must have sent in the thread before either may write
 * about the other.
 *
 * Each, not together, for the lesson the media gate learned on 4 September
 * 2026 (see `MEDIA_UNLOCKS_AFTER_RECEIVED_MESSAGES`): a shared total lets one
 * person clear a gate meant to need two. A hundred messages into silence is
 * not a conversation, and a testimonial vouches for a conversation.
 *
 * Fifty because a testimonial is a public claim about somebody, read by
 * strangers deciding whether to talk to them. It should take more than an
 * afternoon of "hi" and "how are you" to be entitled to make one.
 */
export const TESTIMONIAL_UNLOCK_MESSAGES_EACH = 50

/**
 * Days since the thread's first message before it unlocks.
 *
 * Message counts alone can be farmed in an hour by two accounts that agreed
 * to praise each other. Time cannot be hurried, so it slows exactly that
 * burst while costing a real exchange nothing — three days is less than it
 * takes most pairs to reach fifty messages each anyway.
 */
export const TESTIMONIAL_UNLOCK_MIN_DAYS = 3

/**
 * Length bounds on the body, after trimming.
 *
 * Thirty is roughly one real sentence: enough to refuse "great!!!" — which
 * says nothing to the next reader — without asking for an essay. Five hundred
 * keeps a profile's list scannable; it matches `MAX_POST_NOTE_LENGTH`.
 */
export const TESTIMONIAL_MIN_LENGTH = 30
export const TESTIMONIAL_MAX_LENGTH = 500

export const TESTIMONIALS_PAGE_SIZE_DEFAULT = 20
export const TESTIMONIALS_PAGE_SIZE_MAX = 50

const DAY_MS = 24 * 60 * 60 * 1000

export interface TestimonialGateInput {
  /** The two people in the thread. */
  participants: readonly string[]
  /**
   * The thread's per-sender message counts (`conversations.messageCountBy`).
   * Absent reads as locked, never as "count on demand": every production
   * thread carries the map, and a gate that is wrong must fail closed.
   */
  messageCountBy: Readonly<Record<string, number>> | undefined
  firstMessageAt: Date
  now: Date
}

/**
 * Whether this pair may write testimonials about each other. Symmetric: it is
 * one answer for the thread, not one per side, because both halves of the
 * condition already need both people.
 *
 * Pure so the server's gate and its tests read one function; the client never
 * calls it, because the thresholds are not something the screen shows.
 */
export function testimonialUnlocked(input: TestimonialGateInput): boolean {
  const { participants, messageCountBy, firstMessageAt, now } = input
  if (!messageCountBy || participants.length !== 2) return false
  const eachSpoke = participants.every(
    (id) => (messageCountBy[id] ?? 0) >= TESTIMONIAL_UNLOCK_MESSAGES_EACH,
  )
  if (!eachSpoke) return false
  return now.getTime() - firstMessageAt.getTime() >= TESTIMONIAL_UNLOCK_MIN_DAYS * DAY_MS
}

/** `PUT /testimonials/:userId`. */
export const testimonialInputSchema = z.object({
  body: z.string().trim().min(TESTIMONIAL_MIN_LENGTH).max(TESTIMONIAL_MAX_LENGTH),
})
export type TestimonialInput = z.infer<typeof testimonialInputSchema>

/**
 * The person on either end of a testimonial. `avatarUrl` is `null` rather
 * than absent so the row renders the same way whichever end it is.
 */
export const testimonialPersonSchema = z.object({
  _id: z.string(),
  handle: z.string(),
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
})
export type TestimonialPerson = z.infer<typeof testimonialPersonSchema>

export const testimonialViewSchema = z.object({
  _id: z.string(),
  author: testimonialPersonSchema,
  body: z.string(),
  createdAt: z.string(),
  editedAt: z.string().nullable(),
  /**
   * The viewer wrote it. Carries no word about whether the profile's owner
   * hid it: the author is never told, so their own row looks the same to them
   * either way.
   */
  mine: z.boolean(),
})
export type TestimonialView = z.infer<typeof testimonialViewSchema>

/**
 * What the viewer can do about testimonials on the profile they are reading.
 * One of four answers rather than the numbers behind them: how close a pair
 * is to unlocking is deliberately never shown, because a progress bar on
 * praise is an invitation to farm it.
 */
export const TESTIMONIAL_VIEWER_STATES = ['self', 'locked', 'can_write', 'written'] as const
export const testimonialViewerStateSchema = z.enum(TESTIMONIAL_VIEWER_STATES)
export type TestimonialViewerState = z.infer<typeof testimonialViewerStateSchema>

export const listTestimonialsQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(TESTIMONIALS_PAGE_SIZE_MAX)
    .default(TESTIMONIALS_PAGE_SIZE_DEFAULT),
})
export type ListTestimonialsQuery = z.infer<typeof listTestimonialsQuerySchema>

/**
 * `GET /profiles/:handle/testimonials`, newest first.
 *
 * `total` is what *this viewer* could page through — block-filtered, like the
 * follower count, so a number beside the list never gives away a row the list
 * leaves out. `mine` rides along on every page so the composer can open on
 * what the viewer already wrote without finding it in the list.
 */
export const testimonialPageSchema = z.object({
  items: z.array(testimonialViewSchema),
  total: z.number().int().nonnegative(),
  nextCursor: z.string().nullable(),
  viewer: testimonialViewerStateSchema,
  mine: testimonialViewSchema.nullable(),
})
export type TestimonialPage = z.infer<typeof testimonialPageSchema>

/** `PUT /testimonials/:userId`: `created` is false when it edited one. */
export const testimonialWriteResultSchema = z.object({
  testimonial: testimonialViewSchema,
  created: z.boolean(),
})
export type TestimonialWriteResult = z.infer<typeof testimonialWriteResultSchema>

/** A row on the owner's own list, where hidden ones are shown and marked. */
export const receivedTestimonialSchema = testimonialViewSchema.extend({
  hidden: z.boolean(),
})
export type ReceivedTestimonial = z.infer<typeof receivedTestimonialSchema>

/**
 * A row on the author's own list. `removed` is the one place a moderator's
 * decision is visible to the author: their words are theirs to see, and
 * silently vanishing would only prompt them to write it again.
 */
export const writtenTestimonialSchema = z.object({
  _id: z.string(),
  subject: testimonialPersonSchema,
  body: z.string(),
  createdAt: z.string(),
  editedAt: z.string().nullable(),
  removed: z.boolean(),
})
export type WrittenTestimonial = z.infer<typeof writtenTestimonialSchema>

export const MY_TESTIMONIAL_TABS = ['received', 'written'] as const
export type MyTestimonialTab = (typeof MY_TESTIMONIAL_TABS)[number]

export const listMyTestimonialsQuerySchema = listTestimonialsQuerySchema.extend({
  tab: z.enum(MY_TESTIMONIAL_TABS).default('received'),
})
export type ListMyTestimonialsQuery = z.infer<typeof listMyTestimonialsQuerySchema>

export const receivedTestimonialsPageSchema = z.object({
  items: z.array(receivedTestimonialSchema),
  nextCursor: z.string().nullable(),
})
export type ReceivedTestimonialsPage = z.infer<typeof receivedTestimonialsPageSchema>

export const writtenTestimonialsPageSchema = z.object({
  items: z.array(writtenTestimonialSchema),
  nextCursor: z.string().nullable(),
})
export type WrittenTestimonialsPage = z.infer<typeof writtenTestimonialsPageSchema>

/**
 * On a thread's first message page, so the chat can offer "write about them"
 * without a request of its own. Two booleans and never the counts behind
 * them, for the same reason `TestimonialViewerState` has none.
 */
export const threadTestimonialStateSchema = z.object({
  unlocked: z.boolean(),
  written: z.boolean(),
})
export type ThreadTestimonialState = z.infer<typeof threadTestimonialStateSchema>
