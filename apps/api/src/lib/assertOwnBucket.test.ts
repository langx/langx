import { describe, expect, it } from 'vitest'
import { assertOwnBucket, isOwnBucketUrl } from './assertOwnBucket'

/**
 * The form `.env.example` documents for Backblaze, and the one path-style S3
 * hands out: the bucket is the last path segment, with no trailing slash.
 */
const BASE = 'https://f003.backblazeb2.com/file/langx-media'

describe('isOwnBucketUrl', () => {
  it('accepts an object in the bucket', () => {
    expect(isOwnBucketUrl(BASE, `${BASE}/avatars/abc.jpg`)).toBe(true)
  })

  /**
   * The regression. A bucket name on B2, R2 or S3 is registerable by anybody,
   * so `langx-media-x` is a bucket a stranger can own — and a bare
   * `startsWith` reads it as ours, which puts their bytes on our profiles, in
   * our emails, and out of reach of the deletion purge.
   */
  it('refuses a sibling bucket whose name merely starts the same way', () => {
    expect(isOwnBucketUrl(BASE, `${BASE}-evil/avatars/abc.jpg`)).toBe(false)
    expect(isOwnBucketUrl(BASE, `${BASE}2/avatars/abc.jpg`)).toBe(false)
  })

  it('accepts the same objects when the base is configured with its slash', () => {
    expect(isOwnBucketUrl(`${BASE}/`, `${BASE}/avatars/abc.jpg`)).toBe(true)
    expect(isOwnBucketUrl(`${BASE}/`, `${BASE}-evil/avatars/abc.jpg`)).toBe(false)
  })

  it('refuses another host, and the bucket root with nothing under it', () => {
    expect(isOwnBucketUrl(BASE, 'https://example.com/avatars/abc.jpg')).toBe(false)
    expect(isOwnBucketUrl(BASE, BASE)).toBe(false)
  })

  it('refuses everything when no bucket is configured', () => {
    expect(isOwnBucketUrl(undefined, `${BASE}/avatars/abc.jpg`)).toBe(false)
  })
})

describe('assertOwnBucket', () => {
  it('passes an object in the bucket and refuses a sibling', () => {
    expect(() => assertOwnBucket(BASE, `${BASE}/avatars/abc.jpg`)).not.toThrow()
    expect(() => assertOwnBucket(BASE, `${BASE}-evil/avatars/abc.jpg`)).toThrow(
      /own storage bucket/,
    )
  })

  /** Unconfigured storage is our problem, not the caller's: 500, not 400. */
  it('says storage is unconfigured rather than blaming the URL', () => {
    expect(() => assertOwnBucket(undefined, `${BASE}/avatars/abc.jpg`)).toThrow(
      /Storage is not configured/,
    )
  })
})
