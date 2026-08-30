import {
  TOKEN_HISTORY_PAGE_DAYS,
  type TokenHistory,
  type TokenHistoryDay,
  type TokenKind,
} from '@langx/shared'
import type { Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import type { TokenLedgerEntry } from './ledger'

/** Shape after the *second* `$group`: one row per day, `_id` being the day key. */
interface HistoryRow {
  _id: string
  breakdown: { kind: TokenKind; amount: number }[]
}

/**
 * One user's token history, a day at a time, newest first.
 *
 * Read from `tokenLedger` rather than `tokenAggregates`: the aggregates are
 * period totals with no per-kind detail and no day bucket at all, and the whole
 * point of this screen is the detail — "where did today's 312 come from, and
 * how much of it was the pool". The ledger is append-only, so it is also the
 * only thing that can answer that question about a day in the past.
 *
 * **A pool share is filed under the day it rewards, not the day it landed.**
 * `awardTokens` stamps `day` from the award instant and the pool's instant is
 * `dayCloseAt(D)` — midnight *after* D — so a pool row for Monday carries
 * `day: Tuesday` and `refId: Monday`. Grouping on the raw `day` would show
 * every share against the wrong date and, worse, against a date the user may
 * have been asleep for. The `$cond` below is `earnedDayOf` expressed in the
 * pipeline; the two are tested against each other.
 */
export async function getTokenHistory(
  db: Db,
  userId: string,
  options: { before?: string; limit?: number } = {},
): Promise<TokenHistory> {
  const limit = options.limit ?? TOKEN_HISTORY_PAGE_DAYS

  const earnedDay = {
    $cond: [
      { $and: [{ $eq: ['$kind', 'dailyPool'] }, { $ne: ['$refId', null] }] },
      '$refId',
      '$day',
    ],
  }

  const rows = await db
    .collection<TokenLedgerEntry>(COLLECTIONS.tokenLedger)
    .aggregate<HistoryRow>([
      /*
       * Two filters for one bound, and the first is the point. `before` is a
       * bound on the *earned* day, which only exists after the `$project`
       * below — so filtering on it alone would read the user's entire ledger
       * on every page. A pool row's earned day is exactly one behind its
       * stored `day` and every other kind's is equal to it, so `day <= before`
       * is a safe superset of `earnedDay < before`: it can never drop a row
       * the exact filter would keep. It is also indexed (`user_day`), which
       * is what bounds the scan to the page.
       */
      { $match: { userId, ...(options.before ? { day: { $lte: options.before } } : {}) } },
      { $project: { kind: 1, amount: 1, day: earnedDay } },
      ...(options.before ? [{ $match: { day: { $lt: options.before } } }] : []),
      { $group: { _id: { day: '$day', kind: '$kind' }, amount: { $sum: '$amount' } } },
      // Descending by day, then by kind so a day's rows come back in a stable
      // order — two kinds with equal totals must not swap places between reads.
      { $sort: { '_id.day': -1, '_id.kind': 1 } },
      /*
       * Grouped a second time so `$limit` counts *days*, not rows. Limiting
       * before this would cut a day in half at the page boundary and the
       * client would render a day whose total is missing its last kind.
       */
      {
        $group: { _id: '$_id.day', breakdown: { $push: { kind: '$_id.kind', amount: '$amount' } } },
      },
      { $sort: { _id: -1 } },
      // One more than the page, so the presence of an extra day is what says
      // there is a next page — no second count query, and no cursor that
      // dead-ends on a page that happened to be exactly full.
      { $limit: limit + 1 },
    ])
    .toArray()

  const page = rows.slice(0, limit)
  const days: TokenHistoryDay[] = page.map(({ _id, breakdown }) => ({
    day: _id,
    earned: breakdown.reduce((sum, e) => (e.amount > 0 ? sum + e.amount : sum), 0),
    // Positive for display: the ledger stores a spend as negative, but
    // "spent 200" is what the screen says.
    spent: breakdown.reduce((sum, e) => (e.amount < 0 ? sum - e.amount : sum), 0),
    breakdown,
  }))

  return {
    days,
    nextCursor: rows.length > limit ? (page[page.length - 1]?._id ?? null) : null,
  }
}
