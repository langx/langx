/**
 * What the disposable-fixture scripts share — accounts, the purge, and the
 * `--db` guard — between `seed-test-users.ts` (people for Discover) and
 * `seed-test-chat.ts` (a thread between two of them).
 *
 * Its own module rather than one script importing the other, because both of
 * those end in a top-level `main().catch(...)` — importing either would run it.
 *
 * Two things it deliberately does not do. It does not go through
 * `POST /api/auth/sign-up/email`, because that sends a verification email per
 * account and these addresses cannot receive mail — the bounces would land on
 * a real sending domain's reputation. And it does not hand-write profile
 * documents: it calls `createProfile`, the same function onboarding calls, so
 * a seeded profile cannot drift from a real one.
 *
 * Every account is identifiable by its email domain, which is what
 * `purgeTestAccounts` matches on. `.invalid` is reserved by RFC 2606 and can
 * never resolve, so none of these addresses can receive mail even by accident.
 */
import { hashPassword } from 'better-auth/crypto'
import { ObjectId, type Db } from 'mongodb'
import type { OnboardingProfileInput } from '@langx/shared'
import { COLLECTIONS } from '../src/db/collections'
import { createProfile, type Profile } from '../src/modules/profiles/profiles'

/**
 * Which database a fixture script writes to.
 *
 * `--db` is a guard, not a convenience: one Atlas user reaches both `langx_dev`
 * and `langx`, so the flag is the only thing between a seed and real users
 * (see `docs/release-runbook.md` → "Production is `langx`"). The pattern check
 * is part of that. A database name is a short identifier and nothing else, and
 * refusing anything that is not one keeps a mistyped flag — or an argument
 * that picked up a shell fragment — from reaching a live cluster under a name
 * nobody meant. It is also what stops `process.argv` counting as a live source
 * all the way into the writes downstream.
 */
export function resolveDbName(args: string[], fallback: string): string {
  const flag = args.indexOf('--db')
  if (flag === -1) return fallback

  const requested = args[flag + 1] ?? fallback
  if (!/^[A-Za-z0-9_-]{1,63}$/.test(requested)) {
    throw new Error(`--db must be a plain database name, got "${requested}"`)
  }
  return requested
}

/**
 * Escape every regex metacharacter, not only the dots.
 *
 * `EMAIL_DOMAIN` is a constant with nothing in it but dots, so today the dots
 * are all that matter — but a partial escape is exactly the kind of thing that
 * stops being true when somebody edits the constant, and a purge that silently
 * matches the wrong set of accounts is the worst way to find out. CodeQL flags
 * the half-measure as `js/incomplete-sanitization`, and it is right to.
 */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Shared by every seeded account; useless anywhere else. */
export const PASSWORD = 'TestUser!2026'
export const EMAIL_DOMAIN = 'test.langx.invalid'

export function emailFor(handle: string): string {
  return `${handle}@${EMAIL_DOMAIN}`
}

/**
 * Hashing is scrypt, so it costs real time — and every seeded account shares
 * one password, so it only has to happen once per process however many
 * accounts a script asks for.
 */
let passwordHash: Promise<string> | undefined
function hashOnce(): Promise<string> {
  passwordHash ??= hashPassword(PASSWORD)
  return passwordHash
}

export interface EnsuredAccount {
  userId: string
  /** False when the account was already there and nothing was written. */
  created: boolean
}

/**
 * An account with a profile, ready to sign in with `PASSWORD`. Idempotent on
 * the email address, so a script can be re-run to top up what is missing
 * without `--purge` first.
 */
