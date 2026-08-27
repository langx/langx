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

/**
 * `audio`/`image` are v1 parity items pushed to P1 (see the plan's MVP
 * note) — Faz 5 only needs `text` and `correction`, the two the MVP list
 * calls out ("1-1 sohbet" + "mesaj düzeltme").
 */
export const MESSAGE_TYPES = ['text', 'correction'] as const
export type MessageType = (typeof MESSAGE_TYPES)[number]

export const sendTextMessageSchema = z.object({
  conversationId: z.string().trim().min(1),
  body: messageBodySchema,
})
export type SendTextMessageInput = z.infer<typeof sendTextMessageSchema>

export const CORRECTION_NOTE_MAX_LENGTH = 500

/**
 * Corrections are unlimited on both tiers (`PLAN_LIMITS.correctionsPer24h`)
 * — see limits.ts's doc comment on why capping them would shrink the value a
 * free user provides a Pro one. No quota check anywhere near this schema.
 */
export const sendCorrectionSchema = z.object({
  conversationId: z.string().trim().min(1),
  targetMessageId: z.string().trim().min(1),
  corrected: messageBodySchema,
  note: z.string().trim().max(CORRECTION_NOTE_MAX_LENGTH).optional(),
})
export type SendCorrectionInput = z.infer<typeof sendCorrectionSchema>

export const MESSAGE_PAGE_SIZE_DEFAULT = 30
export const MESSAGE_PAGE_SIZE_MAX = 100

/** `GET /conversations/:id/messages` — cursor pages backwards into history, newest page first. */
export const listMessagesQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(MESSAGE_PAGE_SIZE_MAX)
    .default(MESSAGE_PAGE_SIZE_DEFAULT),
})
export type ListMessagesQuery = z.infer<typeof listMessagesQuerySchema>

export const CONVERSATION_PAGE_SIZE_DEFAULT = 20
export const CONVERSATION_PAGE_SIZE_MAX = 50

/** `GET /conversations` — the chat list, sorted by most recent activity. */
export const listConversationsQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(CONVERSATION_PAGE_SIZE_MAX)
    .default(CONVERSATION_PAGE_SIZE_DEFAULT),
})
export type ListConversationsQuery = z.infer<typeof listConversationsQuerySchema>
