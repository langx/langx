import type { Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import { supportsPut, type StorageProvider } from '../../storage/StorageProvider'

/**
 * How long a signed-for file may sit unsent before it is deleted.
 *
 * The client uploads and sends in one go — the URL itself lasts five minutes,
 * and a failed send re-uploads rather than reusing the file — so a day is far
 * more than a real send needs, and short enough that what is abandoned does
 * not accumulate.
 */
export const UNSENT_UPLOAD_GRACE_MS = 24 * 60 * 60 * 1000

/** Per tick. The backlog drains over a few hours rather than in one burst. */
const SWEEP_BATCH = 500

/**
 * A chat attachment that was signed for and that no message names yet.
 *
 * Why it exists: the chat prefix is keyed by conversation, not by uploader,
 * and the account purge finds chat files through the message rows that name
 * them. A file uploaded and never sent has neither, so before this nothing
 * could ever find it again and it stayed in the bucket for good.
 */
export interface PendingUpload {
  /** The public URL, which is what a message records and so what a send claims by. */
  _id: string
  /** The object key, kept rather than re-derived so a changed base URL cannot orphan it. */
  key: string
  createdAt: Date
}

function collection(db: Db) {
  return db.collection<PendingUpload>(COLLECTIONS.pendingUploads)
}

/** Called as the upload URL is signed, before it is handed out. */
export async function recordPendingUpload(
  db: Db,
  upload: { url: string; key: string },
  now: Date = new Date(),
): Promise<void> {
  await collection(db).insertOne({ _id: upload.url, key: upload.key, createdAt: now })
}

/**
 * The files a message is about to name are no longer the sweep's.
 *
 * Called *before* the message is written, not after. Claimed and then never
 * sent leaves a file in the bucket, which is what happened to every file
 * before this; written and then never claimed would let the sweep delete a
 * file a message shows, which is worse.
 */
export async function claimPendingUploads(db: Db, urls: readonly string[]): Promise<void> {
  if (urls.length === 0) return
  await collection(db).deleteMany({ _id: { $in: [...urls] } })
}

/**
 * Deletes the files nobody sent within `UNSENT_UPLOAD_GRACE_MS`.
 *
 * Object first, row second: a delete that fails leaves the row for the next
 * tick to retry, where the other order would forget the file. `deleteObject`
 * is idempotent, so two instances on the same row cost a redundant call and
 * nothing else.
 */
export async function sweepUnsentUploads(
  db: Db,
  storage: StorageProvider,
  options: { now?: Date } = {},
): Promise<{ deleted: number }> {
  if (!supportsPut(storage)) return { deleted: 0 }
  const now = options.now ?? new Date()
  const cutoff = new Date(now.getTime() - UNSENT_UPLOAD_GRACE_MS)

  const rows = await collection(db)
    .find({ createdAt: { $lte: cutoff } })
    .sort({ createdAt: 1 })
    .limit(SWEEP_BATCH)
    .toArray()

  let deleted = 0
  for (const row of rows) {
    try {
      await storage.deleteObject(row.key)
    } catch {
      continue
    }
    await collection(db).deleteOne({ _id: row._id })
    deleted++
  }
  return { deleted }
}
