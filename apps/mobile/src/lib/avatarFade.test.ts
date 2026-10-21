import { beforeEach, describe, expect, it } from 'vitest'
import { AVATAR_FADE_MS, avatarFadeMs, markAvatarShown, resetAvatarFadeForTest } from './avatarFade'

describe('avatarFadeMs', () => {
  beforeEach(() => resetAvatarFadeForTest())

  it('fades a picture nothing has shown yet', () => {
    expect(avatarFadeMs('https://media.example/a.png')).toBe(AVATAR_FADE_MS)
  })

  it('does not fade it again once it has loaded', () => {
    markAvatarShown('https://media.example/a.png')
    expect(avatarFadeMs('https://media.example/a.png')).toBe(0)
  })

  it('keeps each picture apart', () => {
    markAvatarShown('https://media.example/a.png')
    expect(avatarFadeMs('https://media.example/b.png')).toBe(AVATAR_FADE_MS)
  })

  it('still fades before the first load finishes', () => {
    // A second view of the same face mounted while the first is loading has
    // not seen it either: both fade in, together.
    avatarFadeMs('https://media.example/a.png')
    expect(avatarFadeMs('https://media.example/a.png')).toBe(AVATAR_FADE_MS)
  })
})
