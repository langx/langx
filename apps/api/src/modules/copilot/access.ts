import type { AdminCopilotAccessRow } from '@langx/shared'
import type { Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import type { Profile } from '../profiles/profiles'

/** How many allowed accounts the operator panel lists at once. */
const LIST_LIMIT = 200

/**
 * Whether the operator has allowed this account to use Copilot.
 *
 * The per-account switch, on top of `flags.copilotEnabled` and a key: while
 * Copilot is tried by a few people, the flag being on must not mean it is on
 * for everybody. `admin: true` grants nothing here — an operator who wants
 * to try it allows themselves, so the list is the whole answer to "who can
 * reach the model".
 */
export function hasCopilotAccess(profile: Pick<Profile, 'copilotAccess'>): boolean {
  return profile.copilotAccess !== undefined
}

/**
 * Allows an account, or takes it back. Returns `false` when there is no such
 * profile, so the route can say so rather than audit a switch on nobody.
 *
 * Allowing an account that already is keeps the first date: the row says
 * when the person started, not when somebody last pressed the switch.
 *
 * Taking access back takes the consent with it. While an account is off the
 * list the app shows it no Copilot row, so there is nowhere to withdraw from;
 * a consent left behind would let a later re-allow answer without asking
 * again, on an agreement the person could not see or take back meanwhile.
 */
export async function setCopilotAccess(
  db: Db,
  userId: string,
  allowed: boolean,
  now: Date = new Date(),
): Promise<boolean> {
  const profiles = db.collection<Profile>(COLLECTIONS.profiles)
  if (!allowed) {
    const result = await profiles.updateOne(
      { _id: userId },
      { $unset: { copilotAccess: '', copilotConsent: '' } },
    )
    return result.matchedCount === 1
  }
  const fresh = await profiles.updateOne(
    { _id: userId, copilotAccess: { $exists: false } },
    { $set: { copilotAccess: { at: now } } },
  )
  if (fresh.matchedCount === 1) return true
  return (await profiles.countDocuments({ _id: userId }, { limit: 1 })) === 1
}

/** Every allowed account, newest first — the lab's list. */
export async function listCopilotAccess(db: Db): Promise<AdminCopilotAccessRow[]> {
  const rows = await db
    .collection<Profile>(COLLECTIONS.profiles)
    .find(
      { copilotAccess: { $exists: true } },
      { projection: { handle: 1, displayName: 1, copilotAccess: 1 } },
    )
    .sort({ 'copilotAccess.at': -1 })
    .limit(LIST_LIMIT)
    .toArray()
  return rows.map((row) => ({
    userId: row._id,
    username: row.handle,
    displayName: row.displayName ?? row.handle,
    at: (row.copilotAccess?.at ?? new Date(0)).toISOString(),
  }))
}
