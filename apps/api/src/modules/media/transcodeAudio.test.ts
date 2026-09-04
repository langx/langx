import { describe, expect, it, vi } from 'vitest'
import type { Media } from '@langx/shared'
import {
  needsTranscode,
  normalizeAttachments,
  transcodedKey,
  type TranscodeDeps,
} from './transcodeAudio'

const BUCKET = 'https://cdn.example.com'

function webmNote(overrides: Partial<Media> = {}): Media {
  return {
    url: `${BUCKET}/messages/c1/a.webm`,
    contentType: 'audio/webm',
    sizeBytes: 40_000,
    durationSeconds: 7,
    ...overrides,
  }
}

/**
 * ffmpeg and S3 are both injected, so this suite never runs a binary and never
 * reaches a bucket — which is also the only way it could run at all: presigning
 * is local, but a GET and a PUT are real network calls.
 */
function deps(overrides: Partial<TranscodeDeps> = {}) {
  const spies = {
    get: vi.fn(() => Promise.resolve(new Uint8Array([1, 2, 3]))),
    put: vi.fn((key: string) => Promise.resolve(`${BUCKET}/${key}`)),
    del: vi.fn(() => Promise.resolve()),
    transcode: vi.fn(() => Promise.resolve(new Uint8Array([9, 9]))),
    warn: vi.fn(),
  }
  const all: TranscodeDeps = {
    ...spies,
    keyOf: (url: string) => (url.startsWith(`${BUCKET}/`) ? url.slice(BUCKET.length + 1) : null),
    ...overrides,
  }
  // Returned beside the object rather than read back off it, so the
  // assertions never pull an unbound method out of a value under test.
  return { deps: all, ...spies, ...overrides }
}

describe('needsTranscode', () => {
  it('is the two containers a browser records and no iPhone decodes', () => {
    expect(needsTranscode('audio/webm')).toBe(true)
    expect(needsTranscode('audio/ogg')).toBe(true)
    // With the codec parameter `MediaRecorder` likes to append.
    expect(needsTranscode('audio/webm;codecs=opus')).toBe(true)
  })

  it('leaves what both phones already record alone', () => {
    for (const type of ['audio/mp4', 'audio/m4a', 'audio/aac', 'audio/mpeg']) {
      expect(needsTranscode(type), type).toBe(false)
    }
  })
})

describe('transcodedKey', () => {
  // Same prefix, because `keyFromPublicUrl` recognises our own objects by it
  // and the account purge deletes nothing it does not recognise.
  it('keeps the directory and the name, and takes the .m4a extension', () => {
    expect(transcodedKey('messages/c1/a.webm')).toBe('messages/c1/a.m4a')
    expect(transcodedKey('posts/u1/b.ogg')).toBe('posts/u1/b.m4a')
  })
})

describe('normalizeAttachments', () => {
  it('rewrites a browser note to AAC and removes the original', async () => {
    const { deps: d, del } = deps()
    const [note] = await normalizeAttachments(d, [webmNote()])

    expect(note).toEqual({
      url: `${BUCKET}/messages/c1/a.m4a`,
      contentType: 'audio/mp4',
      // The converted file's own size, not the one the upload was signed for.
      sizeBytes: 2,
      // Kept: the recorder measured it and ffmpeg does not change it.
      durationSeconds: 7,
    })
    expect(del).toHaveBeenCalledWith('messages/c1/a.webm')
  })

  it('leaves everything else untouched, without fetching it', async () => {
    const { deps: d, get } = deps()
    const items: Media[] = [
      { url: `${BUCKET}/messages/c1/a.m4a`, contentType: 'audio/mp4', sizeBytes: 1000 },
      { url: `${BUCKET}/messages/c1/a.jpg`, contentType: 'image/jpeg', sizeBytes: 2000 },
    ]

    expect(await normalizeAttachments(d, items)).toEqual(items)
    expect(get).not.toHaveBeenCalled()
  })

  // The whole bargain: a missing ffmpeg, a timeout or a file it cannot read
  // costs the conversion, never the message.
  it('stores the original when the conversion cannot be made', async () => {
    const { deps: d, put, del } = deps({ transcode: vi.fn(() => Promise.resolve(null)) })
    const original = webmNote()

    expect(await normalizeAttachments(d, [original])).toEqual([original])
    expect(put).not.toHaveBeenCalled()
    expect(del).not.toHaveBeenCalled()
  })

  it('stores the original when the bytes cannot be read back', async () => {
    const { deps: d, warn } = deps({
      get: vi.fn(() => Promise.reject(new Error('bucket said no'))),
    })
    const original = webmNote()

    expect(await normalizeAttachments(d, [original])).toEqual([original])
    expect(warn).toHaveBeenCalled()
  })

  // A URL outside our bucket cannot reach this in production — `assertMedia`
  // rejects it first — and if it ever did, this server must not fetch it.
  it('never touches a URL that is not ours', async () => {
    const { deps: d, get } = deps()
    const foreign = webmNote({ url: 'https://elsewhere.example/a.webm' })

    expect(await normalizeAttachments(d, [foreign])).toEqual([foreign])
    expect(get).not.toHaveBeenCalled()
  })

  it('keeps the note when only the original could not be deleted', async () => {
    const { deps: d, warn } = deps({
      del: vi.fn(() => Promise.reject(new Error('delete failed'))),
    })
    const [note] = await normalizeAttachments(d, [webmNote()])

    // A leaked object costs bytes; losing the note costs the message.
    expect(note?.contentType).toBe('audio/mp4')
    expect(warn).toHaveBeenCalled()
  })

  it('converts both takes of a pronunciation answer', async () => {
    const { deps: d } = deps()
    const converted = await normalizeAttachments(d, [
      webmNote(),
      webmNote({ url: `${BUCKET}/posts/u1/slow.webm` }),
    ])

    expect(converted.map((m) => m.contentType)).toEqual(['audio/mp4', 'audio/mp4'])
    expect(converted[1]?.url).toBe(`${BUCKET}/posts/u1/slow.m4a`)
  })
})
