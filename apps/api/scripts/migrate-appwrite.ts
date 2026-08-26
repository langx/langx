/**
 * ETL — reservation step (Faz 2 of the plan). Reads v1's Appwrite profile
 * collection and populates `handleReservations` so a returning v1 user's
 * verified v2 email can claim their old @handle. Does NOT touch
 * profiles/avatars — that's the heavier Faz 11 step, run once near cutover.
 *
 * Idempotent and re-runnable by design: v1 stayed live while this ran
 * against it historically, and even now a second run must be safe. Every
 * write is `updateOne({handle}, {$set: <safe fields only>}, {upsert: true})`
 * — `claimedBy`/`claimedAt` are never touched, so re-running never un-claims
 * a handle a real v2 user already took.
 *
 * Confirmed against the live v1 instance (2026-08-26): 4787 Auth accounts,
 * 3479 profile documents. A profile document's `$id` equals its Auth user's
 * `$id` (verified directly, not assumed) — there is no separate foreign-key
 * field. `Users.list()` can't filter by `$id`, so this fetches every user
 * into memory once (paginated) rather than doing 3479+ individual lookups.
 *
 * Usage:
 *   pnpm --filter @langx/api exec tsx scripts/migrate-appwrite.ts           # dry run — prints a summary, writes nothing
 *   pnpm --filter @langx/api exec tsx scripts/migrate-appwrite.ts --apply   # writes to handleReservations
 */
import { Client, Databases, Query, Users } from 'node-appwrite'
import { connectToDatabase } from '../src/db/client'
import { COLLECTIONS } from '../src/db/collections'
import { hashLegacyEmail } from '../src/modules/handles/legacyEmailHash'
import { loadEnv } from '../src/env'
import { handleSchema } from '@langx/shared'

const DATABASE_ID = '650750f16cd0c482bb83' // APP_DATABASE, langx/constants/config.js
const USERS_COLLECTION = '65103e2d3a6b4d9494c8' // USERS_COLLECTION, same file
const PAGE_SIZE = 100
const RESERVATION_TTL_MS = 365 * 24 * 60 * 60 * 1000 // 12 months, matches the plan's default

interface AppwriteProfileDoc {
  $id: string
  username?: string | undefined
}

async function fetchAllUserEmails(users: Users): Promise<Map<string, string>> {
  const emailById = new Map<string, string>()
  let cursor: string | undefined

  for (;;) {
    const queries = [Query.limit(PAGE_SIZE)]
    if (cursor) queries.push(Query.cursorAfter(cursor))

    const page = await users.list({ queries })
    for (const user of page.users) emailById.set(user.$id, user.email)

    if (page.users.length < PAGE_SIZE) break
    cursor = page.users.at(-1)?.$id
  }

  return emailById
}

async function* fetchAllProfileDocs(databases: Databases): AsyncGenerator<AppwriteProfileDoc> {
  let cursor: string | undefined

  for (;;) {
    const queries = [Query.limit(PAGE_SIZE)]
    if (cursor) queries.push(Query.cursorAfter(cursor))

    // Models.DefaultDocument carries an `any`-valued index signature — cast
    // just the two fields this script reads rather than modelling the whole
    // (large, legacy) v1 document shape.
    const page = await databases.listDocuments({
      databaseId: DATABASE_ID,
      collectionId: USERS_COLLECTION,
      queries,
    })
    for (const doc of page.documents) {
      yield { $id: doc.$id, username: doc.username as string | undefined }
    }

    if (page.documents.length < PAGE_SIZE) break
    cursor = page.documents.at(-1)?.$id
  }
}

interface Summary {
  seen: number
  noAuthUser: number
  noEmail: number
  badHandleFormat: number
  handleCollision: number
  wouldWrite: number
  written: number
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply')
  const env = loadEnv()

  if (!env.APPWRITE_ENDPOINT || !env.APPWRITE_PROJECT_ID || !env.APPWRITE_API_KEY) {
    throw new Error('APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID and APPWRITE_API_KEY are required')
  }
  if (!env.LEGACY_EMAIL_HASH_SALT) {
    throw new Error(
      'LEGACY_EMAIL_HASH_SALT is required — must match what the live claim check will use',
    )
  }

  const client = new Client()
    .setEndpoint(env.APPWRITE_ENDPOINT)
    .setProject(env.APPWRITE_PROJECT_ID)
    .setKey(env.APPWRITE_API_KEY)
  const databases = new Databases(client)
  const users = new Users(client)

  const { db, close } = await connectToDatabase(env.MONGODB_URI, env.MONGODB_DB)
  const reservations = db.collection(COLLECTIONS.handleReservations)

  console.log('Fetching all v1 Auth users…')
  const emailById = await fetchAllUserEmails(users)
  console.log(`  ${emailById.size} Auth users loaded`)

  const summary: Summary = {
    seen: 0,
    noAuthUser: 0,
    noEmail: 0,
    badHandleFormat: 0,
    handleCollision: 0,
    wouldWrite: 0,
    written: 0,
  }
  // A handle can only be reserved for one legacy user — if two v1 documents
  // somehow carry the same username (shouldn't happen given v1 presumably
  // enforced its own uniqueness, but this ETL doesn't get to assume that),
  // the first one wins and the rest are counted, not silently dropped.
  const seenHandles = new Set<string>()

  console.log(apply ? 'Applying to handleReservations…' : 'Dry run — no writes will happen…')

  for await (const doc of fetchAllProfileDocs(databases)) {
    summary.seen++

    const email = emailById.get(doc.$id)
    if (!email) {
      summary.noAuthUser++
      continue
    }
    if (!email.trim()) {
      summary.noEmail++
      continue
    }

    const handleResult = handleSchema.safeParse(doc.username ?? '')
    if (!handleResult.success) {
      summary.badHandleFormat++
      continue
    }
    const handle = handleResult.data

    if (seenHandles.has(handle)) {
      summary.handleCollision++
      continue
    }
    seenHandles.add(handle)

    summary.wouldWrite++
    if (!apply) continue

    await reservations.updateOne(
      { handle },
      {
        $set: {
          legacyEmailHash: hashLegacyEmail(email, env.LEGACY_EMAIL_HASH_SALT),
          legacyUserId: doc.$id,
          expiresAt: new Date(Date.now() + RESERVATION_TTL_MS),
        },
      },
      { upsert: true },
    )
    summary.written++
  }

  console.log('\n=== Summary ===')
  console.log(`Profile documents seen:        ${summary.seen}`)
  console.log(`No matching Auth user:         ${summary.noAuthUser}`)
  console.log(`Auth user has no email:        ${summary.noEmail}`)
  console.log(`Username fails v2 handle format: ${summary.badHandleFormat}`)
  console.log(`Duplicate handle within v1 data: ${summary.handleCollision}`)
  console.log(`Would reserve:                 ${summary.wouldWrite}`)
  if (apply) console.log(`Actually written:              ${summary.written}`)
  else console.log('\n(dry run — re-run with --apply to write)')

  await close()
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
