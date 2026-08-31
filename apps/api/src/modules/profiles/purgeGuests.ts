import type { Db } from 'mongodb'
import { GUEST_TTL_MS } from '@langx/shared'
import { COLLECTIONS } from '../../db/collections'
import { authId } from '../../lib/authId'
import type { Profile } from './profiles'

/**
 * Deletes guest sessions that were never turned into accounts.
 *
 * They accumulate by design — a guest row is written the moment somebody picks
 * two languages, and most of those people will never come back. Without this,
 * `profiles` fills with rows nobody will ever read again.
 *
 * Driven by a timestamp rather than a lock, like the account purge: a guest
 * older than the cutoff is gone after the first pass and no longer matches, so
 * two instances racing simply both find nothing the second time.
 *
 * **The Better Auth rows go through `authId`.** Those collections key on
 * ObjectId while ours key on the string form, and a string filter against
 * `user` matches nothing and reports success — which would leave the account
 * and the session behind while the profile disappeared, i.e. exactly the
 * silent half-delete the two-id-worlds note warns about.
 */
export async function purgeStaleGuests(
  db: Db,
  now: Date = new Date(),
): Promise<{ purged: number }> {
  const cutoff = new Date(now.getTime() - GUEST_TTL_MS)
  const profiles = db.collection<Profile>(COLLECTIONS.profiles)

  const stale = await profiles
    .find({ guest: true, createdAt: { $lte: cutoff } }, { projection: { _id: 1 } })
    .toArray()
  if (stale.length === 0) return { purged: 0 }

  const ids = stale.map((p) => p._id)
  const authIds = ids.map((id) => authId(id))

  await profiles.deleteMany({ _id: { $in: ids }, guest: true })
  await Promise.all([
    db.collection(COLLECTIONS.session).deleteMany({ userId: { $in: authIds } }),
    db.collection(COLLECTIONS.account).deleteMany({ userId: { $in: authIds } }),
    db.collection(COLLECTIONS.user).deleteMany({ _id: { $in: authIds } }),
  ])

  return { purged: ids.length }
}
