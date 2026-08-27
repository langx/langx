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
import type { XpAggregate } from './ledger'

/**
 * Competition ranking over an already-sorted page: equal scores share a rank
 * and the next distinct score skips ahead (1, 2, 2, 4).
 *
 * This has to agree with how a viewer outside the page learns their rank —
 * `countDocuments({ xp: { $gt: mine } }) + 1` — or two people on the same
 * score would be told different positions depending on whether they made the
 * page. Positional ranking (index + 1) would do exactly that.
 */
function rankOf(index: number, xp: number, previous: { rank: number; xp: number } | null): number {
  if (previous && previous.xp === xp) return previous.rank
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

  const aggregates = db.collection<XpAggregate>(COLLECTIONS.xpAggregates)

  const top = await aggregates
    .find({ periodType, periodKey })
    // `_id` breaks ties deterministically, so paging and repeat calls agree.
    .sort({ xp: -1, _id: 1 })
    .limit(query.limit)
    .toArray()

  const profiles = await db
    .collection<Profile>(COLLECTIONS.profiles)
    .find(
      { _id: { $in: top.map((row) => row.userId) }, deletedAt: { $exists: false } },
      { projection: { handle: 1, displayName: 1, avatarUrl: 1, streak: 1 } },
    )
    .toArray()
  const byId = new Map(profiles.map((p) => [p._id, p]))

  const entries: LeaderboardEntry[] = []
  let previous: { rank: number; xp: number } | null = null
  for (const [index, row] of top.entries()) {
    // A soft-deleted account keeps its aggregate row (the ledger is
    // append-only) but must not appear. It still occupies its rank position,
    // so the ranks of everyone below don't shift when someone deletes.
    const profile = byId.get(row.userId)
    const rank = rankOf(index, row.xp, previous)
    previous = { rank, xp: row.xp }
    if (!profile) continue

    const entry: LeaderboardEntry = {
      rank,
      userId: row.userId,
      handle: profile.handle,
      displayName: profile.displayName ?? profile.handle,
      xp: row.xp,
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
  const viewerXp = viewerRow?.xp ?? 0
  const inPage = entries.some((e) => e.isViewer)
  const rank =
    viewerXp > 0
      ? (await aggregates.countDocuments({ periodType, periodKey, xp: { $gt: viewerXp } })) + 1
      : null

  return { period: periodType, periodKey, entries, viewer: { rank, xp: viewerXp, inPage } }
}
