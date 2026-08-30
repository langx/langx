/**
 * ETL — profile, avatar and gallery step (Faz 11 of the plan).
 *
 * Reads v1's Appwrite profile documents, maps them into v2's vocabulary, and
 * copies each user's profile picture and gallery photos out of Appwrite
 * Storage into our own bucket. The result is staged in `legacyProfiles`, not
 * written to `profiles` — v1's password hashes cannot be migrated, so every
 * returning user signs up again and gets a brand new user id. There is nothing
 * to key a real profile document on until that happens. Onboarding restores
 * from the staging record when the user claims their old handle (the same
 * email-hash proof `handleReservations` uses).
 *
 * **Idempotent.** Every write is an upsert keyed on the Appwrite document id,
 * and a record a v2 user has already restored (`restoredBy` set) is skipped
 * entirely — re-running must never overwrite a profile someone is now using.
 * Media is skipped when the destination object already exists in the staging
 * record, so a re-run after a partial failure only copies what is missing.
 *
 * The field mapping was built by reading the live v1 data, not the v1 source
 * (see scripts/inspect-v1.ts) — legacy collections keep fields the code
 * dropped and drop fields the code still writes.
 *
 * Usage:
 *   pnpm --filter @langx/api exec tsx scripts/migrate-profiles.ts                 # dry run
 *   pnpm --filter @langx/api exec tsx scripts/migrate-profiles.ts --apply         # write, media included
 *   pnpm --filter @langx/api exec tsx scripts/migrate-profiles.ts --apply --skip-media
 *   pnpm --filter @langx/api exec tsx scripts/migrate-profiles.ts --limit 25      # try a slice first
 */
import { handleSchema } from '@langx/shared'
import { Client, Databases, Query, Storage, Users } from 'node-appwrite'
import { connectToDatabase } from '../src/db/client'
import { COLLECTIONS } from '../src/db/collections'
import { loadEnv } from '../src/env'
import {
  isMatchable,
  mapLanguages,
  toBirthDate,
  toGender,
} from '../src/modules/handles/legacyMapping'
import type { LegacyProfile } from '../src/modules/handles/legacyProfiles'
import { hashLegacyEmail } from '../src/modules/handles/legacyEmailHash'
import { createStorageProvider } from '../src/storage/createStorageProvider'
import { supportsPut } from '../src/storage/StorageProvider'

const DATABASE_ID = '650750f16cd0c482bb83'
const USERS_COLLECTION = '65103e2d3a6b4d9494c8'
const USER_BUCKET = '6515f94d20becd47cb40' // "user" bucket — profilePic + otherPics
const WALLET_COLLECTION = '66622b8a000b305b236c'
const PAGE_SIZE = 100

interface V1Profile {
  $id: string
  username?: unknown
  name?: unknown
  aboutMe?: unknown
  birthdate?: unknown
  gender?: unknown
  country?: unknown
  countryCode?: unknown
  languages?: unknown
  profilePic?: unknown
  otherPics?: unknown
  streaks?: unknown
  lastSeen?: unknown
}

interface Summary {
  seen: number
  skippedRestored: number
  noAuthUser: number
  badHandle: number
  noLanguages: number
  staged: number
  withBalance: number
  avatarsCopied: number
  photosCopied: number
  mediaFailures: number
}

/**
 * Every v1 token balance, keyed by the same id the profile uses.
 *
 * Fetched once into memory rather than queried per profile: 1403 wallets is
 * nothing to hold, and the alternative is 3479 round trips to save it.
 */
