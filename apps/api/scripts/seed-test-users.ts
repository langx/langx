/**
 * Populate a database with disposable accounts that have real profiles, so
 * Discover, filters and chat have something to work against before there are
 * users.
 *
 *   pnpm --filter @langx/api exec tsx scripts/seed-test-users.ts --db langx
 *   pnpm --filter @langx/api exec tsx scripts/seed-test-users.ts --db langx --purge
 *
 * Two things it deliberately does not do. It does not go through
 * `POST /api/auth/sign-up/email`, because that sends a verification email per
 * account and these addresses cannot receive mail — the bounces would land on
 * a real sending domain's reputation. And it does not hand-write profile
 * documents: it calls `createProfile`, the same function onboarding calls, so
 * a seeded profile cannot drift from a real one.
 *
 * Every account it creates is identifiable by its email domain, which is what
 * `--purge` matches on. `.invalid` is reserved by RFC 2606 and can never
 * resolve, so none of these addresses can receive mail even by accident.
 */
import { hashPassword } from 'better-auth/crypto'
import { ObjectId, type Db } from 'mongodb'
import type { OnboardingProfileInput } from '@langx/shared'
import { connectToDatabase } from '../src/db/client'
import { loadEnv } from '../src/env'
import { createProfile } from '../src/modules/profiles/profiles'

/** Shared by every seeded account; useless anywhere else. */
const PASSWORD = 'TestUser!2026'
const EMAIL_DOMAIN = 'test.langx.invalid'

/**
 * Weighted towards native Russian speakers learning English, which is the
 * mutual fit Discover needs to return anyone at all for an English speaker
 * learning Russian. The rest are there so filtering by language visibly
 * changes the result rather than always matching everyone.
 */
const PEOPLE: OnboardingProfileInput[] = [
  {
    handle: 'test_anna',
    displayName: 'Anna',
    birthDate: '1997-06-15',
    gender: 'female',
    nativeLanguages: [{ code: 'ru' }],
    learning: [{ code: 'en', level: 'intermediate', priority: 1 }],
    country: 'RU',
    city: 'Saint Petersburg',
    bio: 'Architect. I read English novels slowly and want to stop translating in my head.',
    interests: ['books', 'art', 'photography'],
  },
  {
    handle: 'test_dmitri',
    displayName: 'Dmitri',
    birthDate: '1992-06-15',
    gender: 'male',
    nativeLanguages: [{ code: 'ru' }],
    learning: [
      { code: 'en', level: 'beginner', priority: 1 },
      { code: 'de', level: 'beginner', priority: 2 },
    ],
    country: 'KZ',
    city: 'Almaty',
    bio: 'Backend developer. My reading is fine, my speaking is not.',
    interests: ['technology', 'football', 'cooking'],
  },
  {
    handle: 'test_katya',
    displayName: 'Katya',
    birthDate: '2001-06-15',
    gender: 'female',
    nativeLanguages: [{ code: 'ru' }, { code: 'uk' }],
    learning: [{ code: 'en', level: 'fluent', priority: 1 }],
    country: 'GE',
    city: 'Tbilisi',
    bio: 'Illustrator, moved last year. Happy to explain Russian cases to anyone brave enough.',
    interests: ['art', 'animals', 'travel', 'music'],
  },
  {
    handle: 'test_pavel',
    displayName: 'Pavel',
    birthDate: '1988-06-15',
    gender: 'male',
    nativeLanguages: [{ code: 'ru' }],
    learning: [{ code: 'en', level: 'intermediate', priority: 1 }],
    country: 'RS',
    city: 'Belgrade',
    bio: 'I teach maths. Looking for someone who wants to talk about anything except grammar.',
    interests: ['science', 'history', 'fitness'],
  },
  {
    handle: 'test_olga',
    displayName: 'Olga',
    birthDate: '1995-06-15',
    gender: 'female',
    nativeLanguages: [{ code: 'ru' }],
    learning: [
      { code: 'en', level: 'beginner', priority: 1 },
      { code: 'es', level: 'beginner', priority: 2 },
    ],
    country: 'AM',
    city: 'Yerevan',
    bio: 'Nurse, night shifts, so my hours are strange. Patient with beginners.',
    interests: ['nature', 'cooking', 'films'],
  },
  {
    handle: 'test_mateo',
    displayName: 'Mateo',
    birthDate: '1999-06-15',
    gender: 'male',
    nativeLanguages: [{ code: 'es' }],
    learning: [{ code: 'en', level: 'intermediate', priority: 1 }],
    country: 'AR',
    city: 'Córdoba',
    bio: 'Music student. I can talk about football for longer than anyone wants.',
    interests: ['music', 'football', 'films'],
  },
  {
    handle: 'test_elif',
    displayName: 'Elif',
    birthDate: '1994-06-15',
    gender: 'female',
    nativeLanguages: [{ code: 'tr' }],
    learning: [{ code: 'ru', level: 'beginner', priority: 1 }],
    country: 'TR',
    city: 'İzmir',
    bio: 'Graphic designer starting Russian from zero. Cyrillic is going badly.',
    interests: ['art', 'travel', 'photography'],
  },
  {
    handle: 'test_yuki',
    displayName: 'Yuki',
    birthDate: '1990-06-15',
    gender: 'other',
    nativeLanguages: [{ code: 'ja' }],
    learning: [{ code: 'en', level: 'fluent', priority: 1 }],
    country: 'JP',
    city: 'Fukuoka',
    bio: 'Translator. I want to lose the textbook sound when I speak.',
    interests: ['languages', 'books', 'nature', 'teaching'],
  },
]

