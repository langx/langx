import {
  aggregateId,
  periodKeys,
  type Leaderboard,
  type LeaderboardEntry,
  type PeriodType,
} from '@langx/shared'
import type { Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
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

export async function getLeaderboard(
  db: Db,
  viewerId: string,
  query: { period: PeriodType; periodKey?: string | undefined; limit: number },
  at: Date = new Date(),
): Promise<Leaderboard> {
  const periodType = query.period
  const periodKey = query.periodKey ?? periodKeys(at)[periodType]

  const aggregates = db.collection<TokenAggregate>(COLLECTIONS.tokenAggregates)

  const top = await aggregates
    .find({ periodType, periodKey })
    // `_id` breaks ties deterministically, so paging and repeat calls agree.
    .sort({ tokens: -1, _id: 1 })
    .limit(query.limit)
    .toArray()

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
    // A soft-deleted account keeps its aggregate row (the ledger is
    // append-only) but must not appear. It still occupies its rank position,
    // so the ranks of everyone below don't shift when someone deletes.
    const profile = byId.get(row.userId)
    const rank = rankOf(index, row.tokens, previous)
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

  return { period: periodType, periodKey, entries, viewer: { rank, tokens: viewerXp, inPage } }
}
