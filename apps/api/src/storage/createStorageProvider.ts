import type { Env } from '../env'
import { S3StorageProvider } from './s3StorageProvider'
import type { StorageProvider, UploadUrl } from './StorageProvider'

/**
 * Used whenever the STORAGE_* variables are unset. The app still boots —
 * everything except the avatar-upload endpoint works — and that endpoint
 * fails with a clear, specific error instead of a confusing crash.
 */
class NotConfiguredStorageProvider implements StorageProvider {
  getUploadUrl(): Promise<UploadUrl> {
    return Promise.reject(
      new Error(
        'Storage is not configured — set STORAGE_ENDPOINT, STORAGE_BUCKET, ' +
          'STORAGE_ACCESS_KEY_ID, STORAGE_SECRET_ACCESS_KEY and STORAGE_PUBLIC_BASE_URL',
      ),
    )
  }
}

export function createStorageProvider(env: Env): StorageProvider {
  if (
    env.STORAGE_ENDPOINT &&
    env.STORAGE_BUCKET &&
    env.STORAGE_ACCESS_KEY_ID &&
    env.STORAGE_SECRET_ACCESS_KEY &&
    env.STORAGE_PUBLIC_BASE_URL
  ) {
    return new S3StorageProvider({
      endpoint: env.STORAGE_ENDPOINT,
      region: env.STORAGE_REGION,
      bucket: env.STORAGE_BUCKET,
      accessKeyId: env.STORAGE_ACCESS_KEY_ID,
      secretAccessKey: env.STORAGE_SECRET_ACCESS_KEY,
      publicBaseUrl: env.STORAGE_PUBLIC_BASE_URL,
    })
  }
  return new NotConfiguredStorageProvider()
}
