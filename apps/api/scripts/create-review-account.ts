/**
 * The account an app-store reviewer signs in with.
 *
 * Apple asks for a working username and password in App Review Information,
 * and Google Play asks the same under "App access". Neither reviewer can be
 * asked to receive mail: `emailAndPassword` runs with
 * `requireEmailVerification: true` and `autoSignIn: false`, so an account made
 * through the sign-up form returns no session and stays unusable until a link
 * in an inbox nobody here owns is clicked. That is why this writes the rows
 * directly, already verified — the same reason `testAccounts.ts` does.
 *
 *   pnpm --filter @langx/api exec tsx --env-file=../../.env --env-file=../../.env.prod \
 *     scripts/create-review-account.ts --email <address> --password <secret> --handle <handle>
 *
 * Unlike the fixture scripts this one is *meant* for `langx`, so it carries no
 * `_dev` guard. It prints the database it is about to write to and refuses to
 * touch a production database without `--confirm`, which is the guard instead.
 *
 * Idempotent on the email address: run it again to reset the password or to
 * re-grant the tier without deleting anything first.
 *
 * `--password` lands in shell history. It is a throwaway credential typed into
 * a store console, not a person's password, so that is acceptable here and
 * nowhere else.
 */
import { hashPassword } from 'better-auth/crypto'
import { ObjectId } from 'mongodb'
import { TIER_ENTITLEMENTS, type OnboardingProfileInput, type PlanTier } from '@langx/shared'
import { connectToDatabase } from '../src/db/client'
import { loadEnv } from '../src/env'
import { COLLECTIONS } from '../src/db/collections'
import { recordTermsAcceptance } from '../src/modules/account/terms'
import { createProfile, type Profile } from '../src/modules/profiles/profiles'
import { createRevenueCatClientFromEnv } from '../src/modules/billing/createRevenueCatClient'

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i === -1 ? undefined : process.argv[i + 1]
}

const email = arg('email')
const password = arg('password')
const handle = arg('handle') ?? 'langx_review'
const tier = (arg('tier') ?? 'pro_plus') as PlanTier
const displayName = arg('name') ?? 'App Review'

if (!email || !password) {
  throw new Error(
    'usage: --email <address> --password <secret> [--handle h] [--tier pro_plus] [--confirm]',
  )
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
 * Native English learning Russian, because that is the mutual fit that returns
 * anybody at all in Discover — the population leans Russian natives learning
 * English. A reviewer who opens the app to an empty grid files a rejection.
 */
const PERSON: OnboardingProfileInput = {
  handle,
  displayName,
  birthDate: '1995-04-12',
  gender: 'undisclosed',
  nativeLanguages: [{ code: 'en' }],
  learning: [{ code: 'ru', level: 'beginner', priority: 1 }],
  country: 'US',
  bio: 'Reviewing LangX. Here to look around.',
  interests: ['books', 'music', 'travel'],
}

const { db, close } = await connectToDatabase(env.MONGODB_URI, dbName)

try {
  console.log(`db     ${dbName}`)
  console.log(`email  ${email}`)

  const users = db.collection(COLLECTIONS.user)
  const accounts = db.collection(COLLECTIONS.account)
  const now = new Date()

  const existing = await users.findOne({ email })
  const userId = existing ? new ObjectId(String(existing._id)) : new ObjectId()
  const hash = await hashPassword(password)

  if (existing) {
    await users.updateOne(
      { _id: userId },
      { $set: { emailVerified: true, name: displayName, updatedAt: now } },
    )
    console.log('user   already existed — verified flag and name refreshed')
  } else {
    await users.insertOne({
      _id: userId,
      name: displayName,
      email,
      // No verification link can be clicked for this address by anyone who
      // needs the account, so the flag is set here rather than left to a flow
      // that cannot complete.
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
    })
    console.log('user   created')
  }

  /*
   * Mirrors the shape Better Auth's mongo adapter writes for a credential
   * account — `userId` as an ObjectId, `accountId` the same value as a string.
   * Upserted rather than inserted so a re-run is a password reset.
   */
  await accounts.updateOne(
    { userId, providerId: 'credential' },
    {
      $set: { password: hash, updatedAt: now },
      $setOnInsert: {
        accountId: String(userId),
        issuer: 'local:credential',
        createdAt: now,
      },
    },
    { upsert: true },
  )
  console.log('account credential password set')

  // Every other route into an account passes through the Better Auth create
  // hook that stamps this; writing the rows directly skips it.
  await recordTermsAcceptance(db, String(userId))

  const profiles = db.collection<Profile>(COLLECTIONS.profiles)
  if (await profiles.findOne({ _id: String(userId) })) {
    console.log('profile already existed — left alone')
  } else {
    await createProfile(db, String(userId), null, PERSON, env.STORAGE_PUBLIC_BASE_URL)
    console.log(`profile created as @${handle}`)
  }

  await profiles.updateOne(
    { _id: String(userId) },
    {
      // The whole subdocument, not a field of it: `expiresAt` is optional and a
      // re-run must not leave a stale one behind next to a fresh tier.
      $set: {
        entitlement: { tier, willRenew: false, store: 'manual', updatedAt: now },
        updatedAt: now,
      },
    },
  )
  console.log(`tier   ${tier}, no expiry`)

  /*
   * The row above is not enough on its own. RevenueCat is the only authority
   * the server recognises — `refreshEntitlement` replaces the stored tier with
   * whatever the subscriber record says — and the paywall calls
   * `POST /billing/refresh` after a purchase *and* after a Restore, which a
   * reviewer testing in-app purchase will do. A database-only grant is free
   * again by the time they look at it.
   *
   * So the tier is granted promotionally as well, exactly as the v1 loyalty
   * gift is (`legacyRestore.ts`): lifetime, tier-defining entitlement first,
   * and visible and revocable in the dashboard afterwards. The Pro+ rung hands
   * out `pro` too, because that is how the Pro+ products are configured.
   */
  if (tier !== 'free') {
    if (env.REVENUECAT_SECRET_API_KEY) {
      const billing = createRevenueCatClientFromEnv(env)
      for (const entitlement of TIER_ENTITLEMENTS[tier]) {
        await billing.grantLifetimeEntitlement(String(userId), entitlement)
        console.log(`rc     granted ${entitlement} for life`)
      }
    } else {
      console.log(
        'rc     SKIPPED — no REVENUECAT_SECRET_API_KEY in the loaded env.\n' +
          '       The tier above is database-only and the first POST /billing/refresh\n' +
          '       (the paywall runs one after any purchase or Restore) will reset it to\n' +
          '       free. Grant it in the RevenueCat dashboard for the userId below.',
      )
    }
  }

  console.log(`\nuserId ${String(userId)}`)
  console.log('This userId is also the RevenueCat app_user_id.')
} finally {
  await close()
}
