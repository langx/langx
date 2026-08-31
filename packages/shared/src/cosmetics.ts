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

/**
 * A frame's colour, as a **role** rather than a value.
 *
 * `packages/shared` cannot import the theme — and must not, since the same
 * frame has to read on a white background and a dark one. The mobile side maps
 * these through `frameColors`, which is the only place a hex lives.
 */
export const COSMETIC_TONES = [
  'slate',
  'bronze',
  'silver',
  'gold',
  'sky',
  'mint',
  'ember',
  'violet',
  'midnight',
  'aurora',
] as const
export type CosmeticTone = (typeof COSMETIC_TONES)[number]

/**
 * A condition beyond the price.
 *
 * Both fields are **monotonic** — a longest streak and a lifetime count — and
 * that is required rather than incidental: the purchase re-checks what it can
 * inside the atomic update, and a gate that could go down would let an item be
 * owned and then un-ownable.
 */
export interface CosmeticRequirement {
  longestStreak?: number
  corrections?: number
}

export interface Cosmetic {
  id: string
  kind: CosmeticKind
  /** Shown to the user; the client is free to localise by `id`. */
  label: string
  price: number
  /** Frames only. */
  tone?: CosmeticTone
  requires?: CosmeticRequirement
}

/**
 * The catalogue, and the only sink the economy has.
 *
 * Prices were raised across the board when this grew. The old six totalled
 * 21,000 — about thirty days for somebody earning well — so a committed user
 * bought the shop out in a month and token stopped having anywhere to go. The
 * ladder below totals about 393,000, roughly 560 days at the same rate:
 * aspirational without being decorative.
 *
 * It fixes a v1 problem on the way. The largest v1 balance converts to 22,800
 * token; at the old prices a returning user cleared almost the whole
 * catalogue on their first day.
 *
 * **The order of this array is a rule, not a layout.** Each item can only be
 * bought once the one before it in the same `kind` is owned — see
 * `previousCosmetic` — so inserting a row in the middle inserts a rung, and
 * reordering two rows swaps what has to be earned first. It used to be free to
 * shuffle these; it is not any more. `rules.test.ts` asserts each kind is
 * strictly ascending in price, which is what keeps the ladder and the prices
 * from telling different stories.
 */
export const COSMETICS: readonly Cosmetic[] = [
  { id: 'frame.slate', kind: 'frame', label: 'Slate frame', price: 1000, tone: 'slate' },
  { id: 'frame.bronze', kind: 'frame', label: 'Bronze frame', price: 2500, tone: 'bronze' },
  { id: 'frame.sky', kind: 'frame', label: 'Sky frame', price: 4000, tone: 'sky' },
  { id: 'frame.silver', kind: 'frame', label: 'Silver frame', price: 6000, tone: 'silver' },
  { id: 'frame.mint', kind: 'frame', label: 'Mint frame', price: 9000, tone: 'mint' },
  { id: 'frame.ember', kind: 'frame', label: 'Ember frame', price: 13_000, tone: 'ember' },
  { id: 'frame.gold', kind: 'frame', label: 'Gold frame', price: 18_000, tone: 'gold' },
  { id: 'frame.violet', kind: 'frame', label: 'Violet frame', price: 25_000, tone: 'violet' },
  { id: 'frame.midnight', kind: 'frame', label: 'Midnight frame', price: 35_000, tone: 'midnight' },
  /**
   * The one nobody can simply save up for.
   *
   * A year without missing a day *and* five thousand corrections written — the
   * top rung of `TOKEN_RULES.streakMilestones` and of the correction badge
   * thresholds, so the shop and the badge screen tell one story. v1's longest
   * streak ever was 446 days, which is what makes the first half real.
   *
   * Price and gate agree by construction: 5,000 corrections is 50,000 token
   * earned on its own, so anybody who qualifies can already afford it. The
   * gate decides *who*, the price decides *when*.
   */
  {
    id: 'frame.aurora',
    kind: 'frame',
    label: 'Aurora frame',
    price: 50_000,
    tone: 'aurora',
    requires: { longestStreak: 365, corrections: 5000 },
  },
  { id: 'title.beginner', kind: 'title', label: 'Beginner', price: 1500 },
  { id: 'title.learner', kind: 'title', label: 'Learner', price: 3000 },
  { id: 'title.helper', kind: 'title', label: 'Helper', price: 5000 },
  { id: 'title.tutor', kind: 'title', label: 'Tutor', price: 8000 },
  { id: 'title.mentor', kind: 'title', label: 'Mentor', price: 12_000 },
  { id: 'title.linguist', kind: 'title', label: 'Linguist', price: 15_000 },
  { id: 'title.polyglot', kind: 'title', label: 'Polyglot', price: 17_000 },
  { id: 'title.scholar', kind: 'title', label: 'Scholar', price: 20_000 },
  { id: 'title.master', kind: 'title', label: 'Master', price: 50_000 },
  { id: 'title.legend', kind: 'title', label: 'Legend', price: 100_000 },
]

