import { describe, expect, it } from 'vitest'
import { locationGuideStatus } from './locationPermission'

const native = { granted: false, canAskAgain: true, servicesEnabled: true, platform: 'ios' }

describe('locationGuideStatus', () => {
  it('offers to ask while the OS will still raise a dialog', () => {
    expect(locationGuideStatus(native)).toBe('askable')
  })

  it('sends someone to Settings once it will not', () => {
    expect(locationGuideStatus({ ...native, canAskAgain: false })).toBe('blocked')
  })

  it('is happy when permission is granted and location is on', () => {
    expect(locationGuideStatus({ ...native, granted: true })).toBe('granted')
  })

  /** The device switch outranks the app's permission, and needs its own words. */
  it('separates the device-wide switch from the app permission', () => {
    expect(locationGuideStatus({ ...native, granted: true, servicesEnabled: false })).toBe(
      'servicesOff',
    )
  })

  /** Ahead of everything: none of the other branches has anywhere to send a browser. */
  it('answers web whatever the permission says', () => {
    expect(locationGuideStatus({ ...native, platform: 'web' })).toBe('web')
    expect(
      locationGuideStatus({
        granted: true,
        canAskAgain: false,
        servicesEnabled: true,
        platform: 'web',
      }),
    ).toBe('web')
  })
})
