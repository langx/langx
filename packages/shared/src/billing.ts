import { z } from 'zod'

/**
 * RevenueCat's own webhook payload has many more fields; this only declares
 * what `processRevenueCatWebhook` actually reads. `.passthrough()` (implicit
 * — extra keys are simply ignored by not being in the shape) means a new
 * field RevenueCat adds later can't break parsing.
 */
export const revenueCatEventSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  app_user_id: z.string().min(1),
  product_id: z.string().optional(),
  store: z.string().optional(),
  environment: z.string().optional(),
  expiration_at_ms: z.number().nullable().optional(),
})
export type RevenueCatEvent = z.infer<typeof revenueCatEventSchema>

export const revenueCatWebhookBodySchema = z.object({
  api_version: z.string().optional(),
  event: revenueCatEventSchema,
})
export type RevenueCatWebhookBody = z.infer<typeof revenueCatWebhookBodySchema>

/**
 * Event types that grant or extend Pro access. `TRANSFER` is handled as a
 * grant to `app_user_id` only — RevenueCat's `transferred_from` side (the
 * account losing access) isn't revoked by this MVP; a stale grant there
 * self-corrects at its own `expiresAt` or the next real event.
 */
export const ENTITLEMENT_GRANT_EVENTS = [
  'INITIAL_PURCHASE',
  'RENEWAL',
  'PRODUCT_CHANGE',
  'UNCANCELLATION',
  'NON_RENEWING_PURCHASE',
  'SUBSCRIPTION_EXTENDED',
  'TEMPORARY_ENTITLEMENT_GRANT',
  'TRANSFER',
] as const

/** Definitive, immediate loss of access. */
export const ENTITLEMENT_REVOKE_EVENTS = ['EXPIRATION'] as const

/** Access continues until `expiresAt`; only `willRenew` flips. */
export const ENTITLEMENT_CANCEL_EVENTS = ['CANCELLATION'] as const
