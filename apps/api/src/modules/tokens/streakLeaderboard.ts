import {
  shiftDayKey,
  utcDayKey,
  wornCosmetic,
  type StreakLeaderboard,
  type StreakLeaderboardEntry,
  type StreakMetric,
} from '@langx/shared'
import type { Db, Filter } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import type { Profile } from '../profiles/profiles'
import { blockedUserIds } from '../moderation/blocks'
import { rankOf } from './leaderboard'

/**
 * The board ranked by days rather than tokens.
 *
 * Read straight off `profiles` — a streak is a property of the account today,
 * not something accumulated per period, so there is no aggregate to read and
 * no period to select.
 */
export async function getStreakLeaderboard(
  db: Db,
  viewerId: string,
  query: { metric: StreakMetric; limit: number },
  at: Date = new Date(),
): Promise<StreakLeaderboard> {
  const profiles = db.collection<Profile>(COLLECTIONS.profiles)
  const field = query.metric === 'current' ? 'streak.current' : 'streak.longest'

  const filter: Filter<Profile> = { deletedAt: { $exists: false } }
  if (query.metric === 'current') {
    /*
     * Liveness, and the board is meaningless without it. **Nothing decays
     * `streak.current`** — it is only ever written forwards, when a day is
     * credited — so somebody who last showed up in March still carries a 40 in
     * the field. Without this the "current" board is a list of ghosts, sorted
     * by how long ago they gave up.
     *
     * Yesterday counts, not just today: a streak is alive until the day after
     * its last qualified one has passed, and somebody who has not opened the
     * app yet today has not lost anything.
     *
     * UTC on purpose, and generous by up to a day for anyone far from it. The
     * page query and the rank count have to agree on who is on the board, and
     * a per-viewer timezone would make them disagree — two people would be
     * told different positions for the same streak.
     */
    filter['streak.current'] = { $gte: 1 }
    filter['streak.lastQualifiedDay'] = { $gte: shiftDayKey(utcDayKey(at), -1) }
  } else {
    filter['streak.longest'] = { $gte: 1 }
  }

  const top = await profiles
    .find(filter, {
      projection: {
        handle: 1,
        displayName: 1,
        avatarUrl: 1,
        streak: 1,
        cosmetics: 1,
        equipped: 1,
      },
    })
    // `_id` breaks ties deterministically, so repeat calls agree.
    .sort({ [field]: -1, _id: 1 })
    .limit(query.limit)
    .toArray()

  function daysOf(profile: Profile): number {
    return (query.metric === 'current' ? profile.streak?.current : profile.streak?.longest) ?? 0
  }

  // Blocked accounts drop out of the table but keep their place, so blocking
  // somebody does not promote you past them. Same rule as the token board.
  const hidden = new Set(await blockedUserIds(db, viewerId))

  const entries: StreakLeaderboardEntry[] = []
  let previous: { rank: number; days: number } | null = null
  for (const [index, profile] of top.entries()) {
    const days = daysOf(profile)
    const rank = rankOf(
      index,
      days,
      previous ? { rank: previous.rank, tokens: previous.days } : null,
    )
    previous = { rank, days }
    if (hidden.has(profile._id)) continue

    const entry: StreakLeaderboardEntry = {
      rank,
      userId: profile._id,
      handle: profile.handle,
      displayName: profile.displayName ?? profile.handle,
      streak: days,
      isViewer: profile._id === viewerId,
    }
    if (profile.avatarUrl !== undefined) entry.avatarUrl = profile.avatarUrl
    const frame = wornCosmetic(profile.equipped, profile.cosmetics ?? [], 'frame')
    const title = wornCosmetic(profile.equipped, profile.cosmetics ?? [], 'title')
    if (frame?.tone) entry.frame = frame.tone
    if (title) entry.title = title.id
    entries.push(entry)
  }

  /*
   * The viewer's own standing, counted the same way `rankOf` ranks — everyone
   * strictly above them, plus one — so a tie is told the same number whether
   * or not it made the page.
   *
   * `null` rather than a position when they are not on the board at all: no
   * streak, or a `current` one that has lapsed. A rank for a streak somebody
   * no longer has would be a number that quietly disagrees with the list it
   * sits under.
   */
  const viewer = await profiles.findOne(
    { _id: viewerId },
    { projection: { streak: 1, deletedAt: 1 } },
  )
  const viewerDays = viewer ? daysOf(viewer) : 0
  const onBoard =
    viewerDays > 0 &&
    (query.metric === 'longest' ||
      (viewer?.streak?.lastQualifiedDay ?? '') >= shiftDayKey(utcDayKey(at), -1))

  return {
    metric: query.metric,
    entries,
    viewer: {
      rank: onBoard
        ? (await profiles.countDocuments({ ...filter, [field]: { $gt: viewerDays } })) + 1
        : null,
      streak: viewerDays,
      inPage: entries.some((entry) => entry.isViewer),
    },
  }
}
