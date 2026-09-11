import { describe, expect, it } from 'vitest'
import { meState } from './meState'

describe('meState', () => {
  it('goes to the app when the profile is here', () => {
    expect(meState({ hasProfile: true, errorStatus: undefined })).toBe('ready')
  })

  it('treats a 404 as the onboarding it was built to report', () => {
    expect(meState({ hasProfile: false, errorStatus: 404 })).toBe('onboarding')
  })

  it('does not send a member with no network into onboarding', () => {
    // No status at all: the request never reached a server.
    expect(meState({ hasProfile: false, errorStatus: undefined })).toBe('failed')
  })

  it('treats a server-side refusal as a failure too, not as a missing profile', () => {
    expect(meState({ hasProfile: false, errorStatus: 500 })).toBe('failed')
    expect(meState({ hasProfile: false, errorStatus: 401 })).toBe('failed')
  })
})
