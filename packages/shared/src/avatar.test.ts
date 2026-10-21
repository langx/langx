import { describe, expect, it } from 'vitest'
import {
  avatarOptionsFor,
  defaultAvatarCutFor,
  defaultAvatarRev,
  defaultAvatarSizeFor,
  defaultAvatarUrl,
  generatedAvatarUrl,
  GENERATED_AVATAR_BACKGROUNDS,
  hashFallback,
  hashGround,
  parseDefaultAvatarRev,
  poolFor,
} from './avatar'

describe('avatarOptionsFor', () => {
  it('gives a beard a chance on a male account, and none on a female one', () => {
    expect(avatarOptionsFor('male')).toEqual({ beardProbability: 60 })
    expect(avatarOptionsFor('female')).toEqual({ beardProbability: 0 })
  })

  it('leaves the defaults alone for the two private answers', () => {
    // Not a third look. An account that declined to say must render from the
    // same pool as one that has not been asked, or the picture discloses it.
    expect(avatarOptionsFor('other')).toEqual({})
    expect(avatarOptionsFor('undisclosed')).toEqual({})
    expect(avatarOptionsFor(null)).toEqual({})
  })
})

describe('generatedAvatarUrl', () => {
  it('points at the API, by id', () => {
    expect(generatedAvatarUrl('https://api.langx.io', '64f1c0ffee64f1c0ffee64f1')).toBe(
      'https://api.langx.io/public/avatar/64f1c0ffee64f1c0ffee64f1',
    )
  })

  it('does not double the slash when the base url carries one', () => {
    expect(generatedAvatarUrl('https://api.langx.io/', 'abc')).toBe(
      'https://api.langx.io/public/avatar/abc',
    )
  })
})

describe('the palette', () => {
  it('is plain hex without the hash, which is what DiceBear expects', () => {
    for (const colour of GENERATED_AVATAR_BACKGROUNDS) expect(colour).toMatch(/^[0-9a-f]{6}$/)
  })
})

describe('v3 default faces', () => {
  const id = (n: number) => n.toString(16).padStart(24, '0')

  it('maps female to W, male to M, and every other value to N', () => {
    expect(poolFor('female')).toBe('W')
    expect(poolFor('male')).toBe('M')
    for (const other of ['other', 'undisclosed', null, undefined, '', 'Female', 'nonbinary', 3]) {
      expect(poolFor(other)).toBe('N')
    }
  })

  it('falls back to the same face for the same id, every time', () => {
    const seed = '64f1c0ffee64f1c0ffee64f1'
    expect(hashFallback(seed, 'male')).toEqual(hashFallback(seed, 'male'))
    // Gender moves the pool and nothing else, so a change keeps index and ground.
    const woman = hashFallback(seed, 'female')
    const man = hashFallback(seed, 'male')
    expect([woman.pool, man.pool]).toEqual(['W', 'M'])
    expect([woman.index, woman.ground]).toEqual([man.index, man.ground])
  })

  it('spreads 10k ids evenly over the 48 faces and six grounds', () => {
    const faces = new Array<number>(48).fill(0)
    const grounds = new Array<number>(6).fill(0)
    // Sequential ids, like ObjectIds minted in one second, are the hard case.
    for (let n = 0; n < 10_000; n++) {
      const { index, ground } = hashFallback(id(0x64f1c0ff0000 + n), null)
      faces[index - 1] = (faces[index - 1] ?? 0) + 1
      grounds[ground] = (grounds[ground] ?? 0) + 1
    }
    // Within ±30% of the mean: 208 per face, 1667 per ground.
    for (const count of faces) {
      expect(count).toBeGreaterThan(145)
      expect(count).toBeLessThan(271)
    }
    for (const count of grounds) expect(count).toBeGreaterThan(1400)
    expect(hashGround(id(1))).toBe(hashFallback(id(1), 'male').ground)
  })

  it('writes and reads back the URL token naming one face', () => {
    const rev = defaultAvatarRev({ pool: 'W', index: 7, ground: 3, picked: true })
    expect(rev).toBe('1-W07-3')
    expect(parseDefaultAvatarRev(rev)).toEqual({ pool: 'W', index: 7, ground: 3 })
    for (const bad of ['', '1-W00-3', '1-W49-0', '1-X07-3', '1-W07-6', '2-W07-3', '1-W7-3']) {
      expect(parseDefaultAvatarRev(bad), bad).toBeNull()
    }
  })

  it('asks for the smallest size that covers the screen, and the cut for the size shown', () => {
    expect(defaultAvatarSizeFor(40, 3)).toBe(160)
    expect(defaultAvatarSizeFor(24, 2)).toBe(48)
    expect(defaultAvatarSizeFor(160, 3)).toBe(480)
    expect(defaultAvatarSizeFor(400, 3)).toBe(480)
    expect(defaultAvatarCutFor(40)).toBe('small')
    expect(defaultAvatarCutFor(64)).toBe('flat')
    expect(defaultAvatarCutFor(96)).toBe('full')
  })

  it('builds the URL the route reads', () => {
    expect(defaultAvatarUrl('https://api.langx.io/', 'abc', 40, 3)).toBe(
      'https://api.langx.io/public/avatar/v3/abc?s=160&c=small',
    )
    expect(defaultAvatarUrl('https://api.langx.io', 'abc', 96, 1, '1-N12-0')).toBe(
      'https://api.langx.io/public/avatar/v3/abc?s=96&c=full&v=1-N12-0',
    )
  })
})