async function fetchAllWallets(databases: Databases): Promise<Map<string, number>> {
  const balances = new Map<string, number>()
  let cursor: string | undefined
  for (;;) {
    const queries = [Query.limit(PAGE_SIZE)]
    if (cursor) queries.push(Query.cursorAfter(cursor))
    const page = await databases.listDocuments({
      databaseId: DATABASE_ID,
      collectionId: WALLET_COLLECTION,
      queries,
    })
    for (const doc of page.documents) {
      const balance = (doc as { balance?: unknown }).balance
      if (typeof balance === 'number' && balance > 0) balances.set(doc.$id, balance)
    }
    if (page.documents.length < PAGE_SIZE) break
    cursor = page.documents.at(-1)?.$id
  }
  return balances
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

async function* fetchProfiles(databases: Databases, limit: number): AsyncGenerator<V1Profile> {
  let cursor: string | undefined
  let yielded = 0
  for (;;) {
    const queries = [Query.limit(PAGE_SIZE)]
    if (cursor) queries.push(Query.cursorAfter(cursor))
    const page = await databases.listDocuments({
      databaseId: DATABASE_ID,
      collectionId: USERS_COLLECTION,
      queries,
    })
    for (const doc of page.documents) {
      yield doc
      if (++yielded >= limit) return
    }
    if (page.documents.length < PAGE_SIZE) break
    cursor = page.documents.at(-1)?.$id
  }
}

/** Appwrite serves the bytes; the extension is inferred from what it sends back. */
async function copyFile(
  storage: Storage,
  put: (key: string, body: Uint8Array, contentType: string) => Promise<string>,
  fileId: string,
  key: string,
): Promise<string> {
  const file = await storage.getFile({ bucketId: USER_BUCKET, fileId })
  const bytes = await storage.getFileDownload({ bucketId: USER_BUCKET, fileId })
  const contentType = file.mimeType || 'image/jpeg'
  const extension = contentType.split('/')[1]?.split('+')[0] ?? 'jpg'
  return put(`${key}.${extension}`, new Uint8Array(bytes), contentType)
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply')
  const skipMedia = process.argv.includes('--skip-media')
  const limitIndex = process.argv.indexOf('--limit')
  const limit = limitIndex >= 0 ? Number(process.argv[limitIndex + 1]) : Number.POSITIVE_INFINITY

  const env = loadEnv()
  if (!env.APPWRITE_ENDPOINT || !env.APPWRITE_PROJECT_ID || !env.APPWRITE_API_KEY) {
    throw new Error('APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID and APPWRITE_API_KEY are required')
  }
  if (!env.LEGACY_EMAIL_HASH_SALT) {
    throw new Error('LEGACY_EMAIL_HASH_SALT is required — must match the live claim check')
  }

  const storageProvider = createStorageProvider(env)
  const canCopyMedia = supportsPut(storageProvider)
  if (!skipMedia && !canCopyMedia) {
    // Fail loudly rather than quietly staging 3479 profiles with no pictures
    // and calling it a successful migration.
    throw new Error(
      'Storage is not configured, so avatars and gallery photos cannot be copied. ' +
        'Set STORAGE_* in .env, or re-run with --skip-media to stage text fields only.',
    )
  }

  const client = new Client()
    .setEndpoint(env.APPWRITE_ENDPOINT)
    .setProject(env.APPWRITE_PROJECT_ID)
    .setKey(env.APPWRITE_API_KEY)
  const databases = new Databases(client)
  const users = new Users(client)
  const storage = new Storage(client)

  const { db, close } = await connectToDatabase(env.MONGODB_URI, env.MONGODB_DB)
  const legacyProfiles = db.collection<LegacyProfile>(COLLECTIONS.legacyProfiles)

  console.log('Fetching v1 Auth users…')
  const emailById = await fetchAllUserEmails(users)
  console.log(`  ${emailById.size} Auth users loaded`)

  console.log('Fetching v1 token balances…')
  const balanceById = await fetchAllWallets(databases)
  console.log(`  ${balanceById.size} wallets with a positive balance`)
  console.log(
    apply
      ? `Applying${skipMedia ? ' (text only, media skipped)' : ' with media copy'}…`
      : 'Dry run — no writes, no uploads…',
  )

  const summary: Summary = {
    seen: 0,
    skippedRestored: 0,
    noAuthUser: 0,
    badHandle: 0,
    noLanguages: 0,
    staged: 0,
    withBalance: 0,
    avatarsCopied: 0,
    photosCopied: 0,
    mediaFailures: 0,
  }

  for await (const doc of fetchProfiles(databases, limit)) {
    summary.seen++

    const email = emailById.get(doc.$id)
    if (!email?.trim()) {
      summary.noAuthUser++
      continue
    }

    const handleResult = handleSchema.safeParse(doc.username ?? '')
    if (!handleResult.success) {
      summary.badHandle++
      continue
    }

    const existing = await legacyProfiles.findOne({ _id: doc.$id })
    if (existing?.restoredBy) {
      // Someone is already using this data. Overwriting it would silently
      // revert edits they have made since.
      summary.skippedRestored++
      continue
    }

    const languages = mapLanguages(doc.languages)
    if (!isMatchable(languages)) {
      // v2's discovery is built entirely on mutual fit; a profile missing
      // either side of it cannot be matched and is not worth staging.
      summary.noLanguages++
      continue
    }

    const record: LegacyProfile = {
      _id: doc.$id,
      handle: handleResult.data,
      legacyEmailHash: hashLegacyEmail(email, env.LEGACY_EMAIL_HASH_SALT),
      nativeLanguages: languages.nativeLanguages,
      learning: languages.learning,
      photos: existing?.photos ?? [],
      migratedAt: new Date(),
    }
    if (typeof doc.name === 'string' && doc.name.trim()) record.displayName = doc.name.trim()
    if (typeof doc.aboutMe === 'string' && doc.aboutMe.trim()) record.bio = doc.aboutMe.trim()
    const birthDate = toBirthDate(doc.birthdate)
    if (birthDate !== undefined) record.birthDate = birthDate
    const gender = toGender(doc.gender)
    if (gender !== undefined) record.gender = gender
    if (typeof doc.country === 'string' && doc.country) record.country = doc.country
    if (typeof doc.countryCode === 'string' && doc.countryCode) {
      record.countryCode = doc.countryCode.toUpperCase()
    }
    if (typeof doc.lastSeen === 'string') record.lastSeenAt = new Date(doc.lastSeen)
    const streaks = doc.streaks as { daystreak?: unknown } | undefined
    if (typeof streaks?.daystreak === 'number') record.frozenStreak = streaks.daystreak
    // Credited at `TOKEN_RULES.legacyTokenDivisor` when they come back, not
    // here — staging the raw balance keeps the divisor a decision that can
    // still change without re-running the ETL.
    const balance = balanceById.get(doc.$id)
    if (balance !== undefined) record.legacyTokenBalance = balance
    if (existing?.avatarUrl) record.avatarUrl = existing.avatarUrl

    if (apply && !skipMedia && canCopyMedia) {
      const put = storageProvider.putObject.bind(storageProvider)
      // Only copy what is not already copied — a re-run after a partial
      // failure should cost the bandwidth of the remainder, not of everything.
      if (typeof doc.profilePic === 'string' && doc.profilePic && !record.avatarUrl) {
        try {
          record.avatarUrl = await copyFile(
            storage,
            put,
            doc.profilePic,
            `legacy/${doc.$id}/avatar`,
          )
          summary.avatarsCopied++
        } catch {
          summary.mediaFailures++
        }
      }

      const otherPics = Array.isArray(doc.otherPics) ? (doc.otherPics as unknown[]) : []
      const alreadyCopied = record.photos.length
      for (const [index, fileId] of otherPics.entries()) {
        if (index < alreadyCopied) continue
        if (typeof fileId !== 'string' || !fileId) continue
        try {
          const url = await copyFile(storage, put, fileId, `legacy/${doc.$id}/photo-${index}`)
          record.photos.push({ url })
          summary.photosCopied++
        } catch {
          summary.mediaFailures++
        }
      }
    }

    summary.staged++
    if (record.legacyTokenBalance !== undefined) summary.withBalance++
    if (!apply) continue

    // `$set` of the whole mapped record, but never `restoredBy`/`restoredAt` —
    // those belong to the v2 side and this script must not be able to
    // un-restore a profile.
    await legacyProfiles.updateOne({ _id: doc.$id }, { $set: record }, { upsert: true })
  }

  console.log('\n=== Summary ===')
  console.log(`Profile documents seen:          ${summary.seen}`)
  console.log(`Skipped (already restored by v2): ${summary.skippedRestored}`)
  console.log(`No matching Auth user/email:     ${summary.noAuthUser}`)
  console.log(`Username fails v2 handle format: ${summary.badHandle}`)
  console.log(`No usable language pair:         ${summary.noLanguages}`)
  console.log(`Staged:                          ${summary.staged}`)
  console.log(`  ...of those, with a balance:   ${summary.withBalance}`)
  if (apply && !skipMedia) {
    console.log(`Avatars copied:                  ${summary.avatarsCopied}`)
    console.log(`Gallery photos copied:           ${summary.photosCopied}`)
    console.log(`Media failures:                  ${summary.mediaFailures}`)
  }
  if (!apply) console.log('\n(dry run — re-run with --apply to write)')

  await close()
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
