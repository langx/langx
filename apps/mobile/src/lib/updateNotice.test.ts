import { describe, expect, it } from 'vitest'
import { shouldShowUpdateNotice } from './updateNotice'

const notice = (over: Partial<Parameters<typeof shouldShowUpdateNotice>[0]> = {}) =>
  shouldShowUpdateNotice({ updateAvailable: true, latest: '2.2.0', dismissed: null, ...over })

describe('shouldShowUpdateNotice', () => {
  it('says nothing while the server says nothing', () => {
    expect(notice({ updateAvailable: false })).toBe(false)
    // Not even for a version this device has never dismissed: the server is
    // the one that knows what has been published.
    expect(notice({ updateAvailable: false, dismissed: '1.0.0' })).toBe(false)
  })

  it('shows an undismissed version', () => {
    expect(notice()).toBe(true)
    expect(notice({ dismissed: '2.1.0' })).toBe(true)
  })

  it('stays dismissed for the version it was dismissed at', () => {
    expect(notice({ dismissed: '2.2.0' })).toBe(false)
  })

  it('comes back for the next release', () => {
    expect(notice({ latest: '2.3.0', dismissed: '2.2.0' })).toBe(true)
  })

  it('stays dismissed when a release is pulled', () => {
    // 2.3.0 dismissed, then withdrawn and `latestVersion` put back to 2.2.0.
    // Nothing new has been published since they said no, so nothing is asked.
    expect(notice({ latest: '2.2.0', dismissed: '2.3.0' })).toBe(false)
  })

  it('treats a value it cannot compare as never dismissed', () => {
    expect(notice({ dismissed: 'yesterday' })).toBe(true)
    expect(notice({ latest: 'nightly', dismissed: '2.2.0' })).toBe(true)
  })
})
