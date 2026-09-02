import type { Db, ObjectId } from 'mongodb'
import { GUEST_TTL_MS } from '@langx/shared'
import { COLLECTIONS } from '../../db/collections'
import { authId } from '../../lib/authId'
import type { Profile } from './profiles'

/**
 * Everything one guest owns, in one place.
 *
 * Both callers delete the same four things, and the list is the kind that goes
 * stale silently: a collection added here and forgotten there leaves half a
 * guest behind, which is how a deleted account keeps a live session.
 *
 * **The Better Auth rows go through `authId`.** Those collections key on
 * ObjectId while ours key on the string form, and a string filter against
 * `user` matches nothing and reports success — exactly the silent half-delete
 * the two-id-worlds note warns about.
 */
export async function deleteGuests(db: Db, userIds: string[]): Promise<void> {
  if (userIds.length === 0) return
  const authIds = userIds.map((id) => authId(id))

  // `guest: true` in the filter, not just the id: a real account must never be
  // reachable from here, whatever hands the ids in.
  await db
    .collection<Profile>(COLLECTIONS.profiles)
    .deleteMany({ _id: { $in: userIds }, guest: true })
  await Promise.all([
    db.collection(COLLECTIONS.session).deleteMany({ userId: { $in: authIds } }),
    db.collection(COLLECTIONS.account).deleteMany({ userId: { $in: authIds } }),
    db.collection(COLLECTIONS.user).deleteMany({ _id: { $in: authIds } }),
  ])
}

/** One guest, by id — what `DELETE /profiles/guest` ends up calling. */
export async function deleteGuest(db: Db, userId: string): Promise<void> {
  await deleteGuests(db, [userId])
}

/**
 * Deletes guest sessions that were never turned into accounts.
 *
 * They accumulate by design — most people who look around will never come
 * back. Without this, `profiles` and Better Auth's `user` fill with rows
 * nobody will ever read again.
 *
 * Driven by a timestamp rather than a lock, like the account purge: a guest
 * older than the cutoff is gone after the first pass and no longer matches, so
 * two instances racing simply both find nothing the second time.
 *
 * **Two queries, because a guest is not always a profile.** The profile row is
 * written the moment somebody picks two languages — so anyone who tapped "look
 * around" and closed the app before that has a Better Auth `user` and no
 * profile at all. Sweeping `profiles` alone left those users, their sessions
 * and their accounts behind for good; `isAnonymous` is what finds them.
 */
export async function purgeStaleGuests(
  db: Db,
  now: Date = new Date(),
): Promise<{ purged: number }> {
  const cutoff = new Date(now.getTime() - GUEST_TTL_MS)

  const [staleProfiles, staleUsers] = await Promise.all([
    db
      .collection<Profile>(COLLECTIONS.profiles)
      .find({ guest: true, createdAt: { $lte: cutoff } }, { projection: { _id: 1 } })
      .toArray(),
    db
      .collection<{ _id: ObjectId }>(COLLECTIONS.user)
      .find({ isAnonymous: true, createdAt: { $lte: cutoff } }, { projection: { _id: 1 } })
      .toArray(),
  ])

  // The two sets overlap for every guest that got as far as picking languages.
  const ids = [
    ...new Set([...staleProfiles.map((p) => p._id), ...staleUsers.map((u) => u._id.toHexString())]),
  ]
  if (ids.length === 0) return { purged: 0 }

  await deleteGuests(db, ids)
  return { purged: ids.length }
}
