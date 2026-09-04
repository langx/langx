import type { Storage } from 'node-appwrite'
import type { BackupIndex } from './legacyMediaBackup'
import { readBackupBytes } from './legacyMediaBackup'
import { normalizeLegacyContentType } from './legacyMedia'
import { sniffImageType } from './sniffImageType'

export interface CopyDeps {
  /** v1's Appwrite, for metadata — and, without a backup, for the bytes too. */
  storage: Storage
  put: (key: string, body: Uint8Array, contentType: string) => Promise<string>
  /** Absent means "read from Appwrite", which against the live v1 copies nothing. */
  backup?: BackupIndex | undefined
}

/**
 * Copies one v1 file into our own bucket, or answers `null` when its bytes no
 * longer exist anywhere.
 *
 * One routine because there were two — `migrate-profiles.ts` and
 * `migrate-messages.ts` had written the same six steps twice — and the media
 * backfill would have made a third. The steps are: ask Appwrite what the file
 * is, read the bytes from the backup, derive an extension from the type, put
 * it, and hand back the URL.
 *
 * `null` rather than a throw, because a missing file is the ordinary case
 * here and not a fault: roughly three quarters of v1's real avatars are simply
 * gone. The caller counts that separately from an actual failure, which is the
 * difference between "the backup does not have this" and "something broke".
 */
export async function copyLegacyFile(
  deps: CopyDeps,
  { bucketId, fileId, key }: { bucketId: string; fileId: string; key: string },
): Promise<string | null> {
  let contentType: string | undefined
  try {
    const file = await deps.storage.getFile({ bucketId, fileId })
    contentType = file.mimeType ? normalizeLegacyContentType(file.mimeType) : undefined
  } catch {
    // v1 is off, or has forgotten this row. The bytes below can still answer.
    contentType = undefined
  }

  let bytes: Uint8Array | null
  if (deps.backup) {
    bytes = readBackupBytes(deps.backup, fileId)
    if (!bytes) return null
  } else {
    bytes = new Uint8Array(await deps.storage.getFileDownload({ bucketId, fileId }))
  }

  // Appwrite first, the bytes second, `image/jpeg` last — in that order
  // because Appwrite is the only one of the three that can tell a voice note
  // from a picture, and the sniffer is the only one that works without it.
  const resolved = contentType ?? sniffImageType(bytes) ?? 'image/jpeg'
  const extension = resolved.split('/')[1]?.split('+')[0] ?? 'jpg'
  return deps.put(`${key}.${extension}`, bytes, resolved)
}
