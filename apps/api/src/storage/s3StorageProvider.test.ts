import { describe, expect, it } from 'vitest'
import { S3StorageProvider } from './s3StorageProvider'

const provider = new S3StorageProvider({
  endpoint: 'https://s3.example.test',
  region: 'us-east-1',
  bucket: 'langx-test',
  accessKeyId: 'key',
  secretAccessKey: 'secret',
  publicBaseUrl: 'https://cdn.example.test',
})

describe('deleteByPrefix', () => {
  /**
   * The one call in this file that can destroy data it was not asked about.
   * An empty prefix matches the whole bucket and `feedback/u1` also matches
   * `feedback/u10/`, so the shape is checked before anything is listed —
   * the purge builds these from a user id, and a blank id must throw rather
   * than sweep.
   */
  it('refuses a prefix that is not a directory', async () => {
    await expect(provider.deleteByPrefix('')).rejects.toThrow(/must end in/)
    await expect(provider.deleteByPrefix('feedback')).rejects.toThrow(/must end in/)
    await expect(provider.deleteByPrefix('feedback/u1')).rejects.toThrow(/must end in/)
  })
})

describe('getUploadUrl', () => {
  function signedHeaders(url: string): string[] {
    return (new URL(url).searchParams.get('X-Amz-SignedHeaders') ?? '').split(';')
  }

  /**
   * The byte ceiling on a presigned upload is only real if the bucket checks
   * it, and the bucket only checks what the signature covers.
   */
  it('signs the length it is given', async () => {
    const { uploadUrl } = await provider.getUploadUrl('messages/c1/a.jpg', 'image/jpeg', 1234)
    expect(signedHeaders(uploadUrl)).toContain('content-length')
  })

  it('signs no length when none is given', async () => {
    const { uploadUrl } = await provider.getUploadUrl('messages/c1/a.jpg', 'image/jpeg')
    expect(signedHeaders(uploadUrl)).not.toContain('content-length')
  })
})
