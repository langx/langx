import type { Locale, TokenHistoryDay, TokenKind } from '@langx/shared'
import type { MessageKey, TranslateFn } from '../i18n/runtime'
import { dayLabel } from './messageGroups'

export interface HistoryEntry {
  kind: TokenKind
  label: string
  /** Signed as the ledger stores it, so a spend is negative. */
  amount: number
}

export interface HistoryRow {
  day: string
  /** "Today", "Yesterday", or the date, in the reader's language. */
  label: string
  earned: number
  spent: number
  entries: HistoryEntry[]
  /**
   * What the pool paid for this day, or null if it paid nothing. Pulled out of
   * `entries` as well as left in it: it is the one line the screen is expected
   * to answer without expanding a row.
   */
  poolShare: number | null
}

export interface TokenHistoryInput {
  days: readonly TokenHistoryDay[]
  /**
   * Passed in rather than reached for, so this stays a pure function the tests
   * can call without a React tree.
   */
  t: TranslateFn
  locale: Locale
  now?: Date
}

/**
 * The i18n key naming a ledger kind.
 *
 * Built from the kind rather than a lookup table so a new `TokenKind` is a
 * compile error in the catalogs (which are typed against `en.ts`) instead of a
 * row that silently renders its own identifier — the same trick `cosmeticKey`
 * uses in `storeOffers.ts`.
 */
export function kindKey(kind: TokenKind): MessageKey {
  return `tokenKind.${kind}` as MessageKey
}

/**
 * One row per day for the history list, newest first — the order the server
 * already returns, preserved rather than re-sorted.
 *
 * `dayLabel` compares against the device's day while the history's day keys
 * are UTC. Between midnight UTC and midnight local those disagree, and the
 * mismatch is deliberate: the token was earned on a UTC day, but "Today" is a
 * word about the reader, and a row headed "Yesterday" for something they did
 * an hour ago would be the more confusing of the two errors.
 */
export function buildTokenHistory({ days, t, locale, now }: TokenHistoryInput): HistoryRow[] {
  return days.map((day) => {
    const entries: HistoryEntry[] = day.breakdown.map((entry) => ({
      kind: entry.kind,
      label: t(kindKey(entry.kind)),
      amount: entry.amount,
    }))

    return {
      day: day.day,
      label: dayLabel(day.day, { t, locale, ...(now ? { now } : {}) }),
      earned: day.earned,
      spent: day.spent,
      entries,
      poolShare: day.breakdown.find((entry) => entry.kind === 'dailyPool')?.amount ?? null,
    }
  })
}
