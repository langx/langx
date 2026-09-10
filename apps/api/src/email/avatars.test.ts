import { afterEach, describe, expect, it, vi } from 'vitest'
import { facesRow, fetchAvatarAsset, initialsOf } from './avatars'

const BASE = 'https://media.langx.io'

function reply(body: Uint8Array, contentType: string, status = 200): Response {
  return new Response(body, { status, headers: { 'content-type': contentType } })
}

describe('faces in an email', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('takes one or two letters from whatever somebody calls themselves', () => {
    expect(initialsOf('Sofia R.')).toBe('SR')
    expect(initialsOf('  kenji  ')).toBe('K')
    expect(initialsOf('Ada B C D')).toBe('AB')
    expect(initialsOf('')).toBe('?')
    // A name outside the Latin alphabet still yields its own first letters.
    expect(initialsOf('Ayşe Yılmaz')).toBe('AY')
  })

  it('fetches a photo from our own bucket and nowhere else', async () => {
    const png = new Uint8Array([137, 80, 78, 71, 1, 2, 3])
    const fetchMock = vi.fn().mockResolvedValue(reply(png, 'image/png'))
    vi.stubGlobal('fetch', fetchMock)

    const asset = await fetchAvatarAsset(`${BASE}/avatars/u1.png`, 'avatar-u1', BASE)
    expect(asset).toMatchObject({
      cid: 'avatar-u1',
      contentType: 'image/png',
      filename: 'avatar-u1.png',
    })
    expect(Buffer.from(asset?.base64 ?? '', 'base64')).toEqual(Buffer.from(png))

    // Somewhere else entirely: refused without a request being made at all.
    expect(await fetchAvatarAsset('https://evil.test/a.png', 'avatar-u1', BASE)).toBeNull()
    expect(await fetchAvatarAsset(`${BASE}/a.png`, 'avatar-u1', undefined)).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  /** Gmail drops SVG from mail bodies, so an SVG avatar is worse than initials. */
  it('refuses anything a mail client will not draw, and anything too big', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply(new Uint8Array([1]), 'image/svg+xml')))
    expect(await fetchAvatarAsset(`${BASE}/a.svg`, 'c', BASE)).toBeNull()

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(reply(new Uint8Array(600 * 1024), 'image/png')),
    )
    expect(await fetchAvatarAsset(`${BASE}/a.png`, 'c', BASE)).toBeNull()

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply(new Uint8Array([1]), 'image/png', 404)))
    expect(await fetchAvatarAsset(`${BASE}/a.png`, 'c', BASE)).toBeNull()
  })

  it('answers null rather than throwing when the bucket is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('timed out')))
    expect(await fetchAvatarAsset(`${BASE}/a.png`, 'c', BASE)).toBeNull()
  })

  it('draws a photo when there is one and initials when there is not', () => {
    const html = facesRow(
      [
        {
          name: 'Sofia R.',
          seed: 'u1',
          asset: { cid: 'avatar-u1', filename: 'a.png', contentType: 'image/png', base64: 'AA' },
        },
        { name: 'Kenji', seed: 'u2' },
      ],
      2,
      'ltr',
    )
    expect(html).toContain('src="cid:avatar-u1"')
    expect(html).toContain('Sofia R.')
    // No photo: initials on a disc, drawn in HTML so it cannot fail to render.
    expect(html).toContain('>K<')
    expect(html).not.toContain('cid:avatar-u2')
    expect(html).toContain('+2')
  })

  it('is nothing at all when nobody is named', () => {
    expect(facesRow([], 0, 'ltr')).toBe('')
  })
})
