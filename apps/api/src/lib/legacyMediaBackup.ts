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
 * What one walk of a backup directory found.
 *
 * The counts are not decoration. The index used to be a bare `Map`, so a
 * layout it could not read — an Appwrite install that sharded uploads into
 * nested directories, a `--media-dir` pointed one level too high — produced a
 * small map and no complaint, and the ETL then reported the resulting silence
 * as "the bytes are gone". Printing what was walked is what tells those two
 * apart without reading any code.
 */
export interface BackupIndex {
  /** Appwrite file id → path on disk. */
  byId: Map<string, string>
  filesSeen: number
  directories: number
  /** Ids seen more than once; the first wins, the rest are counted here. */
  collisions: number
}

/**
 * File id → path on disk, flattened across every bucket folder.
 *
 * Deliberately not keyed by bucket, because the backup and the live project
 * disagree about which bucket a file belongs to: v1's placeholder avatar sits
 * under a bucket id the project no longer has. Appwrite ids are unique, so
 * flattening across buckets is safe and does find the files a per-bucket
 * lookup misses.
 *
 * Recursive, though the DigitalOcean Spaces copy we actually have is flat
 * (`<root>/<bucket>/<id>`, measured 4 September 2026: 2362 files, all at the
 * same depth). Appwrite's local storage device *can* shard uploads into nested
 * directories, and the one-level version of this walk indexed directory names
 * as file ids when it met one — finding almost nothing, and saying so in a way
 * indistinguishable from an honest empty backup.
 */
export function buildBackupIndex(root: string): BackupIndex {
  const byId = new Map<string, string>()
  let filesSeen = 0
  let directories = 0
  let collisions = 0

  const walk = (dir: string): void => {
    directories++
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) {
        walk(path)
        continue
      }
      filesSeen++
      // Files are stored under a bare id, sometimes with an extension and
      // sometimes with a trailing dot and nothing after it.
      const id = entry.name.split('.')[0] || entry.name
      if (byId.has(id)) {
        collisions++
        continue
      }
      byId.set(id, path)
    }
  }
  walk(root)

  return { byId, filesSeen, directories, collisions }
}

/** `null` when the backup does not have this file — the ordinary case, not a fault. */
export function readBackupBytes(index: BackupIndex, fileId: string): Uint8Array | null {
  const path = index.byId.get(fileId)
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
