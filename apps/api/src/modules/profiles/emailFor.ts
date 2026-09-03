import type { Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import { authId } from '../../lib/authId'

/**
 * The address to write to, and whether it has been proved.
 *
 * A leaf module beside `emailVerified.ts` and for the same reason: `profiles.ts`
 * imports the referral repository, the referral repository needs the user
 * document, and a function on `profiles.ts` would close that loop into an
 * import cycle whose symptom is `undefined is not a function` at boot.
 *
 * `authId` because the address lives in Better Auth's `user` collection, where
 * ids are ObjectId — a string matches nothing and would report every account
 * as having no email at all.
 *
 * Guests hold an address too, at a domain that resolves nowhere, and it is
 * never verified. Nothing here special-cases them: every caller sends only to
 * a verified address, which excludes them by the same rule that excludes
 * anyone who has not clicked their link.
 */
export async function emailFor(
  db: Db,
  userId: string,
): Promise<{ email: string; verified: boolean } | null> {
  const user = await db
    .collection<{ email?: string; emailVerified?: boolean }>(COLLECTIONS.user)
    .findOne({ _id: authId(userId) }, { projection: { email: 1, emailVerified: 1 } })
  if (!user?.email) return null
  return { email: user.email, verified: user.emailVerified === true }
}
