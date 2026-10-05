import { describe, expect, it } from 'vitest'
import { reduceCall, showsClosingLine, type CallEvent, type CallState } from './machine'

const peer = { _id: 'u2', handle: 'sofia', displayName: 'Sofia' }
const CALL = 'call-1'

function run(events: CallEvent[], from: CallState | null = null): CallState | null {
  return events.reduce(reduceCall, from)
}

const placed: CallEvent = {
  type: 'placed',
  callId: CALL,
  conversationId: 'c1',
  peer,
  media: 'audio',
  ringUntil: 45_000,
}
const incoming: CallEvent = { ...placed, type: 'incoming' }

describe('reduceCall', () => {
  it('starts an outgoing call ringing, with the microphone on', () => {
    expect(run([placed])).toMatchObject({
      phase: 'outgoing',
      role: 'caller',
      micOn: true,
      cameraOn: false,
      remoteRinging: false,
      connectedAt: null,
    })
  })

  it('starts a video call with the caller’s camera on, and the callee’s off', () => {
    // The caller chose video. Somebody being rung has chosen nothing yet.
    expect(run([{ ...placed, media: 'video' }])?.cameraOn).toBe(true)
    expect(run([{ ...incoming, media: 'video' }])?.cameraOn).toBe(false)
  })

  it('walks a call it placed from ringing to talking', () => {
    const state = run([
      placed,
      { type: 'remoteRinging', callId: CALL },
      { type: 'accepted', callId: CALL },
      { type: 'connected', callId: CALL, at: 1000 },
    ])
    expect(state).toMatchObject({ phase: 'active', remoteRinging: true, connectedAt: 1000 })
  })

  it('walks a call it answered the same way, remembering how it was answered', () => {
    const state = run([
      { ...incoming, media: 'video' },
      { type: 'answering', callId: CALL, cameraOn: false },
      { type: 'connected', callId: CALL, at: 2000 },
    ])
    // A video call answered without the camera is still a video call.
    expect(state).toMatchObject({ phase: 'active', media: 'video', cameraOn: false })
  })

  it('does not restart the clock when a dropped call comes back', () => {
    const state = run([
      placed,
      { type: 'accepted', callId: CALL },
      { type: 'connected', callId: CALL, at: 1000 },
      { type: 'reconnecting', callId: CALL, value: true },
      { type: 'connected', callId: CALL, at: 9000 },
    ])
    expect(state).toMatchObject({ phase: 'active', connectedAt: 1000, reconnecting: false })
  })

  /** Events arrive late, and about calls that are no longer the one on screen. */
  it('ignores everything said about some other call', () => {
    const before = run([placed, { type: 'accepted', callId: CALL }])
    const late: CallEvent[] = [
      { type: 'connected', callId: 'other', at: 1 },
      { type: 'remoteMedia', callId: 'other', audio: false, video: true },
      { type: 'closed', callId: 'other', closing: { kind: 'ended', reason: 'hangup' } },
    ]
    expect(run(late, before)).toBe(before)
  })

  it('does not let a new ring replace a call in progress', () => {
    const talking = run([placed, { type: 'accepted', callId: CALL }])
    expect(run([{ ...incoming, callId: 'second' }], talking)).toBe(talking)
  })

  it('lets a new call take the place of a closing line', () => {
    const closed = run([
      placed,
      { type: 'closed', callId: CALL, closing: { kind: 'ended', reason: 'timeout' } },
    ])
    expect(run([{ ...incoming, callId: 'second' }], closed)).toMatchObject({
      callId: 'second',
      phase: 'incoming',
    })
  })

  it('only lets a call that is up be put away, and brings it back to close', () => {
    // A ringing call has to be seen.
    expect(run([incoming, { type: 'minimized', value: true }])?.minimized).toBe(false)

    const away = run([
      placed,
      { type: 'accepted', callId: CALL },
      { type: 'connected', callId: CALL, at: 1 },
      { type: 'minimized', value: true },
    ])
    expect(away?.minimized).toBe(true)

    const closed = run(
      [{ type: 'closed', callId: CALL, closing: { kind: 'ended', reason: 'hangup' } }],
      away,
    )
    expect(closed).toMatchObject({ phase: 'ended', minimized: false })
  })

  it('tracks each side’s microphone and camera separately', () => {
    const state = run([
      placed,
      { type: 'localMedia', callId: CALL, micOn: false },
      { type: 'remoteMedia', callId: CALL, audio: true, video: true },
      { type: 'localMedia', callId: CALL, cameraOn: true },
    ])
    expect(state).toMatchObject({
      micOn: false,
      cameraOn: true,
      remoteMicOn: true,
      remoteCameraOn: true,
    })
  })

  it('closes once, and keeps the first reason', () => {
    const state = run([
      placed,
      { type: 'closed', callId: CALL, closing: { kind: 'ended', reason: 'timeout' } },
      { type: 'closed', callId: CALL, closing: { kind: 'ended', reason: 'hangup' } },
    ])
    expect(state?.closing).toEqual({ kind: 'ended', reason: 'timeout' })
  })

  it('clears to nothing', () => {
    expect(run([placed, { type: 'cleared' }])).toBeNull()
    expect(run([{ type: 'connected', callId: CALL, at: 1 }])).toBeNull()
  })
})

describe('showsClosingLine', () => {
  const closedWith = (
    start: CallEvent,
    between: CallEvent[],
    reason: 'hangup' | 'timeout' | 'cancelled' | 'answeredElsewhere' | 'declined',
  ): CallState =>
    run([
      start,
      ...between,
      { type: 'closed', callId: CALL, closing: { kind: 'ended', reason } },
    ]) as CallState

  it('says how a call that connected ended, to both people', () => {
    const talked: CallEvent[] = [
      { type: 'accepted', callId: CALL },
      { type: 'connected', callId: CALL, at: 1 },
    ]
    expect(showsClosingLine(closedWith(placed, talked, 'hangup'), false)).toBe(true)
    expect(showsClosingLine(closedWith(placed, talked, 'hangup'), true)).toBe(true)
  })

  it('tells the caller nobody answered', () => {
    expect(showsClosingLine(closedWith(placed, [], 'timeout'), false)).toBe(true)
  })

  it('says nothing about a ring the person dismissed or missed', () => {
    // They turned it down themselves, or it stopped ringing: nothing to add.
    expect(showsClosingLine(closedWith(incoming, [], 'declined'), true)).toBe(false)
    expect(showsClosingLine(closedWith(incoming, [], 'cancelled'), false)).toBe(false)
    expect(showsClosingLine(closedWith(incoming, [], 'answeredElsewhere'), false)).toBe(false)
  })

  it('says nothing when the caller cancels their own call', () => {
    expect(showsClosingLine(closedWith(placed, [], 'cancelled'), true)).toBe(false)
  })

  it('always explains a call the server would not place', () => {
    const refused = run([
      placed,
      { type: 'closed', callId: CALL, closing: { kind: 'refused', code: 'CALL_BUSY' } },
    ]) as CallState
    expect(showsClosingLine(refused, false)).toBe(true)
  })
})
