/**
 * Puts v1 pictures onto profiles the ETL can no longer reach.
 *
 * `migrate-profiles.ts` skips every record whose `restoredBy` is set, and
 * `markRestored` makes a restore a one-shot — so someone who came back before
 * the media pass had no path, anywhere in the system, by which their old
 * pictures could ever reach their profile. `inspect-legacy-coverage.ts` names
 * this in its own doc comment. This is the script it names.
 *
 * Two halves, and either can be run alone:
 *
 *   1. copy anything missing out of the backup onto `legacyProfiles`, exactly
 *      as the ETL would have — but without the `restoredBy` skip;
 *   2. apply what is staged onto the real profile, through the same
 *      `applyLegacyMedia` rule the restore path uses, so a picture somebody
 *      has since chosen for themselves is never overwritten.
 *
 * `--restored-only` skips half 1 and needs no Appwrite and no backup. It is
 * the fast path for records that *were* staged with media before their owner
 * returned.
 *
 * Idempotent and re-runnable. `restoredBy` and `restoredAt` are never written.
 *
 *   pnpm --filter @langx/api exec tsx scripts/backfill-legacy-media.ts            # dry run
 *     ... --apply --media-dir <path>      # copy missing bytes and write
 *     ... --apply --restored-only         # only re-apply what is already staged
 *     ... --handle <handle>               # one person, for the first run
 *     ... --limit 25
 */
import { Client, Databases, Storage } from 'node-appwrite'
import { connectToDatabase } from '../src/db/client'
import { COLLECTIONS } from '../src/db/collections'
import { loadEnv } from '../src/env'
import { buildBackupIndex, mediaDirFrom } from '../src/lib/legacyMediaBackup'
import { copyLegacyFile } from '../src/lib/legacyMediaCopy'
import { applyLegacyMedia, type LegacyProfile } from '../src/modules/handles/legacyProfiles'
import { createStorageProvider } from '../src/storage/createStorageProvider'
import { supportsPut } from '../src/storage/StorageProvider'

const DATABASE_ID = '650750f16cd0c482bb83'
const USERS_COLLECTION = '65103e2d3a6b4d9494c8'
const USER_BUCKET = '6515f94d20becd47cb40'
/** See `migrate-profiles.ts` — the grey silhouette, not a picture anyone chose. */
const V1_DEFAULT_AVATAR_ID = '652d582c65bb47ac5de0'

interface Summary {
  seen: number
  /** Records whose owner has come back; the only ones half 2 can touch. */
  restored: number
  avatarsCopied: number
  photosCopied: number
  /** Referenced by v1, absent from the backup — the bytes no longer exist. */
  mediaMissing: number
  defaultAvatars: number
  mediaFailures: number
  profilesGivenAvatar: number
  profilesGivenPhotos: number
  /** Restored records with nothing staged to give. */
  nothingToApply: number
}