function emailFor(handle: string): string {
  return `${handle}@${EMAIL_DOMAIN}`
}

async function purge(db: Db): Promise<void> {
  const users = await db
    .collection('user')
    .find(
      { email: { $regex: `@${EMAIL_DOMAIN.replace('.', '\\.')}$` } },
      { projection: { _id: 1 } },
    )
    .toArray()

  if (users.length === 0) {
    console.log('nothing to purge')
    return
  }

  const ids = users.map((user) => user._id)
  const stringIds = ids.map((id) => String(id))

  // `profiles._id` is the user id as a string, not an ObjectId.
  const profiles = await db
    .collection<{ _id: string }>('profiles')
    .deleteMany({ _id: { $in: stringIds } })
  await db.collection('handleReservations').deleteMany({ userId: { $in: stringIds } })
  const sessions = await db.collection('session').deleteMany({ userId: { $in: ids } })
  const accounts = await db.collection('account').deleteMany({ userId: { $in: ids } })
  const removed = await db.collection('user').deleteMany({ _id: { $in: ids } })

  console.log(
    `purged ${removed.deletedCount} users, ${profiles.deletedCount} profiles, ` +
      `${accounts.deletedCount} accounts, ${sessions.deletedCount} sessions`,
  )
}

async function seed(db: Db): Promise<void> {
  const now = new Date()
  const password = await hashPassword(PASSWORD)
  let created = 0

  for (const person of PEOPLE) {
    const email = emailFor(person.handle)
    if (await db.collection('user').findOne({ email })) {
      console.log(`skip ${person.handle} — already seeded`)
      continue
    }

    const userId = new ObjectId()
    await db.collection('user').insertOne({
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

    // Shape mirrors what the Better Auth mongo adapter writes for a
    // credential account, including `userId` as an ObjectId while `accountId`
    // is the same value as a string.
    await db.collection('account').insertOne({
      userId,
      accountId: String(userId),
      providerId: 'credential',
      issuer: 'local:credential',
      password,
      createdAt: now,
      updatedAt: now,
    })

    await createProfile(db, String(userId), null, person)
    created += 1
    console.log(`seeded ${person.handle} (${email})`)
  }

  if (created > 0) {
    console.log(`\n${created} accounts created. Password for all of them: ${PASSWORD}`)
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const dbFlag = args.indexOf('--db')
  const env = loadEnv()
  const dbName = dbFlag === -1 ? env.MONGODB_DB : (args[dbFlag + 1] ?? env.MONGODB_DB)

  const { db, close } = await connectToDatabase(env.MONGODB_URI, dbName)
  console.log(`database: ${dbName}`)

  try {
    if (args.includes('--purge')) await purge(db)
    else await seed(db)
  } finally {
    await close()
  }
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
