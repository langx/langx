import { z } from 'zod'
import type { PaidPlanTier } from './limits'

/**
 * The only things token can buy, besides a streak freeze.
 *
 * Deliberately cosmetic and nothing else: the moment token can buy a Pro
 * capability, farming token becomes a substitute for paying, and the
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

/**
 * What subscribing includes, once, per tier.
 *
 * **Items, not token.** Granting token for money is the one thing every public
 * claim about this economy rules out — `token-messaging-brief.md` says "there
 * is no way to buy tokens, with money or anything else", the in-app disclaimer
 * says it, and `legal/promise-change.md` says it in a document not yet
 * published. Handing out the things token buys keeps all three true.
 *
 * It also keeps the leaderboard honest, which a token grant could not: a
 * balance is `tokenAggregates.all` minus spending, and that aggregate is
 * exactly what the all-time table ranks. There is no way to credit a balance
 * without moving somebody up a table other people are climbing by writing
 * corrections.
 *
 * Nothing here is Pro-only in itself — every item is buyable with token by
 * anyone. Subscribing skips the saving, it does not unlock a shelf.
 */
export interface WelcomePack {
  cosmetics: readonly string[]
  streakFreezes: number
}

export const PRO_WELCOME_PACKS: Readonly<Record<PaidPlanTier, WelcomePack>> = {
  pro: { cosmetics: ['frame.bronze'], streakFreezes: 2 },
  pro_plus: {
    cosmetics: ['frame.bronze', 'frame.silver', 'frame.gold', 'title.learner'],
    streakFreezes: 2,
  },
}

/**
 * What a tier's pack adds on top of one already granted.
 *
 * Upgrading pro → pro_plus should hand over the difference, not the whole
 * thing again; downgrading and re-subscribing should hand over nothing. Both
 * fall out of "grant what this tier includes and you do not already own",
 * which is also why the caller can be idempotent without a second latch per
 * item.
 */
export function welcomePackDelta(tier: PaidPlanTier, owned: readonly string[]): readonly string[] {
  const ownedSet = new Set(owned)
  return PRO_WELCOME_PACKS[tier].cosmetics.filter((id) => !ownedSet.has(id))
}

/** Everything token can be spent on: the freeze plus the cosmetics catalogue. */
export const STREAK_FREEZE_SKU = 'streakFreeze'
/** Buys back the streak a returning v1 user had. Available once, if at all. */
export const STREAK_RESTORE_SKU = 'streakRestore'

export const purchaseSchema = z.object({
  /** `streakFreeze`, or a cosmetic id from `COSMETICS`. */
  sku: z.string().trim().min(1),
})
export type PurchaseInput = z.infer<typeof purchaseSchema>

export const walletSchema = z.object({
  /** All-time token earned. Never decreases — it is what the leaderboard ranks. */
  earned: z.number().int(),
  /** All-time token spent. */
  spent: z.number().int(),
  /** `earned - spent`, what a purchase can draw on. */
  balance: z.number().int(),
  /** Banked streak freezes, consumed automatically when a single day is missed. */
  streakFreezes: z.number().int(),
  owned: z.array(z.string()),
})
export type Wallet = z.infer<typeof walletSchema>
