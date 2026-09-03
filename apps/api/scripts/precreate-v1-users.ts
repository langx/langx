/**
 * Opens a v2 `user` row for every v1 account, so its owner can come back
 * through "forgot password" or Google/Apple instead of having to guess that
 * signing up again is the way in.
 *
 * Why this exists, and why every row is created verified, is in
 * `src/modules/handles/legacyPrecreate.ts`. What this file decides is *who*
 * gets a row: **every v1 Auth user with an email that is not blocked**, so
 * that nobody who once had an account is asked to make a new one. Whether v1
 * had verified the address does not matter — the row has no password, so a
 * reset link or a provider has to prove the address before it can be used —
 * and it is only reported.
 *
 * Accounts with something **staged** (a `legacyProfiles` document or a
 * `handleReservations` row keyed on the Appwrite id) get one extra check: the
 * hash of the live email has to equal what the ETL stored. A mismatch means
 * the row would be opened under an address the restore can never match, so
 * it is counted and skipped rather than written. An Auth user with nothing
 * staged had no profile in v1; the row is opened all the same, and they go
 * through onboarding as a new user would, under the account they remember.
 *
 * Accounts their owners **deleted** in v1 (Appwrite `status: false`, which is
 * what v1's "delete account" did — it never hard-deleted) get no row: a
 * deleted account must not come back as a live one. Their address is kept in
 * `v1DeletedContacts` instead, for one announcement and nothing else, and
 * that collection is meant to be dropped once it has gone out.
 *
 * Idempotent and re-runnable: an address that already has a `user` — from an
 * earlier run, or from a real sign-up that got there first — is left exactly
 * as it is. Needs the live v1 Appwrite (`APPWRITE_*`) for the plaintext
 * emails, which the staging tables deliberately do not carry.
 *
 * Usage (dry run prints a summary and writes nothing):
 *   pnpm --filter @langx/api exec tsx --env-file=../../.env --env-file=../../.env.prod scripts/precreate-v1-users.ts
 *   pnpm --filter @langx/api exec tsx --env-file=../../.env --env-file=../../.env.prod scripts/precreate-v1-users.ts --apply
 */
import { Client, Query, Users } from 'node-appwrite'
import { connectToDatabase } from '../src/db/client'
import { COLLECTIONS } from '../src/db/collections'
import { loadEnv } from '../src/env'
import { hashLegacyEmail } from '../src/modules/handles/legacyEmailHash'
import { insertPrecreatedUser, normalizeEmail } from '../src/modules/handles/legacyPrecreate'
import type { LegacyProfile } from '../src/modules/handles/legacyProfiles'

const PAGE_SIZE = 100

interface DeletedContact {
  /** The Appwrite user id. */
  _id: string
  email: string
  name: string
  legacyUserId: string
  recordedAt: Date
}

interface V1User {
  id: string
  email: string
  name: string
  emailVerification: boolean
  /** Appwrite's "blocked" switch, inverted: `false` means the account was disabled. */
  status: boolean
}

async function* fetchAllUsers(users: Users): AsyncGenerator<V1User> {
  let cursor: string | undefined
  for (;;) {
    const queries = [Query.limit(PAGE_SIZE)]
    if (cursor) queries.push(Query.cursorAfter(cursor))
    const page = await users.list({ queries })
    for (const user of page.users) {
      yield {
        id: user.$id,
        email: user.email,
        name: user.name,
        emailVerification: user.emailVerification,
        status: user.status,
      }
    }
    if (page.users.length < PAGE_SIZE) break
    cursor = page.users.at(-1)?.$id
  }
}

interface Reservation {
  handle: string
  legacyEmailHash: string
  legacyUserId?: string
}

interface Summary {
  seen: number
  noEmail: number
  blockedInV1: number
  deletedContactsKept: number
  /** Informational: opened all the same, restore has nothing to find. */
  notStaged: number
  /** Informational: opened all the same, see the module doc. */
  unverifiedInV1: number
  hashMismatch: number
  alreadyInV2: number
  wouldCreate: number
  created: number
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply')
  const env = loadEnv()

  if (!env.APPWRITE_ENDPOINT || !env.APPWRITE_PROJECT_ID || !env.APPWRITE_API_KEY) {
    throw new Error('APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID and APPWRITE_API_KEY are required')
  }
  if (!env.LEGACY_EMAIL_HASH_SALT) {
    throw new Error('LEGACY_EMAIL_HASH_SALT is required — must match what the ETL hashed with')
  }
  const salt = env.LEGACY_EMAIL_HASH_SALT

