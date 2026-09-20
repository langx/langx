import {
  aggregateId,
  periodKeys,
  wornCosmetic,
  type EchoLeaderboard,
  type EchoLeaderboardEntry,
  type PeriodType,
} from '@langx/shared'
import type { Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import type { Profile } from '../profiles/profiles'
import { blockedUserIds } from '../moderation/blocks'
import { rankOf } from '../tokens/leaderboard'
import type { EchoAggregate } from './documents'

/**
 * The board ranked by cards answered in a period.
 *
 * `getLeaderboard`'s twin, minus the cursor: this board is a page of fifty
 * inside a screen it does not own, so there is nothing to page — and without
 * a cursor the rank of the page's first row is simply 1, which is the whole
 * paragraph the token board needs about ties straddling a boundary.
 *
 * Read off `echoAggregates` rather than counted from `echoReviews`, for the
 * reason written beside that collection: the rows are one per graded card and
 * never removed, so a `$group` over them is a collection scan on a screen
 * anybody can open.
 */
export async function getEchoLeaderboard(
  db: Db,
  viewerId: string,
  query: { period: PeriodType; periodKey?: string | undefined; limit: number },
  at: Date = new Date(),
): Promise<EchoLeaderboard> {
  const periodType = query.period
  const periodKey = query.periodKey ?? periodKeys(at)[periodType]
  const aggregates = db.collection<EchoAggregate>(COLLECTIONS.echoAggregates)

  const top = await aggregates
    .find({ periodType, periodKey })
    // `_id` breaks ties deterministically, so repeat calls agree.
    .sort({ reviews: -1, _id: 1 })
    .limit(query.limit)
    .toArray()

  // Blocked accounts drop out of the table but keep their place, so blocking
  // somebody does not promote you past them. Same rule as the other boards.
  const hidden = new Set(await blockedUserIds(db, viewerId))

  const profiles = await db
    .collection<Profile>(COLLECTIONS.profiles)
    .find(
      { _id: { $in: top.map((row) => row.userId) }, deletedAt: { $exists: false } },
      { projection: { handle: 1, displayName: 1, avatarUrl: 1, cosmetics: 1, equipped: 1 } },
    )
    .toArray()
  const byId = new Map(profiles.map((profile) => [profile._id, profile]))

  const entries: EchoLeaderboardEntry[] = []
  let previous: { rank: number; reviews: number } | null = null
  for (const [index, row] of top.entries()) {
    const rank = rankOf(
      index,
      row.reviews,
      previous ? { rank: previous.rank, tokens: previous.reviews } : null,
    )
    previous = { rank, reviews: row.reviews }
    // A deleted account keeps its counters — nothing sweeps them the instant
    // the profile goes — but must not appear. It still occupies its place, so
    // the ranks below it do not shift when somebody leaves.
    const profile = byId.get(row.userId)
    if (!profile || hidden.has(row.userId)) continue

    const entry: EchoLeaderboardEntry = {
      rank,
      userId: row.userId,
      handle: profile.handle,
      displayName: profile.displayName ?? profile.handle,
      reviews: row.reviews,
      isViewer: row.userId === viewerId,
    }
    if (profile.avatarUrl !== undefined) entry.avatarUrl = profile.avatarUrl
    const frame = wornCosmetic(profile.equipped, profile.cosmetics ?? [], 'frame')
    const title = wornCosmetic(profile.equipped, profile.cosmetics ?? [], 'title')
    if (frame?.tone) entry.frame = frame.tone
    if (title) entry.title = title.id
    entries.push(entry)
  }

  /*
   * The viewer's own standing, counted the way `rankOf` ranks — everyone
   * strictly above them, plus one — so a tie is told the same number whether
   * or not it made the page.
   */
  const viewerRow = await aggregates.findOne({ _id: aggregateId(viewerId, periodType, periodKey) })
  const reviews = viewerRow?.reviews ?? 0

  return {
    period: periodType,
    periodKey,
    entries,
    viewer: {
      rank:
        reviews > 0
          ? (await aggregates.countDocuments({
              periodType,
              periodKey,
              reviews: { $gt: reviews },
            })) + 1
          : null,
      reviews,
      inPage: entries.some((entry) => entry.isViewer),
    },
  }
}
