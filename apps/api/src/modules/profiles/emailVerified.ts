import type { Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import { authId } from '../../lib/authId'

/**
 * Whether Better Auth considers this account's email verified.
 *
 * Its own routes carry the flag on the session, but that is the *viewer's*
 * session — a profile being looked at has none here, so the only way to the
 * value is the `user` document, through `authId` like every other crossing of
 * the two id worlds. A string `_id` matches nothing and would report every
 * profile unverified without erroring.
 *
 * A leaf module rather than a function on `profiles.ts`, because that file
 * imports the referral repository and the referral repository needs this: a
 * runtime import cycle whose symptom is `undefined is not a function` at boot,
 * in whichever of the two happens to be evaluated second.
 */
export async function isEmailVerified(db: Db, userId: string): Promise<boolean> {
  const user = await db
    .collection(COLLECTIONS.user)
    .findOne({ _id: authId(userId) }, { projection: { emailVerified: 1 } })
  return user?.emailVerified === true
}
