import { z } from 'zod'
import type { Locale } from './locales'

/**
 * Something to tap under a message from `@langx`: a poll, or a card with one
 * button.
 *
 * Not a message type. The message stays `type: 'text'` with the whole thing
 * written out in its body, exactly like `ask` — so the chat list row, the push
 * and a build that predates this all read a complete sentence, and the chips
 * are an extra on top for the builds that know how to draw them.
 *
 * Two shapes of the same thing: the **authored** one on a broadcast, with a
 * label per locale, and the **resolved** one on a message, in the reader's own
 * language. A message never carries the other seven translations — each
 * recipient has their own copy of a broadcast, so it only ever needs one.
 */

/** Option and poll ids: language-free slugs, so results add up across locales. */
export const INTERACTIVE_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/
const interactiveIdSchema = z.string().regex(INTERACTIVE_ID_PATTERN)

export const POLL_MIN_OPTIONS = 2
export const POLL_MAX_OPTIONS = 8
export const INTERACTIVE_LABEL_MAX_LENGTH = 80
export const CARD_TITLE_MAX_LENGTH = 120

/**
 * What a card's button does.
 *
 * `storeReview` rather than a URL because the right address depends on the
 * phone reading it, and on the web there is no store — the client hides the
 * button there. `openUrl` is https only: a broadcast is not the place for a
 * scheme we have not thought about. `openRoute` is an in-app path.
 */
export const cardActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('storeReview') }),
  z.object({ type: z.literal('openUrl'), url: z.string().url().startsWith('https://') }),
  z.object({ type: z.literal('openRoute'), route: z.string().startsWith('/').max(200) }),
])
export type CardAction = z.infer<typeof cardActionSchema>

const labelSchema = z.string().trim().min(1).max(INTERACTIVE_LABEL_MAX_LENGTH)

function uniqueIds(options: readonly { id: string }[]): boolean {
  return new Set(options.map((option) => option.id)).size === options.length
}

// ─── On a message: one language ─────────────────────────────────────────────

export const messagePollSchema = z.object({
  kind: z.literal('poll'),
  pollId: interactiveIdSchema,
  options: z
    .array(z.object({ id: interactiveIdSchema, label: labelSchema }))
    .min(POLL_MIN_OPTIONS)
    .max(POLL_MAX_OPTIONS)
    .refine(uniqueIds, 'Option ids must be unique'),
  /**
   * The reader's pick, written onto their own copy of the message by the
   * answer — so the chip stays ticked on every device without a second
   * lookup. `pollAnswers` is the record that counts; this is the echo of it.
   */
  answer: interactiveIdSchema.optional(),
})
export type MessagePoll = z.infer<typeof messagePollSchema>

export const messageCardSchema = z.object({
  kind: z.literal('card'),
  title: z.string().trim().min(1).max(CARD_TITLE_MAX_LENGTH),
  button: z.object({ label: labelSchema, action: cardActionSchema }),
})
export type MessageCard = z.infer<typeof messageCardSchema>

export const messageInteractiveSchema = z.discriminatedUnion('kind', [
  messagePollSchema,
  messageCardSchema,
])
export type MessageInteractive = z.infer<typeof messageInteractiveSchema>

// ─── On a broadcast: every language ─────────────────────────────────────────

/** A label per locale; `en` is required and is the fallback, as with bodies. */
function localized(max: number) {
  return z
    .record(z.string(), z.string().trim().min(1).max(max))
    .refine((labels) => typeof labels.en === 'string', 'An English label is required')
}

export const broadcastPollSchema = z.object({
  kind: z.literal('poll'),
  pollId: interactiveIdSchema,
  options: z
    .array(z.object({ id: interactiveIdSchema, labels: localized(INTERACTIVE_LABEL_MAX_LENGTH) }))
    .min(POLL_MIN_OPTIONS)
    .max(POLL_MAX_OPTIONS)
    .refine(uniqueIds, 'Option ids must be unique'),
})

export const broadcastCardSchema = z.object({
  kind: z.literal('card'),
  title: localized(CARD_TITLE_MAX_LENGTH),
  button: z.object({
    label: localized(INTERACTIVE_LABEL_MAX_LENGTH),
    action: cardActionSchema,
  }),
})

export const broadcastInteractiveSchema = z.discriminatedUnion('kind', [
  broadcastPollSchema,
  broadcastCardSchema,
])
export type BroadcastInteractive = z.infer<typeof broadcastInteractiveSchema>

function pick(labels: Record<string, string>, locale: Locale): string {
  return labels[locale] ?? labels.en ?? ''
}

/** The authored shape, in one reader's language. */
export function resolveInteractive(spec: BroadcastInteractive, locale: Locale): MessageInteractive {
  if (spec.kind === 'poll') {
    return {
      kind: 'poll',
      pollId: spec.pollId,
      options: spec.options.map((option) => ({
        id: option.id,
        label: pick(option.labels, locale),
      })),
    }
  }
  return {
    kind: 'card',
    title: pick(spec.title, locale),
    button: { label: pick(spec.button.label, locale), action: spec.button.action },
  }
}

// ─── Answering ──────────────────────────────────────────────────────────────

/** One contract for REST and the socket. */
export const answerPollSchema = z.object({
  conversationId: z.string().trim().min(1),
  messageId: z.string().trim().min(1),
  optionId: interactiveIdSchema,
})
export type AnswerPollInput = z.infer<typeof answerPollSchema>

/** Per-option counts for the operator panel. Options nobody picked read 0. */
export interface PollResults {
  pollId: string
  total: number
  counts: Record<string, number>
}
