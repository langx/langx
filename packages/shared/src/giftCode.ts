import { z } from 'zod'

/**
 * Gift codes: a word an operator hands out — on a poster, in a partner's
 * newsletter — that anybody can type into the paywall once for months of Pro.
 *
 * Time, never money off. Google Play has no percent-off code for a
 * subscription, so a price cut could only ever exist on two of the three
 * stores; months of Pro granted by us work the same everywhere, and they are
 * the `proGifts` mechanism the operator panel and the rewards already use.
 * See docs/decisions.md → _Gift codes give time, not discounts_.
 */

export const GIFT_CODE_RULES = {
  /**
   * Redemption attempts per person per rolling hour, right or wrong. Ten is
   * far more than anybody typing a code off a poster needs, and far too few
   * to guess one: a code is the only thing standing between a stranger and a
   * free month, so guessing has to be slow.
   */
  attemptsPerHour: 10,
  /** The longest a code may give. A year, like the operator's own gift. */
  maxMonths: 12,
} as const

/**
 * What a code may look like once normalised: letters, digits and dashes, 3 to
 * 32 of them, starting with a letter or digit. Short enough to read off a
 * slide, and without the characters that change meaning between keyboards.
 */
export const GIFT_CODE_PATTERN = /^[A-Z0-9][A-Z0-9-]{2,31}$/

/**
 * The one spelling a code is stored and looked up in: trimmed, inner spaces
 * dropped, upper case. `toUpperCase` rather than `toLocaleUpperCase` on
 * purpose — under a Turkish locale the latter turns `i` into `İ`, and a
 * person typing `uber` on a Turkish phone would never match `UBER`.
 */
export function normalizeGiftCode(raw: string): string {
  return raw.replace(/\s+/g, '').toUpperCase()
}

/**
 * Why a code was not accepted, sent as `reason` on `GIFT_CODE_REJECTED`. The
 * client words each one differently, and "that code has been used up" is a
 * different sentence from "you have already used it".
 */
export const GIFT_CODE_REJECTIONS = [
  /** No such code — or not the shape of one. */
  'unknown',
  /** The operator switched it off. */
  'inactive',
  /** Past its last day. */
  'expired',
  /** Every redemption it allowed has been taken. */
  'exhausted',
  /** This person has already redeemed it. */
  'used',
  /** They hold Pro for life; months on top of forever change nothing. */
  'lifetime',
  /** An official account is not given Pro. */
  'official',
  /** Billing is not configured on this server, so nothing could grant it. */
  'unavailable',
] as const
export type GiftCodeRejection = (typeof GIFT_CODE_REJECTIONS)[number]

/**
 * `POST /me/gift-code`. The body is only bounded here, not matched against
 * the pattern: a mistyped code is a wrong guess and is answered — and counted
 * — like one, rather than as a malformed request that costs nothing to send.
 */
export const giftCodeRedeemSchema = z.object({
  code: z.string().max(64),
})
export type GiftCodeRedeemInput = z.infer<typeof giftCodeRedeemSchema>

export interface GiftCodeRedeemResult {
  months: number
  /** ISO; `null` while the grant is still pending and the scheduler will retry it. */
  endsAt: string | null
  status: 'granted' | 'pending'
}

/** An operator's new code. `maxRedemptions` and `expiresAt` are optional and mean "no limit". */
export const adminGiftCodeCreateSchema = z.object({
  code: z
    .string()
    .transform(normalizeGiftCode)
    .pipe(z.string().regex(GIFT_CODE_PATTERN, 'Use 3 to 32 letters, digits or dashes')),
  months: z.number().int().min(1).max(GIFT_CODE_RULES.maxMonths),
  maxRedemptions: z.number().int().min(1).max(1_000_000).nullable().optional(),
  expiresAt: z.iso.datetime().nullable().optional(),
  note: z.string().trim().max(500).optional(),
})
export type AdminGiftCodeCreateInput = z.infer<typeof adminGiftCodeCreateSchema>

export const adminGiftCodeUpdateSchema = z.object({ active: z.boolean() })
export type AdminGiftCodeUpdateInput = z.infer<typeof adminGiftCodeUpdateSchema>
