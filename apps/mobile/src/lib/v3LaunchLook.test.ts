import { beforeEach, describe, expect, it } from 'vitest'
import { latchV3LaunchLook, resetV3LaunchLook } from './v3LaunchLook'

describe('latchV3LaunchLook', () => {
  beforeEach(() => resetV3LaunchLook())

  it('draws today’s look while the flag has not answered', () => {
    expect(latchV3LaunchLook({ decision: undefined, launchOver: false })).toBe(false)
  })

  it('follows the flag while the splash still covers the screen', () => {
    expect(latchV3LaunchLook({ decision: undefined, launchOver: false })).toBe(false)
    expect(latchV3LaunchLook({ decision: true, launchOver: false })).toBe(true)
  })

  it('keeps the look the screen had when the splash went', () => {
    latchV3LaunchLook({ decision: true, launchOver: false })
    expect(latchV3LaunchLook({ decision: true, launchOver: true })).toBe(true)
    // Nothing the flag says later moves it.
    expect(latchV3LaunchLook({ decision: false, launchOver: true })).toBe(true)
  })

  it('keeps today’s look for a launch whose flag answered after the splash', () => {
    expect(latchV3LaunchLook({ decision: undefined, launchOver: true })).toBe(false)
    expect(latchV3LaunchLook({ decision: true, launchOver: true })).toBe(false)
  })

  it('takes the flag as it stands for a screen first drawn after the launch', () => {
    expect(latchV3LaunchLook({ decision: true, launchOver: true })).toBe(true)
  })
})
