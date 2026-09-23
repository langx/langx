import { describe, expect, it } from 'vitest'
import { mediaFileName } from './mediaFileName'

describe('mediaFileName', () => {
  it("keeps the bucket key's own name and extension", () => {
    expect(mediaFileName('https://cdn.example/messages/c1/abc123.mov', 'video/quicktime')).toBe(
      'abc123.mov',
    )
  })

  it('ignores a query string and a fragment', () => {
    expect(mediaFileName('https://cdn.example/posts/p1/x.jpg?sig=1#top', 'image/jpeg')).toBe(
      'x.jpg',
    )
  })

  it('falls back to the content type when the URL has no usable extension', () => {
    expect(mediaFileName('https://cdn.example/media/abc', 'video/mp4')).toBe('abc.mp4')
    expect(mediaFileName('https://cdn.example/media/abc.bin', 'image/png')).toBe('abc.png')
  })

  /** A profile gallery has never carried a content type; everything in it is a picture. */
  it('calls anything it cannot place a JPEG', () => {
    expect(mediaFileName('https://cdn.example/media/abc')).toBe('abc.jpg')
  })

  it('never hands the filesystem an empty or unsafe name', () => {
    expect(mediaFileName('https://cdn.example/', 'image/jpeg')).toBe('langx.jpg')
    expect(mediaFileName('https://cdn.example/a%20b%2Fc.png')).toBe('a-b-c.png')
  })
})
