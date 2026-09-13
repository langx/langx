export interface UploadUrl {
  /** Presigned PUT URL — the client uploads bytes directly here, never through our server. */
  uploadUrl: string
  /** Where the object will be reachable once the upload completes. */
  publicUrl: string
  /** The client must send exactly this Content-Type on the PUT, or the signature won't match. */
  contentType: string
  expiresInSeconds: number
}

export interface StorageProvider {
  getUploadUrl(key: string, contentType: string): Promise<UploadUrl>
}

export interface StorageProviderWithPut extends StorageProvider {
  /**
   * Server-side upload of bytes we already hold.
   *
   * Distinct from `getUploadUrl` on purpose: the presigned flow exists so user
   * uploads never pass through our server, and that is the right shape for a
   * phone sending a photo. The migration is the opposite case — the bytes come
   * from Appwrite's API into this process, and handing a browser a presigned
   * URL it would then have to fetch from Appwrite and re-PUT would be a longer
   * path with more to go wrong for no privacy benefit.
   */
  putObject(key: string, body: Uint8Array, contentType: string): Promise<string>

  /**
   * Reads an object's bytes back into this process.
   *
   * The mirror of `putObject` and it exists for one caller: a voice note
   * recorded in a browser arrives as WebM/Opus, which no iPhone can decode, so
   * it is fetched, transcoded to AAC and written back. Everything else about
   * this bucket is write-once — nothing else needs the bytes after the client
   * has sent them.
   */
  getObject(key: string): Promise<Uint8Array>

  /**
   * Removes an object. Used by the account purge — a deleted account's photos
   * have to leave the bucket, or "your data is permanently removed" is not
   * true and the URLs stay publicly fetchable forever.
   *
   * Must be idempotent: deleting an object that is already gone is a success,
   * not an error, because the purge may well be retried.
   */
  deleteObject(key: string): Promise<void>

  /**
   * The object key behind a public URL, or `null` if the URL does not belong
   * to our bucket. Returning null rather than guessing is what stops the purge
   * from trying to delete something it does not own.
   */
  keyFromPublicUrl(url: string): string | null
}

/**
 * Deleting by prefix rather than by key, for the objects no row points at.
 *
 * The purge finds a person's files through the documents that reference them,
 * which works for everything the app stores a URL for. A bug report's
 * attachment is the exception. Its row does hold the URLs, but the row is
 * deleted by the same purge and the ordering between the two is not something
 * to rely on — so the handle that has always worked, the prefix the upload
 * chose, is still what this sweeps. Without it an attachment stays in the
 * bucket forever, publicly fetchable, after the account that sent it is gone.
 *
 * Its own interface rather than another method on `StorageProviderWithPut`,
 * for the reason that one is separate from `StorageProvider`: a provider that
 * cannot list objects is still a usable provider, and the purge asks before
 * it calls.
 */
export interface StorageProviderWithPrefixDelete extends StorageProvider {
  /** How many objects went — the purge counts them, so it must be the truth. */
  deleteByPrefix(prefix: string): Promise<number>
}

export function supportsPut(provider: StorageProvider): provider is StorageProviderWithPut {
  return typeof (provider as StorageProviderWithPut).putObject === 'function'
}

export function supportsPrefixDelete(
  provider: StorageProvider,
): provider is StorageProviderWithPrefixDelete {
  return typeof (provider as StorageProviderWithPrefixDelete).deleteByPrefix === 'function'
}
