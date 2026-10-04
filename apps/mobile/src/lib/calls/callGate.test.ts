import { describe, expect, it } from 'vitest'
import { callAvailability, type CallGateInput } from './callGate'

const open: CallGateInput = {
  callService: true,
  engineSupported: true,
  readOnly: false,
  partnerKnown: true,
  partnerAcceptsCalls: true,
  viewerRefusesCalls: false,
  lockedFor: 0,
}

describe('callAvailability', () => {
  it('offers a call when nothing stands in the way', () => {
    expect(callAvailability(open)).toBe('ready')
  })

  /** Disabled rather than hidden: the rule is only worth having if people know it. */
  it('draws the buttons behind the consent gate, and says how far off it is', () => {
    expect(callAvailability({ ...open, lockedFor: 3 })).toBe('locked')
  })

  it('draws nothing where a call cannot happen and the reader can do nothing about it', () => {
    const blockers: Partial<CallGateInput>[] = [
      { callService: false },
      // A phone, until the native module is in its build.
      { engineSupported: false },
      { readOnly: true },
      { partnerKnown: false },
      { partnerAcceptsCalls: false },
      { viewerRefusesCalls: true },
    ]
    for (const blocker of blockers) {
      expect(callAvailability({ ...open, ...blocker }), JSON.stringify(blocker)).toBe('hidden')
    }
  })

  it('hides rather than locks when both apply', () => {
    // "Three more messages" is a promise the app could not keep here.
    expect(callAvailability({ ...open, lockedFor: 3, partnerAcceptsCalls: false })).toBe('hidden')
  })
})