function argOf(flag: string): string | undefined {
  const at = process.argv.indexOf(flag)
  return at >= 0 ? process.argv[at + 1] : undefined
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply')
  const restoredOnly = process.argv.includes('--restored-only')
  const handle = argOf('--handle')
  const limitArg = argOf('--limit')
  const limit = limitArg ? Number(limitArg) : Number.POSITIVE_INFINITY
  const mediaDir = mediaDirFrom(process.argv)

  const env = loadEnv()
  const backup = mediaDir ? buildBackupIndex(mediaDir) : undefined
  if (backup) {
    console.log(
      `Media backup: ${backup.filesSeen} files in ${backup.directories} directories, ` +
        `${backup.byId.size} ids indexed` +
        `${backup.collisions > 0 ? `, ${backup.collisions} collisions` : ''} (${mediaDir})`,
    )
  }

  let appwrite: { databases: Databases; storage: Storage } | undefined
  let put: ((key: string, body: Uint8Array, type: string) => Promise<string>) | undefined
  if (!restoredOnly) {
    if (!env.APPWRITE_ENDPOINT || !env.APPWRITE_PROJECT_ID || !env.APPWRITE_API_KEY) {
      throw new Error(
        'APPWRITE_* are required to look up v1 file ids. Re-run with --restored-only to ' +
          'apply what is already staged without touching v1.',
      )
    }
    const provider = createStorageProvider(env)
    if (!supportsPut(provider)) {
      // The same refusal the ETL makes: staging nothing and calling it a
      // success is the failure this whole part exists to undo.
      throw new Error('Storage is not configured, so nothing can be copied. Set STORAGE_* in .env.')
    }
    put = provider.putObject.bind(provider)
    const client = new Client()
      .setEndpoint(env.APPWRITE_ENDPOINT)
      .setProject(env.APPWRITE_PROJECT_ID)
      .setKey(env.APPWRITE_API_KEY)
    appwrite = { databases: new Databases(client), storage: new Storage(client) }
  }

  const { db, close } = await connectToDatabase(env.MONGODB_URI, env.MONGODB_DB)
  const legacyProfiles = db.collection<LegacyProfile>(COLLECTIONS.legacyProfiles)

  console.log(
    apply
      ? `Applying${restoredOnly ? ' (staged media only)' : ' with byte copy'}…`
      : 'Dry run — no writes, no uploads…',
  )

  const summary: Summary = {
    seen: 0,
    restored: 0,
    avatarsCopied: 0,
    photosCopied: 0,
    mediaMissing: 0,
    defaultAvatars: 0,
    mediaFailures: 0,
    profilesGivenAvatar: 0,
    profilesGivenPhotos: 0,
    nothingToApply: 0,
  }

  try {
    const filter = {
      ...(handle ? { handle } : {}),
      // `--restored-only` is about the records the ETL cannot reach; every
      // other record is still the ETL's job and is left to it.
      ...(restoredOnly ? { restoredBy: { $exists: true } } : {}),
    }
    const cursor = legacyProfiles.find(filter)
    for await (const record of cursor) {
      if (summary.seen >= limit) break
      summary.seen++
      if (record.restoredBy) summary.restored++

      // --- half 1: bytes onto the staging record ---------------------------
      let avatarUrl = record.avatarUrl
      const photos = [...record.photos]
      if (appwrite && put) {
        let doc: { profilePic?: unknown; otherPics?: unknown } | undefined
        try {
          doc = (await appwrite.databases.getDocument({
            databaseId: DATABASE_ID,
            collectionId: USERS_COLLECTION,
            documentId: record._id,
          })) as { profilePic?: unknown; otherPics?: unknown }
        } catch {
          // A v1 document that has gone is not an error here: there is simply
          // nothing left to copy, which is the same answer as an empty backup.
          summary.mediaFailures++
        }

        const v1Avatar = typeof doc?.profilePic === 'string' ? doc.profilePic : undefined
        if (v1Avatar === V1_DEFAULT_AVATAR_ID) {
          summary.defaultAvatars++
        } else if (v1Avatar && !avatarUrl) {
          try {
            const url = apply
              ? await copyLegacyFile(
                  { storage: appwrite.storage, put, backup },
                  {
                    bucketId: USER_BUCKET,
                    fileId: v1Avatar,
                    key: `legacy/${record._id}/avatar`,
                  },
                )
              : backup?.byId.has(v1Avatar)
                ? 'dry-run'
                : null
            if (url) {
              avatarUrl = url
              summary.avatarsCopied++
            } else {
              summary.mediaMissing++
            }
          } catch {
            summary.mediaFailures++
          }
        }

        const otherPics = Array.isArray(doc?.otherPics) ? (doc.otherPics as unknown[]) : []
        // Keyed by the slot the photo was written to, not by count — the same
        // resume guard the ETL uses, and for the same reason: counting would
        // copy the same picture twice after a partial run.
        const alreadyCopied = new Set(
          photos.flatMap((photo) => {
            const slot = /\/photo-(\d+)\.[a-z0-9]+$/i.exec(photo.url)
            return slot?.[1] ? [Number(slot[1])] : []
          }),
        )
        for (const [index, fileId] of otherPics.entries()) {
          if (alreadyCopied.has(index)) continue
          if (typeof fileId !== 'string' || !fileId) continue
          try {
            const url = apply
              ? await copyLegacyFile(
                  { storage: appwrite.storage, put, backup },
                  {
                    bucketId: USER_BUCKET,
                    fileId,
                    key: `legacy/${record._id}/photo-${index}`,
                  },
                )
              : backup?.byId.has(fileId)
                ? 'dry-run'
                : null
            if (url) {
              if (apply) photos.push({ url })
              summary.photosCopied++
            } else {
              summary.mediaMissing++
            }
          } catch {
            summary.mediaFailures++
          }
        }

        if (apply && (avatarUrl !== record.avatarUrl || photos.length !== record.photos.length)) {
          // Never `restoredBy`/`restoredAt`: this script must not be able to
          // un-restore a profile or claim one.
          await legacyProfiles.updateOne(
            { _id: record._id },
            { $set: { ...(avatarUrl ? { avatarUrl } : {}), photos } },
          )
        }
      }

      // --- half 2: the staging record onto the real profile ----------------
      if (!record.restoredBy) continue
      const staged = { ...(avatarUrl ? { avatarUrl } : {}), photos }
      if (!staged.avatarUrl && staged.photos.length === 0) {
        summary.nothingToApply++
        continue
      }
      if (!apply) continue
      const written = await applyLegacyMedia(db, record.restoredBy, staged, new Date())
      if (written.avatar) summary.profilesGivenAvatar++
      if (written.photos > 0) summary.profilesGivenPhotos++
    }

    console.log('\n=== Summary ===')
    console.log(`Records seen:                    ${summary.seen}`)
    console.log(`  ...already restored by a user: ${summary.restored}`)
    if (!restoredOnly) {
      console.log(`Avatars copied:                  ${summary.avatarsCopied}`)
      console.log(`Gallery photos copied:           ${summary.photosCopied}`)
      console.log(`Bytes gone (not in the backup):  ${summary.mediaMissing}`)
      console.log(`v1 default avatar, not copied:   ${summary.defaultAvatars}`)
      console.log(`Lookup/copy failures:            ${summary.mediaFailures}`)
    }
    console.log(`Profiles given an avatar:        ${summary.profilesGivenAvatar}`)
    console.log(`Profiles given a gallery:        ${summary.profilesGivenPhotos}`)
    console.log(`Restored, nothing staged to give:${String(summary.nothingToApply).padStart(5)}`)
    if (!apply) console.log('\n(dry run — re-run with --apply to write)')
  } finally {
    await close()
  }
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
