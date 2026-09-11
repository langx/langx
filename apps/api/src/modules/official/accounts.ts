import { MongoServerError, ObjectId, type Db } from 'mongodb'
import {
  OFFICIAL_DISPLAY_NAMES,
  OFFICIAL_HANDLES,
  OFFICIAL_WRITABLE,
  officialAvatarUrl,
  type OfficialHandle,
} from '@langx/shared'
import { COLLECTIONS } from '../../db/collections'
import type { Profile } from '../profiles/profiles'

/**
 * The Better Auth row behind an official account.
 *
 * Written directly, which the codebase otherwise avoids — the same exception
 * `insertPrecreatedUser` takes, for the same reason: there is no server-side
 * "create a user with no credentials" in Better Auth, and `signUpEmail` would
 * mint a password nobody knows and send a verification mail nobody asked for.
 *
 * The address is undeliverable by construction. `.invalid` is reserved by
 * RFC 2606 and resolves nowhere, so no reset link, magic link or verification
 * mail can ever reach a mailbox — which is what makes this row impossible to
 * sign in to rather than merely inconvenient.
 */
interface OfficialUserDoc {
  _id: ObjectId
  email: string
  name: string
  emailVerified: boolean
  official: true
  createdAt: Date
  updatedAt: Date
}

/**
 * English, and not from the locale catalogue, because a bio is a stored field
 * on a document: one row, one string, read by every viewer whatever they
 * speak. Localising it would mean either a bio per locale on the profile or a
 * special case in every reader, for two sentences.
 */
const OFFICIAL_BIOS: Record<OfficialHandle, string> = {
  langx:
    'News and announcements from LangX. This account doesn’t take messages — Settings → About → Feedback reaches the team.',
  copilot: 'The LangX assistant. Not open yet.',
}

const idsByHandle = new Map<OfficialHandle, string>()
const handlesById = new Map<string, OfficialHandle>()

export type OfficialOutcome = 'created' | 'updated' | 'conflict'

export interface OfficialAccountResult {
  handle: OfficialHandle
  outcome: OfficialOutcome
  userId?: string
}

/** The account ids, once `ensureOfficialAccounts` has run. Empty before that. */
export function officialIds(): ReadonlyMap<OfficialHandle, string> {
  return idsByHandle
}

/**
 * The question every guard asks. A map lookup on a cache filled at boot, so
 * `awardForSend` — which runs on every message in the app — pays nothing for
 * it.
 *
 * Empty before `ensureOfficialAccounts` has run, which makes each guard inert
 * rather than wrong: a test that never created the accounts cannot have a
 * message addressed to one either.
 */
export function isOfficialId(id: string): boolean {
  return handlesById.has(id)
}

/**
 * Whether a message may be sent to this account at all.
 *
 * True for every person, and for the one official account that answers. False
 * for `@langx`, which is a channel: it welcomes and it announces, and there is
 * nothing at the other end to read a reply. See `OFFICIAL_WRITABLE`.
 */
export function acceptsMessages(id: string): boolean {
  const handle = officialHandleOf(id)
  return handle === null || OFFICIAL_WRITABLE[handle]
}

export function officialHandleOf(id: string): OfficialHandle | null {
  return handlesById.get(id) ?? null
}

function isDuplicateKey(error: unknown): boolean {
  return error instanceof MongoServerError && error.code === 11000
}

