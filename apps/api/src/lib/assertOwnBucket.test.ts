import { describe, expect, it } from 'vitest'
import { assertOwnBucket, assertOwnObject, isOwnBucketUrl, isOwnObjectUrl } from './assertOwnBucket'

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

describe('isOwnObjectUrl', () => {
  const ME = 'me123'
  const VICTIM = 'victim456'
  const mine = (rest: string) => `${BASE}/avatars/${ME}/${rest}`

  it('accepts an object under the caller’s own prefix', () => {
    expect(isOwnObjectUrl(BASE, mine('0b6f6a1e-uuid.jpg'), `avatars/${ME}/`)).toBe(true)
    // A dot inside a name is part of the name, not a path segment.
    expect(isOwnObjectUrl(BASE, mine('photo.v2.final.jpg'), `avatars/${ME}/`)).toBe(true)
    expect(isOwnObjectUrl(BASE, mine('..jpg'), `avatars/${ME}/`)).toBe(true)
  })

  it('refuses another owner’s prefix, and one that merely starts the same way', () => {
    expect(isOwnObjectUrl(BASE, `${BASE}/avatars/${VICTIM}/x.jpg`, `avatars/${ME}/`)).toBe(false)
    expect(isOwnObjectUrl(BASE, `${BASE}/avatars/${ME}x/x.jpg`, `avatars/${ME}/`)).toBe(false)
  })

  /**
   * The regression. Every one of these starts with the caller's own prefix as
   * written, and every one is fetched by a browser or the CDN as some other
   * path — the victim's, for most of them.
   */
  it('refuses a URL that leaves the prefix once resolved', () => {
    const climbs = [
      mine(`../${VICTIM}/x.jpg`),
      mine('./x.jpg'),
      mine(`%2e%2e/${VICTIM}/x.jpg`),
      mine(`%2E%2E/${VICTIM}/x.jpg`),
      mine(`.%2e/${VICTIM}/x.jpg`),
      mine(`..%2F${VICTIM}%2Fx.jpg`),
      mine(`..%2f${VICTIM}/x.jpg`),
      mine(`..\\${VICTIM}\\x.jpg`),
      mine(`..%5c${VICTIM}/x.jpg`),
      // The URL parser deletes tabs and newlines, which leaves `..`.
      mine(`.\t./${VICTIM}/x.jpg`),
      mine(`.\n./${VICTIM}/x.jpg`),
      mine('/x.jpg'),
      mine('a//x.jpg'),
      mine('x.jpg?v=1'),
      mine('x.jpg#frag'),
      `${BASE}/avatars/${ME}/`,
    ]
    for (const url of climbs) {
      expect(isOwnObjectUrl(BASE, url, `avatars/${ME}/`), JSON.stringify(url)).toBe(false)
    }
  })

  it('refuses the same spellings when only the bucket is asked about', () => {
    expect(isOwnBucketUrl(BASE, mine(`../${VICTIM}/x.jpg`))).toBe(false)
    expect(isOwnBucketUrl(BASE, mine(`%2e%2e/${VICTIM}/x.jpg`))).toBe(false)
    // v1's copies live under `legacy/`, and still read as ours.
    expect(isOwnBucketUrl(BASE, `${BASE}/legacy/abc123/avatar.jpeg`)).toBe(true)
  })

  it('refuses everything when no bucket is configured', () => {
    expect(isOwnObjectUrl(undefined, mine('x.jpg'), `avatars/${ME}/`)).toBe(false)
  })
})

describe('assertOwnObject', () => {
  it('passes the caller’s own file and refuses a climb out of it', () => {
    expect(() =>
      assertOwnObject(BASE, `${BASE}/photos/me/x.jpg`, 'photos/me/', 'Photo'),
    ).not.toThrow()
    expect(() =>
      assertOwnObject(BASE, `${BASE}/photos/me/../you/x.jpg`, 'photos/me/', 'Photo'),
    ).toThrow(/Photo must be a file you uploaded/)
  })
})
