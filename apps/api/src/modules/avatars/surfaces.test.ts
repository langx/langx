import { DEFAULT_AVATAR_STYLE } from '@langx/shared'
import { describe, expect, it } from 'vitest'
import { toCallPeer } from '../calls/access'
import { drawnFacePng, drawnFaceRev } from './surfaces'

const ID = '64f1c0ffee64f1c0ffee64f1'
const stored = { pool: 'W' as const, index: 7, ground: 3 }

describe('the drawn face on server surfaces', () => {
  it('is on: the v3 switch is what this stack ships', () => {
    expect(DEFAULT_AVATAR_STYLE).toBe('v3')
  })

  it('names the face for a photoless account only', () => {
    expect(drawnFaceRev({ _id: ID, gender: 'female', defaultAvatar: stored })).toBe('1-W07-3')
    expect(
      drawnFaceRev({ _id: ID, gender: 'male', avatarUrl: 'https://media.example/a.jpg' }),
    ).toBe(undefined)
    expect(drawnFaceRev({ _id: ID, gender: 'undisclosed', official: true })).toBeUndefined()
  })

  it('renders PNG bytes for a token, and nothing for a token it cannot read', async () => {
    const png = await drawnFacePng('1-N12-0', 96, 56)
    expect(png?.readUInt32BE(16)).toBe(96)
    expect(await drawnFacePng('garbage', 96, 56)).toBeNull()
  })

  it('puts the face on a call peer, and keeps avatarUrl meaning a photo', () => {
    const peer = toCallPeer({
      _id: ID,
      handle: 'elif',
      displayName: 'Elif',
      gender: 'female',
      defaultAvatar: stored,
    })
    expect(peer).toEqual({
      _id: ID,
      handle: 'elif',
      displayName: 'Elif',
      defaultAvatarRev: '1-W07-3',
    })
    // Without the gender read the face would be a guess; none is better.
    expect(toCallPeer({ _id: ID, handle: 'elif', displayName: 'Elif' }).defaultAvatarRev).toBe(
      undefined,
    )
  })
})
