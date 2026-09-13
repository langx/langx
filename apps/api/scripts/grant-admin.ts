/**
 * The account that can open the operator panel.
 *
 *   ADMIN_PASSWORD=... pnpm --filter @langx/api exec tsx --env-file=../../.env \
 *     scripts/grant-admin.ts --email <address> [--handle h] [--confirm]
 *
 * Two paths, and which one runs depends on whether the address already has an
 * account:
 *
 * - **It does.** Nothing is created and no password is touched. The profile
 *   gets `admin: true` and you sign in the way you always did. This is the
 *   common case and the better one: no second credential to store.
 * - **It does not.** The rows are written directly, already verified — the
 *   same reason `create-review-account.ts` does it. `emailAndPassword` runs
 *   with `requireEmailVerification: true` and `autoSignIn: false`, so an
 *   account made through the sign-up form returns no session and stays
 *   unusable until a link is clicked in an inbox.
 *
 * The password is read from `ADMIN_PASSWORD`, or generated and printed once if
 * that is not set. Deliberately **not** an argv flag.
 * `create-review-account.ts` allows one and justifies it as "a throwaway
 * credential typed into a store console, not a person's password — acceptable
 * here and nowhere else". A moderator's password is the nowhere else: argv is
 * readable by every process on the machine and lands in shell history.
 *
 * `--revoke` takes the flag away again. Idempotent either way.
 *
 * It prints the database it is about to write to and refuses to touch one that
 * is not `*_dev` without `--confirm`.
 */
import { randomBytes } from 'node:crypto'
import { hashPassword } from 'better-auth/crypto'
import { ObjectId } from 'mongodb'
import { PASSWORD_MIN_LENGTH, type OnboardingProfileInput } from '@langx/shared'
import { connectToDatabase } from '../src/db/client'
import { loadEnv } from '../src/env'
import { COLLECTIONS } from '../src/db/collections'
import { recordTermsAcceptance } from '../src/modules/account/terms'
import { createProfile, type Profile } from '../src/modules/profiles/profiles'

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i === -1 ? undefined : process.argv[i + 1]
}

const email = arg('email')?.trim().toLowerCase()
const handle = arg('handle') ?? 'langx_admin'
const displayName = arg('name') ?? 'LangX Admin'
const revoke = process.argv.includes('--revoke')

if (!email) {
  throw new Error('usage: --email <address> [--handle h] [--name n] [--revoke] [--confirm]')
}

const env = loadEnv()
const dbName = arg('db') ?? env.MONGODB_DB

if (!dbName.endsWith('_dev') && !process.argv.includes('--confirm')) {
  throw new Error(
    `Refusing to write to "${dbName}" without --confirm. This is a live database; ` +
      `re-run with --confirm if that is what you mean.`,
  )
}

/**
 * Only used when the address has no account yet. Boring on purpose: this
 * profile is a door, not a person, and nothing about it should end up in
 * anybody's Discover as a surprise.
 */
const PERSON: OnboardingProfileInput = {
  handle,
  displayName,
  birthDate: '1990-01-01',
  gender: 'undisclosed',
  nativeLanguages: [{ code: 'en' }],
  learning: [{ code: 'tr', level: 'beginner', priority: 1 }],
  country: 'CA',
  bio: 'Moderation account.',
  interests: ['books'],
}

const { db, close } = await connectToDatabase(env.MONGODB_URI, dbName)

try {
  console.log(`db     ${dbName}`)
  console.log(`email  ${email}`)

  const users = db.collection(COLLECTIONS.user)
  const profiles = db.collection<Profile>(COLLECTIONS.profiles)
  const now = new Date()

  const existing = await users.findOne({ email })

  if (revoke) {
    if (!existing) throw new Error('No account with that address; nothing to revoke.')
    const result = await profiles.updateOne(
      { _id: String(existing._id) },
      { $unset: { admin: '' }, $set: { updatedAt: now } },
    )
    console.log(result.modifiedCount ? 'admin  revoked' : 'admin  was not set — nothing to do')
    process.exit(0)
  }

  let userId: ObjectId
  let created = false

  if (existing) {
    userId = new ObjectId(String(existing._id))
    console.log('user   already exists — password left alone')
  } else {
    userId = new ObjectId()
    const password = process.env.ADMIN_PASSWORD ?? randomBytes(18).toString('base64url')
    if (password.length < PASSWORD_MIN_LENGTH) {
      throw new Error(`ADMIN_PASSWORD must be at least ${PASSWORD_MIN_LENGTH} characters.`)
    }

    await users.insertOne({
      _id: userId,
      name: displayName,
      email,
      // Nobody can click a link for this address in time to be useful, so the
      // flag is set here rather than left to a flow that would never complete.
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
    })

    /*
     * Mirrors the shape Better Auth's mongo adapter writes for a credential
     * account — `userId` as an ObjectId, `accountId` the same value as a
     * string.
     */
    await db.collection(COLLECTIONS.account).updateOne(
      { userId, providerId: 'credential' },
      {
        $set: { password: await hashPassword(password), updatedAt: now },
        $setOnInsert: { accountId: String(userId), issuer: 'local:credential', createdAt: now },
      },
      { upsert: true },
    )

    // Every other route into an account passes through the Better Auth create
    // hook that stamps this; writing the rows directly skips it.
    await recordTermsAcceptance(db, String(userId))
    created = true
    console.log('user   created, verified')
    console.log(`\n  password  ${password}`)
    console.log('  Printed once. It is not stored anywhere else and cannot be shown again.\n')
  }

  if (!(await profiles.findOne({ _id: String(userId) }))) {
    await createProfile(db, String(userId), null, PERSON, env.STORAGE_PUBLIC_BASE_URL)
    console.log(`profile created as @${handle}`)
  } else if (created) {
    console.log('profile already existed — left alone')
  }

  await profiles.updateOne({ _id: String(userId) }, { $set: { admin: true, updatedAt: now } })
  console.log('admin  granted')
  console.log(`\nuserId ${String(userId)}`)
} finally {
  await close()
}
