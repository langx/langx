import {
  DEFAULT_AVATAR_POOL_SIZE,
  ERROR_CODES,
  defaultAvatarRev,
  hashFallback,
  hashGround,
  pickLeastUsed,
  poolFor,
  type DefaultAvatar,
  type PickDefaultAvatarInput,
} from '@langx/shared'
import type { Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import { ApiError } from '../../lib/ApiError'
import type { Profile } from './profiles'

/**
 * How far back "least used" looks. Recent sign-ups are who a newcomer meets
 * first — in discovery's newest-first lists, in the same welcome wave — so
 * spreading over them is what keeps two people from meeting the same face;
 * older profiles have long since spread out by hash.
 */
const RECENT_WINDOW = 500

/**
 * Which drawn face a profile wears, for the faces route: the stored one, or
 * the hash of its id in its gender's pool. An id nobody holds gets the hash
 * in the neutral pool, so the route never has to answer "not found".
 */
export async function getDefaultAvatarFor(db: Db, profileId: string): Promise<DefaultAvatar> {
  const row = await db
    .collection<Profile>(COLLECTIONS.profiles)
    .findOne({ _id: profileId }, { projection: { defaultAvatar: 1, gender: 1 } })
  return row?.defaultAvatar ?? hashFallback(profileId, row?.gender)
}

/**
 * The `?v=` token for a profile shown to others, or undefined when it has a
 * photo or is an official account (which wears its own art). A profile that
 * was never assigned one still gets a token — its hash face — so clients can
 * always cache the picture as immutable.
 */
export function defaultAvatarRevFor(
  profile: Pick<Profile, '_id' | 'gender' | 'avatarUrl' | 'defaultAvatar' | 'official'>,
): string | undefined {
  if (profile.avatarUrl || profile.official) return undefined
  return defaultAvatarRev(profile.defaultAvatar ?? hashFallback(profile._id, profile.gender))
}

/**
 * Gives a profile its face, once: the least used in its pool among the last
 * `RECENT_WINDOW` profiles, on the ground its id hashes to.
 *
 * Walks `_id` backwards rather than asking for the pool, because `_id` is
 * already indexed and the pool is not — and the field gets no index of its
 * own for one read per sign-up. 500 short documents is a bounded cost.
 *
 * Conditional on there being no assignment yet, so a retried sign-up or a
 * restore that runs after onboarding cannot reshuffle a face somebody has
 * already been seen wearing. Official accounts and guests are skipped.
 */
export async function assignDefaultAvatar(
  db: Db,
  profileId: string,
): Promise<DefaultAvatar | null> {
  const profiles = db.collection<Profile>(COLLECTIONS.profiles)
  const self = await profiles.findOne(
    { _id: profileId },
    { projection: { gender: 1, official: 1, guest: 1, defaultAvatar: 1 } },
  )
  if (!self || self.official || self.guest) return null
  if (self.defaultAvatar) return self.defaultAvatar

  const pool = poolFor(self.gender)
  const recent = await profiles
    .find(
      { _id: { $ne: profileId } },
      { projection: { 'defaultAvatar.pool': 1, 'defaultAvatar.index': 1 } },
    )
    .sort({ _id: -1 })
    .limit(RECENT_WINDOW)
    .toArray()
  const counts = new Array<number>(DEFAULT_AVATAR_POOL_SIZE).fill(0)
  for (const row of recent) {
    const worn = row.defaultAvatar
    if (worn?.pool === pool && worn.index >= 1 && worn.index <= DEFAULT_AVATAR_POOL_SIZE) {
      counts[worn.index - 1] = (counts[worn.index - 1] ?? 0) + 1
    }
  }

  const avatar: DefaultAvatar = {
    pool,
    index: pickLeastUsed(counts, profileId),
    ground: hashGround(profileId),
  }
  const written = await profiles.findOneAndUpdate(
    { _id: profileId, defaultAvatar: { $exists: false } },
    { $set: { defaultAvatar: avatar } },
    { returnDocument: 'after', projection: { defaultAvatar: 1 } },
  )
  // Lost a race with another writer: theirs stands.
  if (!written) {
    const now = await profiles.findOne({ _id: profileId }, { projection: { defaultAvatar: 1 } })
    return now?.defaultAvatar ?? null
  }
  return written.defaultAvatar ?? avatar
}

/**
 * After a gender change: an assigned face moves to the new pool and keeps
 * its index and ground, so the person still looks like themselves, drawn
 * from the other set. A face they picked is theirs and does not move. With
 * nothing stored there is nothing to do — the hash face follows the gender
 * by itself.
 */
export async function onGenderChange(
  db: Db,
  profileId: string,
  gender: unknown,
): Promise<DefaultAvatar | null> {
  const updated = await db
    .collection<Profile>(COLLECTIONS.profiles)
    .findOneAndUpdate(
      { _id: profileId, defaultAvatar: { $exists: true }, 'defaultAvatar.picked': { $ne: true } },
      { $set: { 'defaultAvatar.pool': poolFor(gender) } },
      { returnDocument: 'after', projection: { defaultAvatar: 1 } },
    )
  return updated?.defaultAvatar ?? null
}

/**
 * The person chose a face. Any pool; kept through a gender change. The
 * ground stays whatever it was, so choosing a face does not also repaint it.
 */
export async function pickDefaultAvatar(
  db: Db,
  profileId: string,
  input: PickDefaultAvatarInput,
): Promise<DefaultAvatar> {
  const profiles = db.collection<Profile>(COLLECTIONS.profiles)
  const current = await profiles.findOne(
    { _id: profileId },
    { projection: { defaultAvatar: 1, official: 1, guest: 1 } },
  )
  if (!current || current.guest) throw new ApiError(ERROR_CODES.NOT_FOUND, 'Profile not found')
  if (current.official) {
    throw new ApiError(ERROR_CODES.FORBIDDEN, 'Official accounts wear their own picture')
  }
  const avatar: DefaultAvatar = {
    pool: input.pool,
    index: input.index,
    ground: current.defaultAvatar?.ground ?? hashGround(profileId),
    picked: true,
  }
  await profiles.updateOne(
    { _id: profileId },
    { $set: { defaultAvatar: avatar, updatedAt: new Date() } },
  )
  return avatar
}
