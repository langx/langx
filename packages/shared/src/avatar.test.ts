import { describe, expect, it } from 'vitest'
import { avatarOptionsFor, generatedAvatarUrl, GENERATED_AVATAR_BACKGROUNDS } from './avatar'

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