  const client = new Client()
    .setEndpoint(env.APPWRITE_ENDPOINT)
    .setProject(env.APPWRITE_PROJECT_ID)
    .setKey(env.APPWRITE_API_KEY)
  const users = new Users(client)

  const { db, close } = await connectToDatabase(env.MONGODB_URI, env.MONGODB_DB)
  console.log(`Database: ${env.MONGODB_DB}`)

  // Both staging tables, keyed on the Appwrite id. The profile carries the
  // display name, which is the nicest thing to call the account until its
  // owner is back to say otherwise.
  const profilesById = new Map<string, LegacyProfile>()
  for await (const profile of db.collection<LegacyProfile>(COLLECTIONS.legacyProfiles).find()) {
    profilesById.set(profile._id, profile)
  }
  const reservationsById = new Map<string, Reservation>()
  for await (const reservation of db
    .collection<Reservation>(COLLECTIONS.handleReservations)
    .find({ legacyUserId: { $exists: true } })) {
    if (reservation.legacyUserId) reservationsById.set(reservation.legacyUserId, reservation)
  }
  console.log(
    `Staged: ${profilesById.size} legacy profiles, ${reservationsById.size} handle reservations`,
  )

  const summary: Summary = {
    seen: 0,
    noEmail: 0,
    blockedInV1: 0,
    deletedContactsKept: 0,
    notStaged: 0,
    unverifiedInV1: 0,
    hashMismatch: 0,
    alreadyInV2: 0,
    wouldCreate: 0,
    created: 0,
  }

  console.log(apply ? 'Applying to `user`…' : 'Dry run — no writes will happen…')
  console.log('Fetching all v1 Auth users…')

  for await (const user of fetchAllUsers(users)) {
    summary.seen++

    const email = normalizeEmail(user.email ?? '')
    if (!email) {
      summary.noEmail++
      continue
    }
    if (!user.status) {
      summary.blockedInV1++
      if (apply) {
        const kept = await db.collection<DeletedContact>(COLLECTIONS.v1DeletedContacts).updateOne(
          { _id: user.id },
          {
            $setOnInsert: { email, name: user.name, legacyUserId: user.id, recordedAt: new Date() },
          },
          { upsert: true },
        )
        if (kept.upsertedCount > 0) summary.deletedContactsKept++
      }
      continue
    }

    const profile = profilesById.get(user.id)
    const reservation = reservationsById.get(user.id)
    if (!profile && !reservation) summary.notStaged++
    if (!user.emailVerification) summary.unverifiedInV1++

    const staged = profile?.legacyEmailHash ?? reservation?.legacyEmailHash
    if (staged && staged !== hashLegacyEmail(email, salt)) {
      summary.hashMismatch++
      console.warn(`  hash mismatch for v1 user ${user.id} — skipped`)
      continue
    }

    const name = profile?.displayName || profile?.handle || reservation?.handle || user.name
    const input = { email, name: name || email.split('@')[0] || 'LangX', legacyUserId: user.id }

    if (!apply) {
      const exists = await db
        .collection(COLLECTIONS.user)
        .findOne({ email }, { projection: { _id: 1 } })
      if (exists) summary.alreadyInV2++
      else summary.wouldCreate++
      continue
    }

    const { outcome } = await insertPrecreatedUser(db, input)
    if (outcome === 'exists') summary.alreadyInV2++
    else summary.created++
  }

  console.log('\n=== Summary ===')
  console.log(`v1 Auth users seen:               ${summary.seen}`)
  console.log(`No email on the Auth user:        ${summary.noEmail}`)
  console.log(`Deleted in v1 (no row opened):    ${summary.blockedInV1}`)
  if (apply) console.log(`  …of which newly kept as contacts: ${summary.deletedContactsKept}`)
  console.log(`Nothing staged (opened anyway):   ${summary.notStaged}`)
  console.log(`Unverified in v1 (opened anyway): ${summary.unverifiedInV1}`)
  console.log(`Email hash does not match ETL:    ${summary.hashMismatch}`)
  console.log(`Already have a v2 user:           ${summary.alreadyInV2}`)
  if (apply) console.log(`Created:                          ${summary.created}`)
  else {
    console.log(`Would create:                     ${summary.wouldCreate}`)
    console.log('\n(dry run — re-run with --apply to write)')
  }

  await close()
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
