import { createHmac } from 'node:crypto'
import { SIGN_UP_RULES } from '@langx/shared'
import type { Db, ObjectId } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'

interface SignUpByIp {
  _id?: ObjectId
  /** `networkHash` of the address — never the address itself. */
  network: string
  at: Date
}

/**
 * What a network is stored as: an HMAC of its key under a server secret.
 *
 * Keyed rather than a bare SHA-256 because the IPv4 space is small enough to
 * hash end to end in minutes, which would make a plain hash the address with
 * one extra step. The key is `BETTER_AUTH_SECRET`, which every deployment
 * already has, under a label of its own so the value means nothing anywhere
 * else. Rotating that secret only resets a day of counts.
 */
export function networkHash(network: string, secret: string): string {
  return createHmac('sha256', secret).update(`sign-up-network:${network}`).digest('base64url')
}

/**
 * Takes one of this network's sign-up slots for the window, or answers `false`
 * when they are all taken.
 *
 * Insert first, count second, and give the row back on a refusal. A read
 * followed by a write would let two sign-ups racing on the last slot both
 * see room; this way both see the other's row, the count is over for at least
 * one of them, and the worst a race can do is refuse a sign-up that would
 * have fit — never let one through that did not.
 *
 * The row goes in before the account does and is not taken back if the
 * account then fails for some other reason. That costs a slot for a sign-up
 * that never happened, which the window returns a day later.
 */
export async function claimSignUpSlot(
  db: Db,
  network: string,
  now: Date = new Date(),
): Promise<boolean> {
  const rows = db.collection<SignUpByIp>(COLLECTIONS.signUpsByIp)
  const { insertedId } = await rows.insertOne({ network, at: now })
  const since = new Date(now.getTime() - SIGN_UP_RULES.windowMs)
  const taken = await rows.countDocuments({ network, at: { $gt: since } })
  if (taken <= SIGN_UP_RULES.accountsPerIp) return true
  await rows.deleteOne({ _id: insertedId })
  return false
}
