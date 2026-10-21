import { hashFallback, parseDefaultAvatarRev } from '@langx/shared'
import { describe, expect, it } from 'vitest'
import { dedupeGrounds } from './avatarViewport'
import {
  allFaces,
  avatarSource,
  faceFromKey,
  faceKey,
  ownDefaultAvatar,
  ownDefaultAvatarRev,
  pickerFaces,
  sameFace,
} from './defaultAvatar'

const API = 'https://api.example'
const SEED = '64f1c0ffee64f1c0ffee64f1'

describe('avatarSource', () => {
  const base = { url: undefined, seed: SEED, size: 40, rev: undefined, pixelRatio: 3, apiBase: API }

  it('keeps the photo whatever the flag says', () => {
    const url = 'https://media.example/a.jpg'
    expect(avatarSource({ ...base, url, v3: true })).toBe(url)
    expect(avatarSource({ ...base, url, v3: false })).toBe(url)
  })

  it('draws today’s face with the flag off', () => {
    expect(avatarSource({ ...base, v3: false })).toBe(`${API}/public/avatar/${SEED}`)
  })

  it('asks for the v3 PNG with the flag on, sized for the screen and cut for the size shown', () => {
    // 40pt on a 3x screen: 120px wanted, 160 is the nearest step up; still the small cut.
    expect(avatarSource({ ...base, v3: true })).toBe(
      `${API}/public/avatar/v3/${SEED}?s=160&c=small`,
    )
    expect(avatarSource({ ...base, size: 128, pixelRatio: 2, v3: true, rev: '1-W07-3' })).toBe(
      `${API}/public/avatar/v3/${SEED}?s=480&c=full&v=1-W07-3`,
    )
    expect(avatarSource({ ...base, size: 76, pixelRatio: 1, v3: true })).toBe(
      `${API}/public/avatar/v3/${SEED}?s=96&c=flat`,
    )
  })

  it('has nothing to draw without a photo or an id, so the initials show', () => {
    expect(avatarSource({ ...base, seed: undefined, v3: true })).toBeUndefined()
  })
})

describe('the signed-in face', () => {
  it('is the stored face, or the server’s own hash before one is stored', () => {
    const stored = { pool: 'M' as const, index: 4, ground: 2, picked: true }
    expect(ownDefaultAvatar({ _id: SEED, gender: 'female', defaultAvatar: stored })).toBe(stored)
    expect(ownDefaultAvatar({ _id: SEED, gender: 'female' })).toEqual(hashFallback(SEED, 'female'))
    expect(ownDefaultAvatarRev({ _id: SEED, gender: 'male', defaultAvatar: stored })).toBe(
      '1-M04-2',
    )
  })
})

describe('the picker', () => {
  const current = { pool: 'W' as const, index: 45, ground: 4 }

  it('leads with the face worn, then eight different faces from the same pool', () => {
    const faces = pickerFaces(current)
    expect(faces).toHaveLength(9)
    expect(faces[0]).toEqual(current)
    expect(faces.every((face) => face.pool === 'W')).toBe(true)
    expect(new Set(faces.map((face) => face.index)).size).toBe(9)
    for (const face of faces) {
      expect(face.index).toBeGreaterThanOrEqual(1)
      expect(face.index).toBeLessThanOrEqual(48)
      expect(face.ground).toBeLessThan(6)
    }
  })

  it('fetches no more than a grid needs when told so', () => {
    const base = { url: undefined, seed: SEED, rev: undefined, apiBase: API }
    expect(avatarSource({ ...base, size: 64, pixelRatio: 3, v3: true, maxPixels: 160 })).toBe(
      `${API}/public/avatar/v3/${SEED}?s=160&c=flat`,
    )
    // A cap above what the screen wants changes nothing.
    expect(avatarSource({ ...base, size: 40, pixelRatio: 1, v3: true, maxPixels: 160 })).toBe(
      `${API}/public/avatar/v3/${SEED}?s=48&c=small`,
    )
  })

  it('offers every one of the 144 faces in "See all", the person’s pool first', () => {
    const worn = { pool: 'N' as const, index: 9, ground: 4 }
    const faces = allFaces(worn)
    // The worn face on its own ground, so the sheet opens with it selected.
    expect(faces.filter((face) => sameFace(face, worn))).toHaveLength(1)
    expect(faces).toHaveLength(144)
    expect(faces[0]?.pool).toBe('N')
    expect(new Set(faces.map((face) => `${face.pool}${face.index}`)).size).toBe(144)
  })

  it('keys the worn face by value, so a rebuilt object does not reset the picker', () => {
    const me = { _id: SEED, gender: 'male' }
    // Nothing stored: each call builds a new object for the same face.
    const first = ownDefaultAvatar(me)
    const again = ownDefaultAvatar(me)
    expect(again).not.toBe(first)
    expect(faceKey(again)).toBe(faceKey(first))
    expect(faceFromKey(faceKey(first))).toEqual(first)
    // A picked face keys the same as its look; `picked` is not part of it.
    expect(faceKey({ ...first, picked: true })).toBe(faceKey(first))
    expect(faceKey({ ...first, ground: (first.ground + 1) % 6 })).not.toBe(faceKey(first))
  })

  it('tells one face on one ground from another', () => {
    expect(sameFace(current, { ...current })).toBe(true)
    expect(sameFace(current, { ...current, ground: 0 })).toBe(false)
  })
})

describe('dedupeGrounds', () => {
  it('moves a repeat to a ground nobody else on screen wears that face on', () => {
    const rows = [
      { _id: 'a', defaultAvatarRev: '1-W07-3' },
      { _id: 'b', defaultAvatarRev: '1-W07-3' },
      { _id: 'c', defaultAvatarRev: '1-W07-4' },
      { _id: 'd', defaultAvatarRev: '1-M07-3' },
      { _id: 'e' },
    ]
    const out = dedupeGrounds(rows)
    expect(out[0]).toBe(rows[0])
    // b skips 4 (c holds it) and lands on 5.
    expect(out[1]?.defaultAvatarRev).toBe('1-W07-5')
    expect(out[2]).toBe(rows[2])
    // Another pool's face 7 is another face.
    expect(out[3]).toBe(rows[3])
    expect(out[4]).toBe(rows[4])
    const grounds = out
      .slice(0, 3)
      .map((row) => parseDefaultAvatarRev(row.defaultAvatarRev ?? '')?.ground)
    expect(new Set(grounds).size).toBe(3)
  })

  it('leaves the same person twice alone', () => {
    const rows = [
      { _id: 'a', defaultAvatarRev: '1-N01-0' },
      { _id: 'a', defaultAvatarRev: '1-N01-0' },
    ]
    expect(dedupeGrounds(rows)).toEqual(rows)
  })

  it('gives up gracefully past six of one face', () => {
    const rows = Array.from({ length: 7 }, (_, i) => ({
      _id: `p${i}`,
      defaultAvatarRev: '1-N02-0',
    }))
    const out = dedupeGrounds(rows)
    expect(new Set(out.slice(0, 6).map((row) => row.defaultAvatarRev)).size).toBe(6)
    expect(out[6]).toBe(rows[6])
  })
})
