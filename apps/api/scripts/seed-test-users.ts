/**
 * Populate a database with disposable accounts that have real profiles, so
 * Discover, filters and chat have something to work against before there are
 * users.
 *
 *   pnpm --filter @langx/api exec tsx scripts/seed-test-users.ts --db langx_dev
 *   pnpm --filter @langx/api exec tsx scripts/seed-test-users.ts --db langx_dev --purge
 *
 * The accounts themselves — and `--purge`, which clears what every fixture
 * script writes, this one and `seed-test-chat.ts` alike — live in
 * `testAccounts.ts`. This file is only the cast.
 */
import type { Db } from 'mongodb'
import type { OnboardingProfileInput } from '@langx/shared'
import { connectToDatabase } from '../src/db/client'
import { loadEnv } from '../src/env'
import { PASSWORD, emailFor, ensureAccount, purgeTestAccounts, resolveDbName } from './testAccounts'

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

async function seed(db: Db): Promise<void> {
  let created = 0

  for (const person of PEOPLE) {
    const account = await ensureAccount(db, person)
    if (!account.created) {
      console.log(`skip ${person.handle} — already seeded`)
      continue
    }
    created += 1
    console.log(`seeded ${person.handle} (${emailFor(person.handle)})`)
  }

  if (created > 0) {
    console.log(`\n${created} accounts created. Password for all of them: ${PASSWORD}`)
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const env = loadEnv()
  const dbName = resolveDbName(args, env.MONGODB_DB)

  const { db, close } = await connectToDatabase(env.MONGODB_URI, dbName)
  console.log(`database: ${dbName}`)

  try {
    if (args.includes('--purge')) await purgeTestAccounts(db)
    else await seed(db)
  } finally {
    await close()
  }
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
