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
}

export function supportsPut(provider: StorageProvider): provider is StorageProviderWithPut {
  return typeof (provider as StorageProviderWithPut).putObject === 'function'
}
