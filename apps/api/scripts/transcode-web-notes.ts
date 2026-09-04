/**
 * Converts the voice notes an iPhone cannot decode into ones it can.
 *
 * Those are WebM/Opus, and they are **not** reliably labelled as such: the note
 * this was written for was stored as `audio/m4a`, under a `.m4a` key, with
 * Opus inside, because an older web build labelled every recording `audio/m4a`
 * whatever the browser had produced. So every voice note is fetched and judged
 * on its bytes; the ones already playable are left exactly as they are.
 *
 * Four collections and two shapes: `messages`, `posts` and `postCorrections`
 * keep a list in `attachments` with the first file repeated in `media`, while
 * a `pronunciationAnswers` row has `media` and `slowMedia` as separate fields.
 * Both are walked here rather than in `normalizeAttachments`, which takes a
 * list and knows nothing about rows.
 *
 * Idempotent: a row whose files are already `audio/mp4` matches nothing. Safe
 * to re-run after a failure, since each row is written only once its new
 * object exists.
 *
 *   pnpm --filter @langx/api exec tsx scripts/transcode-web-notes.ts        # dry run
 *     ... --confirm         # actually convert and write
 *     ... --limit 25
 *
 * Against production, with the overlay — `.env.prod` is the small set of
 * values that differ, and a later --env-file wins:
 *
 *   pnpm exec tsx --env-file=../../.env --env-file=../../.env.prod \
 *     scripts/transcode-web-notes.ts --confirm
 */
import { execFile } from 'node:child_process'
import type { Db, Document } from 'mongodb'
import type { Media } from '@langx/shared'
import { connectToDatabase } from '../src/db/client'
import { COLLECTIONS } from '../src/db/collections'
import { loadEnv } from '../src/env'
import {
  createAttachmentNormalizer,
  type AttachmentNormalizer,
} from '../src/modules/media/transcodeAudio'
import { createStorageProvider } from '../src/storage/createStorageProvider'
import { supportsPut } from '../src/storage/StorageProvider'

/*
 * Every voice note, not the ones labelled WebM — the label is exactly what
 * cannot be trusted here. The first note this was written for said
 * `audio/m4a`, sat under a `.m4a` key, and was Opus inside; an older web build
 * labelled every recording `audio/m4a` whatever `MediaRecorder` produced. The
 * normaliser fetches each file and decides on the bytes, and leaves anything
 * already playable alone.
 */
const ANY_AUDIO = { $regex: '^audio/' }

interface Summary {
  seen: number
  converted: number
  unchanged: number
}

/**
 * Whether the normaliser left this file alone.
 *
 * Not the URL by itself, which is what this asked first and got wrong on the
 * only row it had to get right: a mislabelled note is already under a `.m4a`
 * key, so the conversion lands on that same key and the URL does not move. The
 * bytes in the bucket had been replaced and the row was left saying
 * `audio/m4a`, 2,243 bytes, about a file that was now AAC and 2,031.
 */
function sameAttachment(next: Media, previous: Media | undefined): boolean {
  return (
    next.url === previous?.url &&
    next.contentType === previous.contentType &&
    next.sizeBytes === previous.sizeBytes
  )
}

function argOf(flag: string): string | undefined {
  const at = process.argv.indexOf(flag)
  return at >= 0 ? process.argv[at + 1] : undefined
}

/** The three collections that keep a list of attachments. */
async function convertLists(
  db: Db,
  collection: string,
  normalize: AttachmentNormalizer,
  confirm: boolean,
  limit: number,
  summary: Summary,
): Promise<void> {
  const rows = await db
    .collection<Document>(collection)
    .find({ 'attachments.contentType': ANY_AUDIO })
    .limit(limit)
    .toArray()

  for (const row of rows) {
    summary.seen += 1
    const attachments = (row.attachments ?? []) as Media[]
    if (!confirm) {
      console.log(`  would convert ${collection}/${String(row._id)}`)
      continue
    }
    const converted = await normalize(attachments)
    if (converted.every((item, index) => sameAttachment(item, attachments[index]))) {
      summary.unchanged += 1
      console.log(`  already playable ${collection}/${String(row._id)}`)
      continue
    }
    await db.collection<Document>(collection).updateOne(
      { _id: row._id },
      // `media` is the first file repeated, for builds that predate the list;
      // leaving it behind would keep the old URL alive on exactly the installs
      // least able to cope with it.
      { $set: { attachments: converted, ...(converted[0] ? { media: converted[0] } : {}) } },
    )
    summary.converted += 1
    console.log(`  converted ${collection}/${String(row._id)}`)
  }
}

/** The one collection where a recording is two fields rather than a list. */
async function convertAnswers(
  db: Db,
  normalize: AttachmentNormalizer,
  confirm: boolean,
  limit: number,
  summary: Summary,
): Promise<void> {
  const rows = await db
    .collection<Document>(COLLECTIONS.pronunciationAnswers)
    .find({ $or: [{ 'media.contentType': ANY_AUDIO }, { 'slowMedia.contentType': ANY_AUDIO }] })
    .limit(limit)
    .toArray()

  for (const row of rows) {
    summary.seen += 1
    const takes = [row.media as Media, ...(row.slowMedia ? [row.slowMedia as Media] : [])]
    if (!confirm) {
      console.log(`  would convert pronunciationAnswers/${String(row._id)}`)
      continue
    }
    const [media = takes[0], slowMedia] = await normalize(takes)
    if (!media || sameAttachment(media, takes[0])) {
      summary.unchanged += 1
      continue
    }
    await db
      .collection<Document>(COLLECTIONS.pronunciationAnswers)
      .updateOne({ _id: row._id }, { $set: { media, ...(slowMedia ? { slowMedia } : {}) } })
    summary.converted += 1
    console.log(`  converted pronunciationAnswers/${String(row._id)}`)
  }
}

async function main(): Promise<void> {
  const confirm = process.argv.includes('--confirm')
  const limit = Number(argOf('--limit') ?? 1000)

  const env = loadEnv(process.env)
  const storage = createStorageProvider(env)
  if (!supportsPut(storage)) {
    throw new Error('Storage is not configured — set the STORAGE_* variables')
  }

  const normalize = createAttachmentNormalizer(storage, env.FFMPEG_PATH, (error, message) => {
    console.warn(`  ${message}:`, error)
  })

  // Checked here rather than discovered a hundred rows in: without ffmpeg
  // every row comes back "unchanged", which reads like there was nothing to
  // do. The server is right to carry on without it; a script whose only job is
  // this conversion is not.
  await new Promise<void>((resolve, reject) => {
    execFile(env.FFMPEG_PATH, ['-version'], (error) =>
      error
        ? reject(new Error(`Cannot run ffmpeg at "${env.FFMPEG_PATH}" — set FFMPEG_PATH`))
        : resolve(),
    )
  })

  const { db, close } = await connectToDatabase(env.MONGODB_URI, env.MONGODB_DB)
  const summary: Summary = { seen: 0, converted: 0, unchanged: 0 }

  try {
    console.log(confirm ? 'Converting web voice notes…' : 'Dry run — nothing will be written.')
    for (const collection of [
      COLLECTIONS.messages,
      COLLECTIONS.posts,
      COLLECTIONS.postCorrections,
    ]) {
      await convertLists(db, collection, normalize, confirm, limit, summary)
    }
    await convertAnswers(db, normalize, confirm, limit, summary)
  } finally {
    await close()
  }

  console.log(summary)
  if (!confirm) console.log('Re-run with --confirm to write.')
}

await main()
