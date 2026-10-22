import { describe, expect, it } from 'vitest'
import { lockedAvatarVeil } from './lockedAvatarVeil'

describe('lockedAvatarVeil', () => {
  it('hides nothing on an unlocked row, on any platform', () => {
    for (const platform of ['ios', 'android', 'web']) {
      expect(lockedAvatarVeil(platform, false)).toEqual({ kind: 'none' })
    }
  })

  it('blurs the picture itself on Android, where a BlurView over a row only tints', () => {
    const veil = lockedAvatarVeil('android', true)
    expect(veil.kind).toBe('blurImage')
    // expo-image clamps Android blur at 25; anything lower leaves a face legible.
    expect(veil.kind === 'blurImage' && veil.blurRadius).toBe(25)
  })

  it('keeps the BlurView on iOS and the flat scrim on the web', () => {
    expect(lockedAvatarVeil('ios', true)).toEqual({ kind: 'blurView' })
    expect(lockedAvatarVeil('web', true)).toEqual({ kind: 'flat' })
  })

  it('never leaves a locked face unveiled on a platform it does not know', () => {
    expect(lockedAvatarVeil('windows', true).kind).toBe('blurImage')
  })
})
