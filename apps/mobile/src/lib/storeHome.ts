import { findCosmetic, type CosmeticKind, type CosmeticRequirement } from '@langx/shared'
import type { StoreOffer } from './storeOffers'

/*
 * The redesign's store home, its collections and its frame sheet, as pure
 * functions: what each block picks from `buildStoreOffers`, so the picking can
 * be tested without a React tree. Nothing here prices or gates anything — the
 * offers already say what is owned, locked and affordable, and the screens
 * only arrange them.
 */

export const RARITIES = ['common', 'rare', 'epic', 'legendary'] as const
export type Rarity = (typeof RARITIES)[number]

/**
 * Each frame's rarity, from the v3 master sheet: five rungs of matte paper,
 * felt and reed, five glazed, five lacquered, and the one gated glass.
 *
 * A table by id rather than a rule on the price, because the sheet decides it
 * by material and the price only happens to agree; `storeHome.test.ts` keeps
 * every frame in `COSMETICS` listed and the rarities climbing with the ladder,
 * so a frame added without a rarity fails there instead of drawing none.
 * Presentation only: no server code reads it, and no price depends on it.
 */
export const FRAME_RARITY: Readonly<Record<string, Rarity>> = {
  'frame.slate': 'common',
  'frame.washi': 'common',
  'frame.bronze': 'common',
  'frame.lino': 'common',
  'frame.sky': 'common',
  'frame.silver': 'rare',
  'frame.indigo': 'rare',
  'frame.mint': 'rare',
  'frame.mosaic': 'rare',
  'frame.ember': 'rare',
  'frame.gold': 'epic',
  'frame.seal': 'epic',
  'frame.violet': 'epic',
  'frame.marquetry': 'epic',
  'frame.midnight': 'epic',
  'frame.aurora': 'legendary',
}

/** A frame's rarity; an id this build does not know is drawn as common. */
export function frameRarity(id: string): Rarity {
  return FRAME_RARITY[id] ?? 'common'
}

/** The frames, grouped by rarity in ladder order, with empty groups left out. */
export function framesByRarity(
  frames: readonly StoreOffer[],
): { rarity: Rarity; frames: StoreOffer[] }[] {
  return RARITIES.map((rarity) => ({
    rarity,
    frames: frames.filter((offer) => frameRarity(offer.id) === rarity),
  })).filter((group) => group.frames.length > 0)
}

/** Whether the balance buys this cosmetic now: not owned, not locked, covered. */
function buyable(offer: StoreOffer): boolean {
  return !!offer.kind && !offer.owned && !offer.locked && offer.affordable
}

/**
 * The one thing the balance can buy right now, for the home's yellow Buy: the
 * cheapest cosmetic that is open and covered, or nothing.
 *
 * The cheapest rather than the dearest, because it is the one that leaves the
 * most behind, and the screen says how much ("840 left after"). Consumables
 * are left out: the freeze and the repair have their own block, and a yellow
 * on the freeze would read as the store telling you to buy insurance.
 */
export function withinReach(offers: readonly StoreOffer[]): StoreOffer | undefined {
  return offers
    .filter(buyable)
    .reduce<StoreOffer | undefined>(
      (best, offer) => (!best || offer.price < best.price ? offer : best),
      undefined,
    )
}

/** How many of a ladder's next rungs "Up next" shows. */
const RUNGS_AHEAD = 2

/**
 * How many unowned sticker packs "Up next" shows. With ten packs in the
 * catalogue, "every pack" would bury the two ladders under stickers; the
 * rest are a tap away in the stickers collection.
 */
const PACKS_AHEAD = 3

/**
 * What the home's "Up next" row shows: on each ladder the next two rungs not
 * yet owned — so the second, still locked, says which rung opens it — and
 * the first three sticker packs not yet owned, in catalogue order. Without
 * what "Within reach" already shows.
 *
 * This replaced the drawing's "New this week". Nothing in the catalogue says
 * when an item arrived, and a row that called every item new would be a
 * claim with nothing under it; what is next on your own ladder is true for
 * every account, and is the question the row is there to answer.
 */
export function upNext(offers: readonly StoreOffer[], skip?: string): StoreOffer[] {
  const pick = (kind: CosmeticKind, count: number) =>
    offers
      .filter((offer) => offer.kind === kind && !offer.owned && offer.id !== skip)
      .slice(0, count)
  return [
    ...pick('frame', RUNGS_AHEAD),
    ...pick('title', RUNGS_AHEAD),
    ...pick('stickers', PACKS_AHEAD),
  ]
}

/** "3 of 16 owned": a collection tile's count. */
export function collectionCount(
  offers: readonly StoreOffer[],
  kind: CosmeticKind,
): { owned: number; total: number } {
  const of = offers.filter((offer) => offer.kind === kind)
  return { owned: of.filter((offer) => offer.owned).length, total: of.length }
}

/**
 * Which frame the collection opens on: the next rung you can buy, else the
 * one you are wearing, else the first. The next rung is what the screen's
 * one Buy is for; the worn one is the answer to "what do I look like now".
 */
export function initialFrame(
  frames: readonly StoreOffer[],
  worn: string | undefined,
): StoreOffer | undefined {
  return (
    frames.find((offer) => !offer.owned && !offer.locked) ??
    frames.find((offer) => offer.id === worn) ??
    frames[0]
  )
}

/**
 * What a frame's sheet and the collection's footer offer, in one word:
 *
 * - `buy` — open and covered: the yellow Buy;
 * - `short` — open, but the balance is under the price;
 * - `ladder` — the rung below (or one above it) is not owned yet;
 * - `gate` — the ladder is open but a streak or correction gate is not met;
 * - `wear` / `wearing` — owned.
 *
 * The ladder wins over the gate, as `buildStoreOffers` has it: "buy Night
 * Hoop first" is the nearer answer.
 */
export type FrameAction = 'buy' | 'short' | 'ladder' | 'gate' | 'wear' | 'wearing'

export function frameAction(offer: StoreOffer, worn: string | undefined): FrameAction {
  if (offer.owned) return offer.id === worn ? 'wearing' : 'wear'
  if (offer.locked) return offer.needs ? 'ladder' : 'gate'
  return offer.affordable ? 'buy' : 'short'
}

export interface GateRow {
  kind: 'streak' | 'corrections'
  current: number
  threshold: number
  met: boolean
}

/**
 * Every gate on a cosmetic, with the account's real counts — both of Aurora
 * Glass's, not only the furthest, which is all `StoreOffer.requirement` keeps.
 * The sheet draws each one, met or not, because "212 of 365" and "3,480 of
 * 5,000" together are the honest picture; the furthest alone hides the other.
 */
export function gateRows(
  id: string,
  progress: { longestStreak: number; corrections: number },
): GateRow[] {
  const requires: CosmeticRequirement | undefined = findCosmetic(id)?.requires
  if (!requires) return []
  const rows: GateRow[] = []
  if (requires.longestStreak !== undefined) {
    rows.push({
      kind: 'streak',
      current: progress.longestStreak,
      threshold: requires.longestStreak,
      met: progress.longestStreak >= requires.longestStreak,
    })
  }
  if (requires.corrections !== undefined) {
    rows.push({
      kind: 'corrections',
      current: progress.corrections,
      threshold: requires.corrections,
      met: progress.corrections >= requires.corrections,
    })
  }
  return rows
}