/** Progress against a gate: what the client draws and the server checks. */
export interface CosmeticProgress {
  longestStreak: number
  corrections: number
}

/** Whether a gate is met. No requirement is not a failed one. */
export function meetsRequirement(
  requires: CosmeticRequirement | undefined,
  progress: CosmeticProgress,
): boolean {
  if (!requires) return true
  if (requires.longestStreak !== undefined && progress.longestStreak < requires.longestStreak) {
    return false
  }
  if (requires.corrections !== undefined && progress.corrections < requires.corrections) {
    return false
  }
  return true
}

export function findCosmetic(id: string): Cosmetic | undefined {
  return COSMETICS.find((c) => c.id === id)
}

/**
 * The rung below this one, or nothing if it is the first.
 *
 * Frames and titles are two ladders, not one list, so "the one before" is
 * scoped to the kind — buying a frame has never had anything to do with
 * owning a title and still does not.
 *
 * Derived from the array rather than from the price, even though the two
 * agree and a test says so. A price comparison would quietly turn two items
 * priced the same into an unbuyable pair, and it would make a repricing
 * silently reorder what has to be earned first. The order is the rule; the
 * prices are how it is explained.
 */
export function previousCosmetic(cosmetic: Cosmetic): Cosmetic | undefined {
  const ladder = COSMETICS.filter((c) => c.kind === cosmetic.kind)
  const index = ladder.findIndex((c) => c.id === cosmetic.id)
  return index > 0 ? ladder[index - 1] : undefined
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

/**
 * The **first** rungs of each ladder, not a handful picked from up it.
 *
 * These used to be `frame.bronze` and `frame.bronze/silver/gold` — the 2nd,
 * 4th and 7th frames, plus the 2nd title. That was fine while the catalogue
 * was a shelf. Now that it is a ladder it would have handed somebody the
 * rungs above ones they did not own, which is either incoherent or a debt,
 * depending on how strictly the gate is read.
 *
 * Starting at the bottom makes the two possible readings of the gate — "own
 * the one below" and "own everything below" — the same rule, by induction.
 * There is only one sentence to explain: you buy them in order.
 *
 * Existing subscribers keep what they were given; `welcomePackAt` latches per
 * tier and is never re-run. They are the reason the gate is written as *own
 * the one below* rather than *own everything below*: somebody holding gold
 * without silver must still be able to move, and asking them to go back and
 * buy the rungs under a gift would turn a gift into a bill.
 */
export const PRO_WELCOME_PACKS: Readonly<Record<PaidPlanTier, WelcomePack>> = {
  pro: { cosmetics: ['frame.slate', 'frame.bronze'], streakFreezes: 2 },
  pro_plus: {
    cosmetics: [
      'frame.slate',
      'frame.bronze',
      'frame.sky',
      'frame.silver',
      'title.beginner',
      'title.learner',
    ],
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

/**
 * Which cosmetic is *worn*, as opposed to owned.
 *
 * Ownership is a set; this is the choice. Without it a second frame is a
 * purchase that changes nothing, which makes the catalogue above pointless
 * past the first item.
 */
export const equippedSchema = z.object({ frame: z.string(), title: z.string() }).partial()
export type Equipped = z.infer<typeof equippedSchema>

/**
 * What to draw when nothing has been chosen: the most expensive owned item of
 * that kind.
 *
 * So somebody who bought a frame before choosing was a thing still sees it,
 * and a first purchase is visible without a second step. An explicit choice
 * overrides it.
 */
export function defaultEquipped(owned: readonly string[], kind: CosmeticKind): string | undefined {
  return COSMETICS.filter((c) => c.kind === kind && owned.includes(c.id)).sort(
    (a, b) => b.price - a.price,
  )[0]?.id
}

/** What is actually drawn: the explicit choice, or the fallback above. */
export function wornCosmetic(
  equipped: Equipped | undefined,
  owned: readonly string[],
  kind: CosmeticKind,
): Cosmetic | undefined {
  const chosen = kind === 'frame' ? equipped?.frame : equipped?.title
  // A chosen id that is not owned is never drawn. The server refuses to write
  // one, but a stale client or an older document must not paint it either.
  const id = chosen && owned.includes(chosen) ? chosen : defaultEquipped(owned, kind)
  return id ? findCosmetic(id) : undefined
}

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
  equipped: equippedSchema.optional(),
})
export type Wallet = z.infer<typeof walletSchema>
