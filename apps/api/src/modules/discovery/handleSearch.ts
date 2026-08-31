import { HANDLE_SEARCH_LIMIT, type HandleSearchPage } from '@langx/shared'
import type { Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import { blockedUserIds } from '../moderation/blocks'
import type { Profile } from '../profiles/profiles'

/**
 * Escapes a user string before it reaches `$regex`.
 *
 * Without it a handle search is a way to hand Mongo a pattern: `.*` scans the
 * collection, and a nested quantifier is a request the server spends real time
 * failing to match. `handleSchema` bounds what a stored handle may contain but
 * says nothing about what somebody may *type*.
 */
function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Find someone by the start of their handle.
 *
 * **Anchored, always.** `^term` rides the `handle_unique` btree index; an
 * unanchored `/term/` cannot, and would turn a search box into a collection
 * scan per keystroke. Handles are stored lower-cased by `handleSchema`, so the
 * query lower-cases too rather than asking for a case-insensitive regex, which
 * would also give up the index.
 *
 * The rules it shares with discovery, and the two it does not:
 *
 *   - `blockedUserIds` is two-sided and applies here as everywhere else. A
 *     blocked user is **absent**, never refused — a 403 would confirm the
 *     account exists, which is what blocking is meant to stop.
 *   - `settings.discoverable` applies, because searching is browsing. Somebody
 *     who has opted out of being found is still reachable by their exact link;
 *     that is `GET /profiles/:handleOrId`, deliberately, and it is a different
 *     question from this one.
 *   - Mutual language fit does **not** apply. Discovery requires it because it
 *     is proposing partners; finding somebody whose name you already know
 *     cannot depend on whether you happen to be learnable to each other.
 */
export async function searchHandles(
  db: Db,
  viewerId: string,
  term: string,
): Promise<HandleSearchPage> {
  const excludedIds = [viewerId, ...(await blockedUserIds(db, viewerId))]

  const rows = await db
    .collection<Profile>(COLLECTIONS.profiles)
    .find(
      {
        _id: { $nin: excludedIds },
        handle: { $regex: `^${escapeRegex(term)}` },
        'settings.discoverable': true,
        // Belt and braces. `discoverable: false` already excludes them, but a
        // guest surfacing in somebody's results is the single worst failure of
        // this feature, and one flag flipped by a future default should not be
        // all that stands between here and there.
        guest: { $exists: false },
        deletedAt: { $exists: false },
      },
      {
        projection: { handle: 1, displayName: 1, avatarUrl: 1 },
        // Alphabetical, so the shortest match — the one most likely to be the
        // handle actually being typed — leads.
        sort: { handle: 1 },
        limit: HANDLE_SEARCH_LIMIT,
      },
    )
    .toArray()

  return {
    items: rows.map((row) => ({
      _id: row._id,
      handle: row.handle,
      displayName: row.displayName,
      ...(row.avatarUrl ? { avatarUrl: row.avatarUrl } : {}),
    })),
  }
}
