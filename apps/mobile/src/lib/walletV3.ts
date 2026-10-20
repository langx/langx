import {
  COSMETICS,
  isLadderKind,
  previousCosmetic,
  type Cosmetic,
  type Locale,
} from '@langx/shared'
import type { TranslateFn } from '../i18n/runtime'
import type { HistoryEntry, HistoryRow } from './tokenHistory'

/**
 * The freezes tile's value: "1 of 2" up to the cap, and the count alone past
 * it. The Pro welcome pack banks freezes a purchase could not, and "4 of 2"
 * reads as a fault rather than as a gift.
 */
export function freezeBankValue(
  banked: number,
  max: number,
  { t, locale }: { t: TranslateFn; locale: Locale },
): string {
  if (banked > max) return banked.toLocaleString(locale)
  return t('wallet.countOf', {
    current: banked.toLocaleString(locale),
    total: max.toLocaleString(locale),
  })
}

/** The rung the wallet's bar measures, and how far the balance is from it. */
export interface NextRung {
  cosmetic: Cosmetic
  /** Tokens still to save; 0 once the balance covers it. */
  left: number
  /** 0 to 1: the balance against the price, full once it is covered. */
  fraction: number
}

/**
 * The nearest frame or title the balance is saving towards: the cheapest rung
 * on either ladder that could be bought next — not owned, and with the one
 * below it owned (`previousCosmetic`, the shop's own gate).
 *
 * Both ladders rather than one: they are climbed side by side, and the nearer
 * rung is the honest answer to "what is this balance for". Sticker packs are
 * not a ladder and are left out.
 *
 * A rung behind an earned gate (`requires`) is left out too. The bar measures
 * saving, and that rung is not saved for: a year of streak is not something
 * a balance gets closer to. The wallet does not load the progress the gate
 * reads, so it cannot say whether the gate is met — and a bar that fills up
 * to a frame the store then refuses would be a promise.
 *
 * Nothing when every rung that can be saved for is owned.
 */
export function nextRung(owned: readonly string[], balance: number): NextRung | null {
  const have = new Set(owned)
  const next = COSMETICS.filter((item) => {
    if (!isLadderKind(item.kind) || have.has(item.id) || item.requires) return false
    const below = previousCosmetic(item)
    return !below || have.has(below.id)
  }).sort((a, b) => a.price - b.price)[0]
  if (!next) return null
  const spendable = Math.max(0, balance)
  return {
    cosmetic: next,
    left: Math.max(0, next.price - spendable),
    fraction: Math.min(1, spendable / next.price),
  }
}

/** One line of the history list: a day's heading, or one kind's total under it. */
export type HistoryItem =
  | { kind: 'heading'; key: string; day: string; label: string }
  | {
      kind: 'entry'
      key: string
      entry: HistoryEntry
      /** The first and last rows of a day draw the rounded ends of its block. */
      first: boolean
      last: boolean
    }

/**
 * The history's days as one flat list for a virtualised list: a heading per
 * day, then that day's kinds, each knowing whether it opens or closes the
 * day's block. A day with nothing in it — a page boundary can leave one —
 * draws no heading over an empty block.
 */
export function historyItems(days: readonly HistoryRow[]): HistoryItem[] {
  return days.flatMap((day) => {
    if (day.entries.length === 0) return []
    return [
      { kind: 'heading' as const, key: day.day, day: day.day, label: day.label },
      ...day.entries.map((entry, index) => ({
        kind: 'entry' as const,
        key: `${day.day}:${entry.kind}`,
        entry,
        first: index === 0,
        last: index === day.entries.length - 1,
      })),
    ]
  })
}