async function ensureOne(
  db: Db,
  handle: OfficialHandle,
  publicApiUrl: string,
): Promise<OfficialAccountResult> {
  const profiles = db.collection<Profile>(COLLECTIONS.profiles)
  const displayName = OFFICIAL_DISPLAY_NAMES[handle]
  const avatarUrl = officialAvatarUrl(publicApiUrl, handle)
  const now = new Date()

  const existing = await profiles.findOne({ handle })
  if (existing) {
    /*
     * Somebody's account, not ours. `copilot` was only reserved once these
     * accounts were designed, so in a database that predates that a real
     * person may be holding it. Boot continues without the account rather
     * than taking a handle off its owner — the assistant is worth less than
     * that, and the alternative is a data loss no index would have caught.
     */
    if (!existing.official) return { handle, outcome: 'conflict' }

    /*
     * The three fields an official account wears are written from code on
     * every boot, not just when the row is created.
     *
     * `avatarUrl` because it carries the API's public address, so an
     * environment that moved would keep serving the old one. The name and the
     * bio because **nobody can sign in to these accounts** — there is no
     * screen anywhere that can edit them, so code is the only editor they
     * have. An account adopted from a real one arrives with whatever bio it
     * was carrying; this is what turns it into the assistant's.
     */
    await profiles.updateOne(
      { _id: existing._id },
      {
        $set: {
          avatarUrl,
          displayName,
          bio: OFFICIAL_BIOS[handle],
          /*
           * The same shape a created one gets, not just the same name. An
           * adopted account arrives carrying whatever it was set to, and an
           * account that is discoverable, notifiable or drawing an activity
           * map is one of those things behaving like a person.
           */
          'settings.discoverable': false,
          'settings.notifications': false,
          'privacy.hideOnlineStatus': true,
          'privacy.activityMapVisible': false,
          'privacy.weekChartVisible': false,
          tokenFrozenAt: now,
          updatedAt: now,
        },
        /*
         * And the things an official account must not be carrying.
         *
         * A created one never has them; an **adopted** one arrives with
         * whatever the person was using it for. Two cats in the gallery and a
         * country under the name are exactly the kind of leftover that nobody
         * thinks to look for, because the account otherwise reads correctly.
         *
         * `$unset` on an absent field costs nothing, so this runs on every
         * boot and the account heals itself rather than needing a migration.
         */
        $unset: {
          photos: '',
          pronouns: '',
          interests: '',
          country: '',
          cityId: '',
          cityName: '',
          cityCountryCode: '',
          location: '',
          locationUpdatedAt: '',
          // A discovery boost on an undiscoverable account does nothing, and a
          // stats switch from somebody's own profile is not ours to keep. Not
          // on `Profile` at all, which is why they are cleared by name here
          // rather than set above.
          'settings.boosted': '',
          'privacy.statsVisible': '',
          'privacy.hideCity': '',
        },
      },
    )
    return { handle, outcome: 'updated', userId: existing._id }
  }

  const users = db.collection<OfficialUserDoc>(COLLECTIONS.user)
  const email = `${handle}@official.langx.invalid`

  /*
   * Read before insert, the way `insertPrecreatedUser` does, because the two
   * rows can come apart: a profile removed by hand leaves its `user` behind,
   * and `user_email_uidx` would then turn every subsequent boot into a crash
   * loop. Reusing the row is also what makes the profile keep its id.
   */
  const existingUser = await users.findOne({ email })
  const user: OfficialUserDoc = existingUser ?? {
    _id: new ObjectId(),
    email,
    name: displayName,
    emailVerified: true,
    official: true,
    createdAt: now,
    updatedAt: now,
  }
  const userId = String(user._id)

  const profile: Profile = {
    _id: userId,
    official: true,
    handle,
    displayName,
    avatarUrl,
    bio: OFFICIAL_BIOS[handle],
    // Never rendered: `toPublicProfile` omits the age of an official account
    // rather than deriving one from this. Same placeholder a guest carries,
    // and here for the same reason — the type requires a date.
    birthDate: '1900-01-01',
    gender: 'undisclosed',
    nativeLanguages: [],
    learning: [],
    interests: [],
    /*
     * `notifications: false` is load-bearing, not tidiness. The unread digest,
     * the campaign audience and the streak reminder all bound their sweeps
     * with `'settings.notifications': { $ne: false }`, and
     * `notificationsAllowed` reads a bare boolean as v1's "everything off".
     * So this one field is what keeps an official account out of every
     * scheduled send, and no sender needs a special case. Do not "fix" it to
     * the default prefs object.
     */
    settings: { discoverable: false, notifications: false },
    privacy: {
      incognito: false,
      // No presence for an account that is a process. `isOnline` is forced
      // false by this, so the tick beside the name is the only status it has.
      hideOnlineStatus: true,
      activityMapVisible: false,
      weekChartVisible: false,
    },
    entitlement: { tier: 'free', updatedAt: now },
    quota: { initiations: [], translations: [], media: [] },
    streak: { current: 0, longest: 0, lastQualifiedDay: null },
    stats: { lastActiveAt: now, messagesSent: 0 },
    // Belt and braces beside the guard in `awardForSend`: even if a message
    // reached the ledger, this account could not earn from it.
    tokenFrozenAt: now,
    createdAt: now,
    updatedAt: now,
  }

  if (!existingUser) await users.insertOne(user)
  try {
    await profiles.insertOne(profile)
  } catch (error) {
    // `handle_unique` is the real guard; the read above only makes the common
    // case cheap. Losing it here means two boots raced, or a claim landed in
    // between — either way somebody else's row stands.
    if (isDuplicateKey(error)) {
      // Only a row this call wrote. One that was already there belongs to an
      // earlier run and may yet get its profile back.
      if (!existingUser) await users.deleteOne({ _id: user._id })
      const raced = await profiles.findOne({ handle })
      if (raced?.official) return { handle, outcome: 'updated', userId: raced._id }
      return { handle, outcome: 'conflict' }
    }
    throw error
  }

  return { handle, outcome: 'created', userId }
}

/**
 * Creates the accounts LangX speaks from, or leaves the ones already there
 * alone. Called at boot right after `ensureIndexes`, so every environment —
 * a fresh self-host, a test database, production — has them without anybody
 * seeding anything.
 *
 * Idempotent on `handle_unique`, and it fills the id cache the guards read.
 */
export async function ensureOfficialAccounts(
  db: Db,
  publicApiUrl: string,
): Promise<OfficialAccountResult[]> {
  const results: OfficialAccountResult[] = []
  idsByHandle.clear()
  handlesById.clear()

  for (const handle of OFFICIAL_HANDLES) {
    const result = await ensureOne(db, handle, publicApiUrl)
    if (result.userId) {
      idsByHandle.set(handle, result.userId)
      handlesById.set(result.userId, handle)
    }
    results.push(result)
  }
  return results
}
