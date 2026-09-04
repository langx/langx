/**
 * Everything the system knows about one v1 person's pictures, in one place.
 *
 * Read-only. `inspect-legacy-coverage.ts` answers "how many"; this answers
 * "why this one", which used to require reading four files and guessing
 * between five different causes that all look identical from the app:
 *
 *   1. never staged             — the ETL skipped the record
 *   2. staged but not applied   — the media is on `legacyProfiles`, not on the
 *                                 profile (the restore happened first)
 *   3. applied but unreachable  — the object 404s in our own bucket
 *   4. the bytes are gone       — v1 references a file the backup does not have
 *   5. it was v1's placeholder  — there was never a picture to lose
 *
 * Appwrite is optional: without it (or with it switched off) the v1 file ids
 * are simply unknown and the rest still prints, which is the difference
 * between a diagnostic and a second thing that can fail.
 *
 *   pnpm --filter @langx/api exec tsx --env-file=../../.env --env-file=../../.env.prod \
 *     scripts/inspect-legacy-profile.ts --handle <handle> [--media-dir <path>]
 */
import { Client, Databases, Storage } from 'node-appwrite'
import { connectToDatabase } from '../src/db/client'
import { COLLECTIONS } from '../src/db/collections'
import { loadEnv } from '../src/env'
import { buildBackupIndex, mediaDirFrom } from '../src/lib/legacyMediaBackup'
import type { LegacyProfile } from '../src/modules/handles/legacyProfiles'
import type { Profile } from '../src/modules/profiles/profiles'

const DATABASE_ID = '650750f16cd0c482bb83'
const USERS_COLLECTION = '65103e2d3a6b4d9494c8'
const USER_BUCKET = '6515f94d20becd47cb40'
/** See `migrate-profiles.ts`: 2277 of 3497 v1 profiles point at this one file. */
const V1_DEFAULT_AVATAR_ID = '652d582c65bb47ac5de0'

function argOf(flag: string): string | undefined {
  const at = process.argv.indexOf(flag)
  return at >= 0 ? process.argv[at + 1] : undefined
}

/** A HEAD against our own bucket: is the object we recorded actually there? */
async function head(url: string): Promise<string> {
  try {
    const response = await fetch(url, { method: 'HEAD' })
    return `${response.status} ${response.headers.get('content-type') ?? '—'}`
  } catch (error) {
    return `unreachable (${error instanceof Error ? error.message : 'unknown'})`
  }
}

async function main(): Promise<void> {
  const handle = argOf('--handle')
  if (!handle) throw new Error('--handle <handle> is required')
  const mediaDir = mediaDirFrom(process.argv)

  const env = loadEnv()
  const backup = mediaDir ? buildBackupIndex(mediaDir) : undefined
  if (backup) {
    console.log(
      `backup            ${backup.filesSeen} files in ${backup.directories} directories` +
        `${backup.collisions > 0 ? `, ${backup.collisions} id collisions` : ''} (${mediaDir})`,
    )
  }

  const { db, close } = await connectToDatabase(env.MONGODB_URI, env.MONGODB_DB)
  try {
    const legacy = await db
      .collection<LegacyProfile>(COLLECTIONS.legacyProfiles)
      .findOne({ handle })
    console.log(`\n=== legacyProfiles (${handle}) ===`)
    if (!legacy) {
      console.log('  no staged record — this handle was never migrated')
    } else {
      console.log(`  _id (v1 doc)     ${legacy._id}`)
      console.log(`  restoredBy       ${legacy.restoredBy ?? '—'}`)
      console.log(`  restoredAt       ${legacy.restoredAt?.toISOString() ?? '—'}`)
      console.log(`  migratedAt       ${legacy.migratedAt.toISOString()}`)
      console.log(`  avatarUrl        ${legacy.avatarUrl ?? '—'}`)
      console.log(`  photos           ${legacy.photos.length}`)
      for (const photo of legacy.photos) console.log(`    ${photo.url}`)
    }

    console.log(`\n=== profiles ===`)
    const profile = legacy?.restoredBy
      ? await db.collection<Profile>(COLLECTIONS.profiles).findOne({ _id: legacy.restoredBy })
      : await db.collection<Profile>(COLLECTIONS.profiles).findOne({ handle })
    if (!profile) {
      console.log('  no v2 profile — nobody has claimed this handle back')
    } else {
      console.log(`  _id              ${String(profile._id)}`)
      console.log(`  avatarUrl        ${profile.avatarUrl ?? '—'}`)
      console.log(`  photos           ${profile.photos?.length ?? 0}`)
      for (const photo of profile.photos ?? []) console.log(`    ${photo.url}`)
      console.log(`  restoredFromV1   ${profile.restoredFromV1 ? 'yes' : 'no'}`)
    }

    console.log(`\n=== stored objects ===`)
    const stored = [
      ...(legacy?.avatarUrl ? [['legacy avatar', legacy.avatarUrl] as const] : []),
      ...(profile?.avatarUrl ? [['profile avatar', profile.avatarUrl] as const] : []),
      ...(legacy?.photos ?? []).map((p, i) => [`legacy photo ${i}`, p.url] as const),
      ...(profile?.photos ?? []).map((p, i) => [`profile photo ${i}`, p.url] as const),
    ]
    if (stored.length === 0) console.log('  none recorded anywhere')
    for (const [label, url] of stored) console.log(`  ${label.padEnd(16)} ${await head(url)}`)

    console.log(`\n=== v1 (Appwrite) ===`)
    if (!legacy) {
      console.log('  skipped — no staged record to look up')
    } else if (!env.APPWRITE_ENDPOINT || !env.APPWRITE_PROJECT_ID || !env.APPWRITE_API_KEY) {
      console.log('  skipped — APPWRITE_* not configured')
    } else {
      const client = new Client()
        .setEndpoint(env.APPWRITE_ENDPOINT)
        .setProject(env.APPWRITE_PROJECT_ID)
        .setKey(env.APPWRITE_API_KEY)
      const databases = new Databases(client)
      const storage = new Storage(client)
      try {
        const doc = (await databases.getDocument({
          databaseId: DATABASE_ID,
          collectionId: USERS_COLLECTION,
          documentId: legacy._id,
        })) as { profilePic?: unknown; otherPics?: unknown }
        const avatar = typeof doc.profilePic === 'string' ? doc.profilePic : undefined
        const others = Array.isArray(doc.otherPics) ? (doc.otherPics as unknown[]) : []
        console.log(
          `  profilePic       ${avatar ?? '—'}` +
            (avatar === V1_DEFAULT_AVATAR_ID ? '   ← v1 placeholder, never copied' : ''),
        )
        console.log(`  otherPics        ${others.length}`)

        const ids = [
          ...(avatar && avatar !== V1_DEFAULT_AVATAR_ID ? [avatar] : []),
          ...others.filter((id): id is string => typeof id === 'string' && id.length > 0),
        ]
        for (const fileId of ids) {
          const path = backup?.byId.get(fileId)
          let meta = 'metadata unavailable'
          try {
            const file = await storage.getFile({ bucketId: USER_BUCKET, fileId })
            meta = `${file.mimeType || '—'}  ${file.sizeOriginal} bytes`
          } catch {
            /* v1 keeps rows for files it can no longer serve; that is the point. */
          }
          console.log(`  ${fileId}  ${path ? `backup: ${path}` : 'NOT IN BACKUP'}  ${meta}`)
        }
      } catch (error) {
        console.log(`  lookup failed: ${error instanceof Error ? error.message : 'unknown'}`)
      }
    }
  } finally {
    await close()
  }
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
