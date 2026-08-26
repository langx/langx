import { z } from 'zod'

export const MAX_MESSAGE_LENGTH = 2000

export const messageBodySchema = z.string().trim().min(1).max(MAX_MESSAGE_LENGTH)

/**
 * Body of `POST /conversations` — there is no match gate, so "starting a
 * conversation" and "sending its first message" are the same request. A
 * second call for the same pair fails on `conversations.pairKey`'s unique
 * index (surfaced as `CONVERSATION_EXISTS`), not a second write here.
 */
export const startConversationSchema = z.object({
  toUserId: z.string().trim().min(1),
  body: messageBodySchema,
})
export type StartConversationInput = z.infer<typeof startConversationSchema>

export const quotaStatusSchema = z.object({
  /** `null` means unlimited (Pro). */
  limit: z.number().int().nullable(),
  remaining: z.number().int().nullable(),
  /** ISO timestamp the oldest counted initiation rolls out of the 24h window, only set once `remaining` is 0. */
  nextAvailableAt: z.string().nullable(),
})
export type QuotaStatus = z.infer<typeof quotaStatusSchema>
