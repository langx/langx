import { z } from 'zod'

/**
 * The only things XP can buy, besides a streak freeze.
 *
 * Deliberately cosmetic and nothing else: the moment XP can buy a Pro
 * capability, farming XP becomes a substitute for paying, and the
 * subscription is the thing that funds the app. Prices live here, in public,
 * because the enforcement is a server-side atomic balance check — not secrecy.
 */
export const COSMETIC_KINDS = ['frame', 'title'] as const
export type CosmeticKind = (typeof COSMETIC_KINDS)[number]

export interface Cosmetic {
  id: string
  kind: CosmeticKind
  /** Shown to the user; the client is free to localise by `id`. */
  label: string
  price: number
}

export const COSMETICS: readonly Cosmetic[] = [
  { id: 'frame.bronze', kind: 'frame', label: 'Bronze frame', price: 500 },
  { id: 'frame.silver', kind: 'frame', label: 'Silver frame', price: 1500 },
  { id: 'frame.gold', kind: 'frame', label: 'Gold frame', price: 5000 },
  { id: 'title.learner', kind: 'title', label: 'Learner', price: 1000 },
  { id: 'title.tutor', kind: 'title', label: 'Tutor', price: 3000 },
  { id: 'title.polyglot', kind: 'title', label: 'Polyglot', price: 10_000 },
]

export function findCosmetic(id: string): Cosmetic | undefined {
  return COSMETICS.find((c) => c.id === id)
}

/** Everything XP can be spent on: the freeze plus the cosmetics catalogue. */
export const STREAK_FREEZE_SKU = 'streakFreeze'

export const purchaseSchema = z.object({
  /** `streakFreeze`, or a cosmetic id from `COSMETICS`. */
  sku: z.string().trim().min(1),
})
export type PurchaseInput = z.infer<typeof purchaseSchema>

export const walletSchema = z.object({
  /** All-time XP earned. Never decreases — it is what the leaderboard ranks. */
  earned: z.number().int(),
  /** All-time XP spent. */
  spent: z.number().int(),
  /** `earned - spent`, what a purchase can draw on. */
  balance: z.number().int(),
  /** Banked streak freezes, consumed automatically when a single day is missed. */
  streakFreezes: z.number().int(),
  owned: z.array(z.string()),
})
export type Wallet = z.infer<typeof walletSchema>
