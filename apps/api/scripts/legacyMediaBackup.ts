/**
 * Where v1's uploaded bytes actually live now.
 *
 * v1's Appwrite still answers `getFile` — the rows are in its database, with a
 * size and a mime type — but its upload volume is empty and every
 * `getFileDownload` returns "File not found". Confirmed three ways on
 * 3 September 2026: 40 sampled avatars all failed to download, and the Docker
 * volume backing `/storage/uploads` on the droplet holds 4 KB.
 *
 * So the migration reads bytes from the DigitalOcean Spaces backup instead —
 * `do-spaces/languageXchange/storage/uploads/app-<project>` in the workspace,
 * passed to the ETL scripts as `--media-dir`. That copy is now the only one
 * there is, and it is not on the droplet: switching v1 off costs nothing more
 * than has already been lost.
 *
 * Metadata still comes from Appwrite. It has to: the backup stores files under
 * a bare id with no extension, so it cannot say whether a file is a PNG or a
 * voice note.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * File id → path on disk, flattened across every bucket folder.
 *
 * Deliberately not keyed by bucket, because the backup and the live project
 * disagree about which bucket a file belongs to: v1's placeholder avatar sits
 * under a bucket id the project no longer has. Appwrite ids are unique, so
 * flattening cannot collide and does find the files a per-bucket lookup misses.
 */
export function buildBackupIndex(root: string): Map<string, string> {
  const index = new Map<string, string>()
  for (const bucket of readdirSync(root, { withFileTypes: true })) {
    if (!bucket.isDirectory()) continue
    for (const file of readdirSync(join(root, bucket.name))) {
      index.set(file.split('.')[0] ?? file, join(root, bucket.name, file))
    }
  }
  return index
}

/** `null` when the backup does not have this file — the ordinary case, not a fault. */
export function readBackupBytes(index: Map<string, string>, fileId: string): Uint8Array | null {
  const path = index.get(fileId)
  return path ? new Uint8Array(readFileSync(path)) : null
}

/**
 * The `--media-dir <path>` argument, or `undefined` when the caller did not
 * pass one — in which case the script falls back to Appwrite and, against the
 * live v1, copies nothing.
 */
export function mediaDirFrom(argv: readonly string[]): string | undefined {
  const at = argv.indexOf('--media-dir')
  return at >= 0 ? argv[at + 1] : undefined
}
