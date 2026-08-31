import type { Db } from 'mongodb'
import { CURRENT_TERMS_VERSION } from '@langx/shared'
import { COLLECTIONS } from '../../db/collections'
import { authId } from '../../lib/authId'

/**
 * Records that this account accepted the terms, at creation.
 *
 * Written from the server rather than from anything the client sends. The
 * tickbox on the sign-up screen is what makes a person read the sentence; it
 * cannot also be the evidence, because a client that never rendered the screen
 * could assert it just as easily.
 *
 * The version travels with the timestamp. A date alone answers "when", and the
 * question actually asked later is "which text did they agree to" — which a
 * date can only answer if nobody ever loses the changelog.
 *
 * On the Better Auth `user` document, so it exists for every route into an
 * account including the social providers and the legacy bridge, and so it
 * survives a profile that is never completed. That means `authId` at the
 * boundary: these collections key on ObjectId while ours key on the string.
 */
export async function recordTermsAcceptance(db: Db, userId: string): Promise<void> {
  await db.collection(COLLECTIONS.user).updateOne(
    { _id: authId(userId) },
    {
      // `$setOnInsert` would be wrong and `$set` would be worse: this runs once
      // per account, and re-stamping on a later hook would quietly move the
      // date of a consent that was given earlier. `$setOnInsert` cannot be used
      // because the document already exists by the time the hook fires.
      $set: {
        terms: { acceptedAt: new Date(), version: CURRENT_TERMS_VERSION },
      },
    },
  )
}
