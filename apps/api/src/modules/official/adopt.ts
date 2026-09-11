import type { Db } from 'mongodb'
import { OFFICIAL_DISPLAY_NAMES, type OfficialHandle } from '@langx/shared'
import { COLLECTIONS } from '../../db/collections'
import { authId } from '../../lib/authId'
import type { Profile } from '../profiles/profiles'

export interface AdoptionResult {
  handle: OfficialHandle
  userId: string
  /** What the address was, so a report can say which mailbox just came free. */
  previousEmail: string | null
  sessionsRevoked: number
  credentialsRemoved: number
  /** True when there was nothing left to do — running this twice is a no-op. */
  alreadyOfficial: boolean
}

/**
 * Turns an account somebody has been running by hand into the official one.
 *
 * `ensureOfficialAccounts` deliberately refuses to touch a profile it did not
 * create: taking a handle off its owner is a data loss no index would catch.
 * That is the right default and the wrong answer for exactly one case — the
 * account **is** ours, it has been answering as LangX for months, and its
 * conversations and history are worth keeping. This is that case, done
 * deliberately and once, by a person running a script.
 *
 * What it does **not** do is delete the account's history: the conversations,
 * the messages and the streak all stay. What it takes away is the ability to
 * sign in, because "nobody can sign in to an official account" is a property
 * of the whole design and not a rule this one gets to be an exception to. The
 * gallery, the country and the pronouns go on the next boot — see
 * `ensureOfficialAccounts`, which owns what an official profile looks like.
 *
 * The order matters. Credentials go first, so a run that dies halfway leaves
 * an account nobody can sign into that is not yet official — harmless, and
 * finishable. The other half-state, official but still signable-in, is the one
 * worth not having.
 *
 * Idempotent: a second run finds the flag already set and changes nothing.
 */
export async function adoptOfficialAccount(
  db: Db,
  handle: OfficialHandle,
): Promise<AdoptionResult> {
  const profiles = db.collection<Profile>(COLLECTIONS.profiles)
  const profile = await profiles.findOne({ handle })
  if (!profile) throw new Error(`No account holds @${handle} — nothing to adopt`)

  const users = db.collection<{ _id: unknown; email?: string }>(COLLECTIONS.user)
  const id = authId(profile._id)
  const user = await users.findOne({ _id: id as never }, { projection: { email: 1 } })

  if (profile.official) {
    return {
      handle,
      userId: profile._id,
      previousEmail: user?.email ?? null,
      sessionsRevoked: 0,
      credentialsRemoved: 0,
      alreadyOfficial: true,
    }
  }

  // Every live session, and every way of starting a new one — the password
  // row and any Google or Apple link.
  const sessions = await db.collection(COLLECTIONS.session).deleteMany({ userId: id })
  const credentials = await db.collection(COLLECTIONS.account).deleteMany({ userId: id })

  /*
   * The address becomes undeliverable, which is what actually closes the door:
   * with no mailbox behind it, no reset link and no magic link can arrive. It
   * also hands the old address back — `hi@langx.io` is a mailbox people write
   * to, and it should not also be an account.
   */
  const now = new Date()
  await users.updateOne(
    { _id: id as never },
    {
      $set: {
        email: `${handle}@official.langx.invalid`,
        name: OFFICIAL_DISPLAY_NAMES[handle],
        emailVerified: true,
        official: true,
        updatedAt: now,
      },
    },
  )

  /*
   * The same fields `ensureOfficialAccounts` writes on a fresh one, and each
   * carries its weight: `discoverable` keeps it out of the grid,
   * `notifications: false` keeps it out of every scheduled send (see the
   * comment there), `hideOnlineStatus` stops a program having a presence, and
   * `tokenFrozenAt` is belt and braces beside the guard in `awardForSend`.
   *
   * The display name, the avatar and the bio are not set here. The next boot
   * writes all three from code, which is the only editor these accounts have.
   */
  await profiles.updateOne(
    { _id: profile._id },
    {
      $set: {
        official: true,
        'settings.discoverable': false,
        'settings.notifications': false,
        'privacy.hideOnlineStatus': true,
        tokenFrozenAt: now,
        /*
         * Emptied so an adopted account and a created one are the same shape.
         * They are hidden on every screen either way — but two official
         * accounts that differ in the document is the kind of drift that only
         * shows up in whatever reads them next.
         */
        nativeLanguages: [],
        learning: [],
        updatedAt: now,
      },
    },
  )

  return {
    handle,
    userId: profile._id,
    previousEmail: user?.email ?? null,
    sessionsRevoked: sessions.deletedCount,
    credentialsRemoved: credentials.deletedCount,
    alreadyOfficial: false,
  }
}
