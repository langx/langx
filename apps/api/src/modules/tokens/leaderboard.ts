import {
  ERROR_CODES,
  aggregateId,
  periodKeys,
  type Leaderboard,
  type LeaderboardEntry,
  type PeriodType,
} from '@langx/shared'
import type { Db, Filter } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import { ApiError } from '../../lib/ApiError'
import type { Profile } from '../profiles/profiles'
import { blockedUserIds } from '../moderation/blocks'
import type { TokenAggregate } from './ledger'

/**
 * Competition ranking over an already-sorted page: equal scores share a rank
 * and the next distinct score skips ahead (1, 2, 2, 4).
 *
 * This has to agree with how a viewer outside the page learns their rank —
 * `countDocuments({ tokens: { $gt: mine } }) + 1` — or two people on the same
 * score would be told different positions depending on whether they made the
 * page. Positional ranking (index + 1) would do exactly that.
 */
function rankOf(
  index: number,
  tokens: number,
  previous: { rank: number; tokens: number } | null,
): number {
  if (previous && previous.tokens === tokens) return previous.rank
  return index + 1
}

/**
 * Cursor over `{tokens: -1, _id: 1}` — `<tokens>|<aggregateId>`.
 *
 * Not `dateIdCursor`: a `tokenAggregates` `_id` is the string
 * `<userId>:<periodType>:<periodKey>`, not an ObjectId. The `_id` tiebreak is
 * what the sort was already written for ("so paging and repeat calls agree").
 */
function encodeBoardCursor(tokens: number, id: string): string {
  return `${tokens}|${id}`
}

function decodeBoardCursor(cursor: string): { tokens: number; id: string } {
  const separator = cursor.indexOf('|')
  const tokens = Number.parseInt(cursor.slice(0, separator), 10)
  const id = cursor.slice(separator + 1)
  if (separator < 0 || !Number.isInteger(tokens) || !id) {
    throw new ApiError(ERROR_CODES.VALIDATION_FAILED, 'Malformed cursor')
  }
  return { tokens, id }
}

export async function getLeaderboard(
  db: Db,
  viewerId: string,
  query: {
    period: PeriodType
    periodKey?: string | undefined
    limit: number
    cursor?: string | undefined
  },
  at: Date = new Date(),
): Promise<Leaderboard> {
  const periodType = query.period
  const periodKey = query.periodKey ?? periodKeys(at)[periodType]

  const aggregates = db.collection<TokenAggregate>(COLLECTIONS.tokenAggregates)

  const filter: Filter<TokenAggregate> = { periodType, periodKey }
  if (query.cursor) {
    const { tokens, id } = decodeBoardCursor(query.cursor)
    filter.$or = [{ tokens: { $lt: tokens } }, { tokens, _id: { $gt: id } }]
  }

  const fetched = await aggregates
    .find(filter)
    // `_id` breaks ties deterministically, so paging and repeat calls agree.
    .sort({ tokens: -1, _id: 1 })
    // One extra to detect a next page without a second round trip.
    .limit(query.limit + 1)
    .toArray()

  const hasMore = fetched.length > query.limit
  const top = hasMore ? fetched.slice(0, query.limit) : fetched

  /**
   * Two different numbers about this page's first row, and conflating them is
   * the whole trap.
   *
   * `startIndex` is how many rows sort *before* it — the keyset itself, so
   * rows tied with it on the previous page are counted. `firstRank` is its
   * competition rank, which by definition ignores those ties. They coincide
   * only when the page begins at a new score, which is exactly why using one
   * for both passes in isolation and fails the moment a tie straddles a page
   * boundary: the row after the tie gets its positional index instead of
   * skipping past both halves.
   *
   * `firstRank` is the same expression the out-of-page viewer rank uses
   * below. That is the invariant this file exists to protect — two people on
   * the same score are told the same position whether or not they made the
   * page — and deriving both from one formula keeps it true by construction.
   */
  const first = top[0]
  // Annotated, and counted separately rather than destructured out of one
  // `Promise.all`: a tuple built by a ternary infers as `number[]`, which
  // under `noUncheckedIndexedAccess` makes both `number | undefined` and
  // takes `rank` below with it.
  let startIndex = 0
  let firstRank = 1
  if (first) {
    const [before, above] = await Promise.all([
      aggregates.countDocuments({
        periodType,
        periodKey,
        $or: [{ tokens: { $gt: first.tokens } }, { tokens: first.tokens, _id: { $lt: first._id } }],
      }),
      aggregates.countDocuments({ periodType, periodKey, tokens: { $gt: first.tokens } }),
    ])
    startIndex = before
    firstRank = above + 1
  }

  // Blocked either way, and the person drops out of the table — same rule as
  // discovery and the conversation list. Their rank position stays occupied,
  // so blocking someone does not promote you past them.
  const hidden = new Set(await blockedUserIds(db, viewerId))

  const profiles = await db
    .collection<Profile>(COLLECTIONS.profiles)
    .find(
      { _id: { $in: top.map((row) => row.userId) }, deletedAt: { $exists: false } },
      { projection: { handle: 1, displayName: 1, avatarUrl: 1, streak: 1 } },
    )
    .toArray()
  const byId = new Map(profiles.map((p) => [p._id, p]))

  const entries: LeaderboardEntry[] = []
  let previous: { rank: number; tokens: number } | null = null
  for (const [index, row] of top.entries()) {
    const absoluteIndex = startIndex + index
    // A soft-deleted account keeps its aggregate row (the ledger is
    // append-only) but must not appear. It still occupies its rank position,
    // so the ranks of everyone below don't shift when someone deletes.
    const profile = byId.get(row.userId)
    // The page's first row takes its competition rank directly; it may be
    // mid-tie, and `previous` is empty at a page boundary.
    const rank: number = index === 0 ? firstRank : rankOf(absoluteIndex, row.tokens, previous)
    previous = { rank, tokens: row.tokens }
    if (!profile || hidden.has(row.userId)) continue

    const entry: LeaderboardEntry = {
      rank,
      userId: row.userId,
      handle: profile.handle,
      displayName: profile.displayName ?? profile.handle,
      tokens: row.tokens,
      // Read defensively. A single profile document missing `streak` — an
      // ETL-imported row, a partially written one — must not be able to 500
      // a global endpoint for every user on the board.
      streak: profile.streak?.current ?? 0,
      isViewer: row.userId === viewerId,
    }
    if (profile.avatarUrl !== undefined) entry.avatarUrl = profile.avatarUrl
    entries.push(entry)
  }

  const viewerRow = await aggregates.findOne({
    _id: aggregateId(viewerId, periodType, periodKey),
  })
  const viewerXp = viewerRow?.tokens ?? 0
  const inPage = entries.some((e) => e.isViewer)
  const rank =
    viewerXp > 0
      ? (await aggregates.countDocuments({ periodType, periodKey, tokens: { $gt: viewerXp } })) + 1
      : null

  const lastRow = top.at(-1)
  return {
    period: periodType,
    periodKey,
    entries,
    // Off the raw page: a soft-deleted account is dropped from `entries` but
    // still occupied a place, so cursoring from the last rendered row would
    // replay it.
    nextCursor: hasMore && lastRow ? encodeBoardCursor(lastRow.tokens, lastRow._id) : null,
    viewer: { rank, tokens: viewerXp, inPage },
  }
}
