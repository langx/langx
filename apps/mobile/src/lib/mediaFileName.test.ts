import { describe, expect, it } from 'vitest'
import { isRemoteMedia, mediaFileName } from './mediaFileName'

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

  /** The web's picker can hand the chat camera a `data:` URL, which has no name to keep. */
  it('names a data URL by its content type alone', () => {
    expect(mediaFileName('data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==', 'image/png')).toBe(
      'langx.png',
    )
    expect(mediaFileName('data:video/mp4;base64,AAAA', 'video/mp4')).toBe('langx.mp4')
  })

  it('keeps the name of a file already on the phone', () => {
    expect(mediaFileName('file:///var/mobile/Caches/Camera/3F2A.jpg', 'image/jpeg')).toBe(
      '3F2A.jpg',
    )
  })
})

describe('isRemoteMedia', () => {
  it('fetches only what is on a server', () => {
    expect(isRemoteMedia('https://media.langx.io/a.jpg')).toBe(true)
    expect(isRemoteMedia('HTTP://localhost:4100/a.jpg')).toBe(true)
  })

  /** The camera's own shot: `downloadFileAsync` would refuse it. */
  it('saves a local file as it is', () => {
    expect(isRemoteMedia('file:///var/mobile/Caches/Camera/3F2A.jpg')).toBe(false)
    expect(isRemoteMedia('content://media/external/images/1')).toBe(false)
    expect(isRemoteMedia('blob:http://localhost:19006/0d1c')).toBe(false)
    expect(isRemoteMedia('data:image/png;base64,AAAA')).toBe(false)
  })
})
