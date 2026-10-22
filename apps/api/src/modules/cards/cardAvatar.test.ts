import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchCardAvatar } from './recapCard'

/*
 * The card's face is read from our bucket by key, never fetched by the URL a
 * profile holds: `avatarUrl` is a stored string, and handing it to `fetch`
 * was a server-side request to wherever it pointed (CodeQL js/request-forgery).
 */

const BASE = 'https://media.example.test/'
/** The eight-byte PNG signature and a little more: enough for the sniffer. */
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13])

function bucket(objects: Record<string, Uint8Array>) {
  return {
    getObject: vi.fn((key: string) => {
      const bytes = objects[key]
      return bytes ? Promise.resolve(bytes) : Promise.reject(new Error(`No such object: ${key}`))
    }),
    keyFromPublicUrl: (url: string) => (url.startsWith(BASE) ? url.slice(BASE.length) : null),
  }
}

describe('fetchCardAvatar', () => {
  afterEach(() => vi.restoreAllMocks())

  it('reads an avatar out of our own bucket by its key', async () => {
    const storage = bucket({ 'avatars/u1/face.png': PNG })
    const network = vi.spyOn(globalThis, 'fetch')
    const face = await fetchCardAvatar(`${BASE}avatars/u1/face.png`, storage)
    expect(face).toBe(`data:image/png;base64,${Buffer.from(PNG).toString('base64')}`)
    expect(storage.getObject).toHaveBeenCalledWith('avatars/u1/face.png')
    expect(network).not.toHaveBeenCalled()
  })

  it.each([
    ['a host that is not ours', 'http://169.254.169.254/latest/meta-data/'],
    ['a sibling of our bucket', 'https://media.example.test.evil.example/avatars/u1/face.png'],
    ['our bucket, but not an avatar', `${BASE}messages/c1/secret.png`],
  ])('reads nothing at all for %s', async (_, url) => {
    const storage = bucket({ 'messages/c1/secret.png': PNG })
    const network = vi.spyOn(globalThis, 'fetch')
    expect(await fetchCardAvatar(url, storage)).toBeUndefined()
    expect(storage.getObject).not.toHaveBeenCalled()
    expect(network).not.toHaveBeenCalled()
  })

  it('falls back to no face when the object is missing, or not a PNG or JPEG', async () => {
    const storage = bucket({ 'avatars/u1/face.webp': new TextEncoder().encode('RIFF....WEBP') })
    expect(await fetchCardAvatar(`${BASE}avatars/u1/face.webp`, storage)).toBeUndefined()
    expect(await fetchCardAvatar(`${BASE}avatars/u1/gone.png`, storage)).toBeUndefined()
    expect(await fetchCardAvatar(`${BASE}avatars/u1/face.png`, undefined)).toBeUndefined()
  })
})
