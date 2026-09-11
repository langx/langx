import { HANDLE_SEARCH_LIMIT, type HandleSearchPage } from '@langx/shared'
import type { Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import { blockedUserIds } from '../moderation/blocks'
import { notSuspended } from '../moderation/suspension'
import { nameTokens } from '../profiles/nameTokens'
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
 * Find someone by the start of their username, or by the start of any word in
 * their name.
 *
 * **Anchored, always, on both halves.** `^term` rides an index — `handle` on
 * `handle_unique`, `nameTokens` on `name_tokens` — while an unanchored
 * `/term/` cannot, and would turn a search box into a collection scan per
 * keystroke. That is also the whole reason the name half matches a *derived*
 * token array rather than `displayName` itself: a case-insensitive regex over
 * free text is unindexable however it is written. See `nameTokens`.
 *
 * The two halves are one `$or` rather than two queries, so the ten results are
 * ranked together instead of one half crowding out the other. Both branches
 * are indexed, which is what keeps that an index scan; unindex either and the
 * planner quietly falls back to scanning everybody. `discovery.test.ts` pins
 * it with an `explain()`.
 *
 * A multi-word term is an `$and` across the tokens — "ada lo" wants somebody
 * with a word starting "ada" *and* a word starting "lo", which is what typing
 * a full name means. `$all` of no tokens matches nobody, which is the right
 * answer for a term that is all punctuation.
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
 *     The one exception is an official account, which is undiscoverable and
 *     searchable at once — see the filter.
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
  // Already letters and digits only — `nameTokens` breaks on everything else —
  // so the escape is belt and braces rather than the load-bearing one above.
  const wordPrefixes = nameTokens(term).map((token) => new RegExp(`^${escapeRegex(token)}`))

  const rows = await db
    .collection<Profile>(COLLECTIONS.profiles)
    .find(
      {
        _id: { $nin: excludedIds },
        /*
         * Two `$or`s, so they have to sit under an explicit `$and` — a second
         * `$or` key in the same object replaces the first, and the one that
         * would have been lost here is the visibility rule.
         */
        $and: [
          {
            $or: [
              { handle: { $regex: `^${escapeRegex(term)}` } },
              { nameTokens: { $all: wordPrefixes } },
            ],
          },
          /*
           * An official account is not discoverable — it must never be proposed
           * as a partner — but it must be findable, because typing the name is
           * how somebody reaches the assistant at all. Searching for a name you
           * already know is the one case where "do not browse me" and "do not
           * exist" come apart.
           */
          { $or: [{ 'settings.discoverable': true }, { official: true }] },
        ],
        // Belt and braces. `discoverable: false` already excludes them, but a
        // guest surfacing in somebody's results is the single worst failure of
        // this feature, and one flag flipped by a future default should not be
        // all that stands between here and there.
        guest: { $exists: false },
        deletedAt: { $exists: false },
        // Searching is browsing, and a suspended account is not browsable.
        ...notSuspended(),
      },
      {
        projection: { handle: 1, displayName: 1, avatarUrl: 1, official: 1 },
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
      ...(row.official ? { official: true as const } : {}),
    })),
  }
}
