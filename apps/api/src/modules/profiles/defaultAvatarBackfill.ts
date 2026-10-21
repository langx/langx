import {
  DEFAULT_AVATAR_POOL_SIZE,
  hashGround,
  pickLeastUsed,
  poolFor,
  type DefaultAvatar,
  type DefaultAvatarPool,
} from '@langx/shared'
import type { AnyBulkWriteOperation, Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import type { Profile } from './profiles'

/** Same window `assignDefaultAvatar` looks back over. */
const RECENT_WINDOW = 500

export interface BackfillReport {
  /** Live, non-official, non-guest profiles walked. */
  scanned: number
  /** Of those, how many had neither a photo nor an assignment. */
  missing: number
  /** Faces in each pool that the run assigns, by index, for the spread. */
  spread: Record<DefaultAvatarPool, number[]>
  written: number
}

/**
 * Gives every photoless profile without one a stored face, in creation
 * order, exactly as `assignDefaultAvatar` would have at its sign-up: the
 * least used in its pool over the 500 profiles before it.
 *
 * Not required — a profile without the field wears its hash face — but it
 * evens out the faces of the accounts that signed up before this existed,
 * which by hash alone bunch the way any 48-way hash of a few thousand ids
 * does.
 *
 * Idempotent: a profile that has a face is counted and never rewritten, so a
 * second run writes nothing. Writes only with `apply`.
 */
export async function backfillDefaultAvatars(
  db: Db,
  { apply }: { apply: boolean },
): Promise<BackfillReport> {
  const profiles = db.collection<Profile>(COLLECTIONS.profiles)
  const rows = await profiles
    .find(
      { deletedAt: { $exists: false }, official: { $exists: false }, guest: { $exists: false } },
      { projection: { gender: 1, avatarUrl: 1, defaultAvatar: 1 } },
    )
    .sort({ _id: 1 })
    .toArray()

  const empty = () => new Array<number>(DEFAULT_AVATAR_POOL_SIZE).fill(0)
  const spread: BackfillReport['spread'] = { W: empty(), M: empty(), N: empty() }
  const recent: (DefaultAvatar | undefined)[] = []
  const writes: AnyBulkWriteOperation<Profile>[] = []

  for (const row of rows) {
    let worn = row.defaultAvatar
    if (!worn && !row.avatarUrl) {
      const pool = poolFor(row.gender)
      const counts = empty()
      for (const other of recent) {
        if (other?.pool === pool) counts[other.index - 1] = (counts[other.index - 1] ?? 0) + 1
      }
      worn = { pool, index: pickLeastUsed(counts, row._id), ground: hashGround(row._id) }
      spread[pool][worn.index - 1] = (spread[pool][worn.index - 1] ?? 0) + 1
      writes.push({
        updateOne: {
          // The same guard as the sign-up path: never over a face that
          // arrived between this read and this write.
          filter: { _id: row._id, defaultAvatar: { $exists: false } },
          update: { $set: { defaultAvatar: worn } },
        },
      })
    }
    recent.push(worn)
    if (recent.length > RECENT_WINDOW) recent.shift()
  }

  let written = 0
  if (apply && writes.length > 0) {
    // Unordered, so one profile that fails does not stop the rest.
    written = (await profiles.bulkWrite(writes, { ordered: false })).modifiedCount
  }
  return { scanned: rows.length, missing: writes.length, spread, written }
}
