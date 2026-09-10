import type { Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'

/**
 * The devices an account has signed in from, so a sign-in from a new one can
 * be told apart from the ordinary kind.
 *
 * Not read off `session`: those rows expire in a week, so a person who signs
 * in every fortnight would be told every fortnight that their own phone was
 * new — which is how a security mail becomes the one people filter away. This
 * has no TTL, because "we have seen this device before" does not stop being
 * true.
 *
 * The `_id` carries the uniqueness, so the insert failing **is** the check:
 * two sign-ins racing each other produce one mail, not two.
 */
export interface KnownDevice {
  /** `<userId>:<fingerprint>` */
  _id: string
  userId: string
  fingerprint: string
  /** Read back by nothing yet; here so the row can answer "since when". */
  firstSeenAt: Date
  lastSeenAt: Date
  /** The last country this device was seen from, when the edge said. */
  country?: string
}

/**
 * Records the device and answers whether it had been seen before.
 *
 * `true` means new — mail them. The very first device on a brand-new account
 * is new too, and the caller is what decides not to write about it: somebody
 * who just signed up does not need to be told they signed in.
 */
export async function claimNewDevice(
  db: Db,
  userId: string,
  fingerprint: string,
  options: { country?: string; at?: Date } = {},
): Promise<boolean> {
  const at = options.at ?? new Date()
  const result = await db.collection<KnownDevice>(COLLECTIONS.knownDevices).updateOne(
    { _id: `${userId}:${fingerprint}` },
    {
      $set: { lastSeenAt: at, ...(options.country ? { country: options.country } : {}) },
      $setOnInsert: { userId, fingerprint, firstSeenAt: at },
    },
    { upsert: true },
  )
  return result.upsertedCount > 0
}

/** Everything this account has signed in from. For the purge to delete. */
export async function forgetDevices(db: Db, userId: string): Promise<void> {
  await db.collection<KnownDevice>(COLLECTIONS.knownDevices).deleteMany({ userId })
}