export async function ensureAccount(
  db: Db,
  person: OnboardingProfileInput,
): Promise<EnsuredAccount> {
  const email = emailFor(person.handle)
  const existing = await db.collection(COLLECTIONS.user).findOne({ email })
  if (existing) return { userId: String(existing._id), created: false }

  const now = new Date()
  const userId = new ObjectId()
  await db.collection(COLLECTIONS.user).insertOne({
    _id: userId,
    name: person.displayName,
    email,
    // No verification mail can reach these addresses, and an unverified
    // account cannot sign in — so this is set here rather than left to a
    // flow that cannot complete.
    emailVerified: true,
    createdAt: now,
    updatedAt: now,
  })

  // Shape mirrors what the Better Auth mongo adapter writes for a credential
  // account, including `userId` as an ObjectId while `accountId` is the same
  // value as a string.
  await db.collection(COLLECTIONS.account).insertOne({
    userId,
    accountId: String(userId),
    providerId: 'credential',
    issuer: 'local:credential',
    password: await hashOnce(),
    createdAt: now,
    updatedAt: now,
  })

  /*
   * Onboarding caps both language lists at the free tier's one, so a fixture
   * with two learning languages cannot be created through `createProfile` any
   * more. The first entry of each goes in through the real path, and the rest
   * are written straight onto the document afterwards.
   *
   * That is not a way round the cap — it is the shape a migrated v1 profile
   * already has, and the one the grandfathering clause in `updateProfile`
   * exists for. A fixture that can only ever hold one language would take that
   * whole branch out of local testing, which is the half most likely to break.
   */
  await createProfile(db, String(userId), null, {
    ...person,
    nativeLanguages: [person.nativeLanguages[0]!],
    learning: [person.learning[0]!],
  })

  if (person.nativeLanguages.length > 1 || person.learning.length > 1) {
    await db.collection<Profile>(COLLECTIONS.profiles).updateOne(
      { _id: String(userId) },
      {
        $set: {
          nativeLanguages: person.nativeLanguages,
          learning: person.learning,
          updatedAt: new Date(),
        },
      },
    )
  }

  return { userId: String(userId), created: true }
}

/**
 * Everything every fixture script has ever written, matched on the email
 * domain above.
 *
 * The chat collections are in here even though only `seed-test-chat.ts`
 * writes them: purge runs from either script, and a thread whose participants
 * have been deleted is worse than no thread — it shows up in nobody's list and
 * quietly breaks anything that resolves a participant's profile.
 */
export async function purgeTestAccounts(db: Db): Promise<void> {
  const users = await db
    .collection(COLLECTIONS.user)
    .find({ email: { $regex: `@${escapeRegExp(EMAIL_DOMAIN)}$` } }, { projection: { _id: 1 } })
    .toArray()

  if (users.length === 0) {
    console.log('nothing to purge')
    return
  }

  const ids = users.map((user) => user._id)
  // Better Auth's collections key on ObjectId; ours store the string form.
  // See `lib/authId.ts` — the wrong one of the two matches nothing and
  // reports success, which as a purge means leaving the rows behind.
  const stringIds = ids.map((id) => String(id))

  const conversations = await db
    .collection<{ _id: ObjectId }>(COLLECTIONS.conversations)
    .find({ participants: { $in: stringIds } }, { projection: { _id: 1 } })
    .toArray()
  const conversationIds = conversations.map((conversation) => conversation._id)

  const messages = await db
    .collection(COLLECTIONS.messages)
    .deleteMany({ conversationId: { $in: conversationIds } })
  const threads = await db
    .collection(COLLECTIONS.conversations)
    .deleteMany({ _id: { $in: conversationIds } })

  for (const collection of [
    COLLECTIONS.tokenLedger,
    COLLECTIONS.tokenAggregates,
    COLLECTIONS.dailyActivity,
    COLLECTIONS.streakDays,
  ]) {
    await db.collection(collection).deleteMany({ userId: { $in: stringIds } })
  }

  /*
   * Not in the loop above, because a referral has no `userId`: it is keyed by
   * the *invitee* and carries the referrer separately, so both ends have to be
   * named or a half-purged pair is left pointing at a profile that is gone.
   *
   * The reading side already survives that — `readReferralStatus` skips an
   * invitee whose profile has been removed rather than drawing a blank row —
   * but surviving litter is not the same as not leaving it.
   */
  const referrals = await db
    .collection<{ _id: string; referrerId: string }>(COLLECTIONS.referrals)
    .deleteMany({
      $or: [{ _id: { $in: stringIds } }, { referrerId: { $in: stringIds } }],
    })

  // `profiles._id` is the user id as a string, not an ObjectId.
  const profiles = await db
    .collection<{ _id: string }>(COLLECTIONS.profiles)
    .deleteMany({ _id: { $in: stringIds } })
  await db.collection(COLLECTIONS.handleReservations).deleteMany({ userId: { $in: stringIds } })
  const sessions = await db.collection(COLLECTIONS.session).deleteMany({ userId: { $in: ids } })
  const accounts = await db.collection(COLLECTIONS.account).deleteMany({ userId: { $in: ids } })
  const removed = await db.collection(COLLECTIONS.user).deleteMany({ _id: { $in: ids } })

  console.log(
    `purged ${removed.deletedCount} users, ${profiles.deletedCount} profiles, ` +
      `${accounts.deletedCount} accounts, ${sessions.deletedCount} sessions, ` +
      `${threads.deletedCount} conversations, ${messages.deletedCount} messages, ` +
      `${referrals.deletedCount} referrals`,
  )
}
