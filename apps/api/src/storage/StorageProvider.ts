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
