import { LINKED_PROVIDERS, type LinkedProvider, type SignInMethods } from '@langx/shared'
import type { Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import { authId } from '../../lib/authId'
import { emailFor } from '../profiles/emailFor'

/**
 * Better Auth's own name for an email-and-password account. It is a row in the
 * same `account` collection as the OAuth links, distinguished only by this
 * provider id, which is why "do they have a password" is a query rather than a
 * field on the user.
 */
const CREDENTIAL_PROVIDER = 'credential'

function isLinkedProvider(providerId: string): providerId is LinkedProvider {
  return (LINKED_PROVIDERS as readonly string[]).includes(providerId)
}

interface AccountRow {
  providerId?: string
  password?: string | null
  createdAt?: Date
}

/**
 * Every way back into one account.
 *
 * `authId` because `account` is Better Auth's collection and stores ids as
 * ObjectId — a string userId here matches nothing and would report a person
 * with three sign-in methods as having none, which on this screen reads as
 * "you are locked out" rather than as a bug. See lib/authId.ts.
 *
 * A `credential` row is only counted when it actually carries a hash: Better
 * Auth writes the row first and the password second in some flows, and a row
 * without one cannot be signed in with. Claiming otherwise would tell somebody
 * they have a password to fall back on when they do not.
 *
 * Providers the app does not offer are dropped rather than passed through, so
 * a stale row from a provider that was once enabled cannot reach a screen that
 * has no name for it.
 */
export async function getSignInMethods(
  db: Db,
  userId: string,
  handle: string,
): Promise<SignInMethods> {
  const rows = await db
    .collection<AccountRow>(COLLECTIONS.account)
    .find({ userId: authId(userId) }, { projection: { providerId: 1, password: 1, createdAt: 1 } })
    .toArray()

  const linked = rows
    .filter((row) => typeof row.providerId === 'string' && isLinkedProvider(row.providerId))
    .map((row) => ({
      provider: row.providerId as LinkedProvider,
      linkedAt: (row.createdAt ?? new Date(0)).toISOString(),
    }))
    // Oldest first, so the list does not reshuffle when a second provider is
    // added later.
    .sort((a, b) => a.linkedAt.localeCompare(b.linkedAt))

  return {
    hasPassword: rows.some(
      (row) => row.providerId === CREDENTIAL_PROVIDER && typeof row.password === 'string',
    ),
    email: (await emailFor(db, userId))?.email ?? '',
    handle,
    linked,
  }
}
