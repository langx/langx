import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import type { StorageProvider, UploadUrl } from './StorageProvider'

const UPLOAD_URL_TTL_SECONDS = 5 * 60

export interface S3StorageConfig {
  endpoint: string
  region: string
  bucket: string
  accessKeyId: string
  secretAccessKey: string
  /** Where the object is reachable once uploaded — a CDN/public bucket domain, not the API endpoint. */
  publicBaseUrl: string
}

/**
 * Same code for B2 and R2 — only `S3StorageConfig` changes (see .env.example
 * / `createStorageProvider`). `forcePathStyle` is the safe default across
 * S3-compatible providers that aren't AWS itself.
 */
export class S3StorageProvider implements StorageProvider {
  readonly #client: S3Client
  readonly #bucket: string
  readonly #publicBaseUrl: string

  constructor(config: S3StorageConfig) {
    this.#client = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      forcePathStyle: true,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    })
    this.#bucket = config.bucket
    this.#publicBaseUrl = config.publicBaseUrl.replace(/\/$/, '')
  }

  async getUploadUrl(key: string, contentType: string): Promise<UploadUrl> {
    const command = new PutObjectCommand({
      Bucket: this.#bucket,
      Key: key,
      ContentType: contentType,
    })

    const uploadUrl = await getSignedUrl(this.#client, command, {
      expiresIn: UPLOAD_URL_TTL_SECONDS,
    })

    return {
      uploadUrl,
      publicUrl: `${this.#publicBaseUrl}/${key}`,
      contentType,
      expiresInSeconds: UPLOAD_URL_TTL_SECONDS,
    }
  }
}
