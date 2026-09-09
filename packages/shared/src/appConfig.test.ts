import { describe, expect, it } from 'vitest'
import {
  DEFAULT_APP_CONFIG,
  isUpdateAvailable,
  isUpdateRequired,
  versionForPlatform,
} from './appConfig'

describe('isUpdateAvailable', () => {
  it('is true only for a client behind the published version', () => {
    expect(isUpdateAvailable('2.0.0', '2.1.0')).toBe(true)
    expect(isUpdateAvailable('2.1.0', '2.1.0')).toBe(false)
    // A build newer than what is published — a TestFlight tester, or a store
    // release that has not been recorded here yet.
    expect(isUpdateAvailable('2.2.0', '2.1.0')).toBe(false)
  })

  it('stays quiet for a version it cannot read', () => {
    // Same permissive direction as `isUpdateRequired`: an unreadable header is
    // our problem, and nagging someone over it would be answering it wrongly.
    expect(isUpdateAvailable(undefined, '2.1.0')).toBe(false)
    expect(isUpdateAvailable('nightly', '2.1.0')).toBe(false)
    expect(isUpdateAvailable('2.0.0', 'unreleased')).toBe(false)
  })

  it('says nothing under the shipped defaults', () => {
    expect(
      isUpdateAvailable('1.0.0', versionForPlatform(DEFAULT_APP_CONFIG.latestVersion, 'ios')),
    ).toBe(false)
  })

  it('is independent of updateRequired', () => {
    // Raising the minimum without publishing anything is a real state: the
    // gate blocks and there is nothing newer to offer.
    expect(isUpdateRequired('2.0.0', '2.5.0')).toBe(true)
    expect(isUpdateAvailable('2.0.0', '0.0.0')).toBe(false)
  })
})

describe('versionForPlatform', () => {
  const versions = { ios: '3.0.0', android: '2.0.0', web: '1.0.0' }

  it('picks the platform’s own entry', () => {
    expect(versionForPlatform(versions, 'ios')).toBe('3.0.0')
    expect(versionForPlatform(versions, 'android')).toBe('2.0.0')
    expect(versionForPlatform(versions, 'web')).toBe('1.0.0')
  })

  it('falls to web for anything it does not recognise', () => {
    expect(versionForPlatform(versions, undefined)).toBe('1.0.0')
    expect(versionForPlatform(versions, 'windows-phone')).toBe('1.0.0')
  })
})
