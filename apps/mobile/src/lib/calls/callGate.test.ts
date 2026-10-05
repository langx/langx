import { describe, expect, it } from 'vitest'
import { callAvailability, meetingCallOpen, type CallGateInput } from './callGate'

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

describe('meetingCallOpen', () => {
  const at = Date.parse('2026-10-04T18:00:00.000Z')
  const meeting = (status: string) => ({
    startsAt: '2026-10-04T18:00:00.000Z',
    durationMinutes: 30,
    status,
  })
  const minutes = (n: number) => at + n * 60_000

  it('opens ten minutes before an agreed time, and closes when it was meant to end', () => {
    expect(meetingCallOpen(meeting('accepted'), minutes(-11))).toBe(false)
    expect(meetingCallOpen(meeting('accepted'), minutes(-10))).toBe(true)
    expect(meetingCallOpen(meeting('accepted'), minutes(0))).toBe(true)
    expect(meetingCallOpen(meeting('accepted'), minutes(30))).toBe(true)
    expect(meetingCallOpen(meeting('accepted'), minutes(31))).toBe(false)
  })

  /** A proposal is a question, and a cancelled time is not a plan. */
  it('is never open for a time nobody agreed to', () => {
    for (const status of ['proposed', 'declined', 'cancelled']) {
      expect(meetingCallOpen(meeting(status), minutes(0))).toBe(false)
    }
    expect(meetingCallOpen(undefined, minutes(0))).toBe(false)
  })
})
