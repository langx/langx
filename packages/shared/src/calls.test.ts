import { describe, expect, it } from 'vitest'
import {
  CALL_EVENTS,
  CALL_LIMITS,
  CALL_PROTOCOL_VERSION,
  acceptedCallProtocol,
  callRingDataSchema,
  callSignalSchema,
  endCallSchema,
  isCallPushKind,
  isUnansweredOutcome,
  registerCallEndpointSchema,
  startCallSchema,
} from './calls'
import { MESSAGE_TYPES, canDeleteForEveryone, isCallRecord } from './chat'
import { ERROR_CODES, ERROR_STATUS } from './errors'

const CALL_ID = '6f1c2a34-9b7e-4c1d-8a2f-0e5d3b7a9c11'

describe('acceptedCallProtocol', () => {
  it('reads a number and a numeric string the same way', () => {
    // React Native's socket client sends `auth` as JSON, a browser's may have
    // been through a query string: both have to mean the same client.
    expect(acceptedCallProtocol(1)).toBe(1)
    expect(acceptedCallProtocol('1')).toBe(1)
  })

  it('treats anything that is not a positive whole number as no declaration', () => {
    for (const declared of [undefined, null, '', 'yes', 0, -1, 1.5, {}, [], true]) {
      expect(acceptedCallProtocol(declared)).toBeNull()
    }
  })

  it('answers a newer client with the version this server speaks', () => {
    expect(acceptedCallProtocol(CALL_PROTOCOL_VERSION + 5)).toBe(CALL_PROTOCOL_VERSION)
  })
})

describe('startCallSchema', () => {
  it('takes a uuid, a conversation and a medium', () => {
    const parsed = startCallSchema.parse({ callId: CALL_ID, conversationId: 'c1', media: 'video' })
    expect(parsed.media).toBe('video')
  })

  it('refuses an id CallKit could not key a call on', () => {
    expect(
      startCallSchema.safeParse({ callId: 'not-a-uuid', conversationId: 'c1', media: 'audio' })
        .success,
    ).toBe(false)
  })

  it('refuses a medium that does not exist', () => {
    expect(
      startCallSchema.safeParse({ callId: CALL_ID, conversationId: 'c1', media: 'screen' }).success,
    ).toBe(false)
  })
})

describe('endCallSchema', () => {
  it('needs no reason, and accepts only the three a device can give', () => {
    expect(endCallSchema.safeParse({ callId: CALL_ID }).success).toBe(true)
    expect(endCallSchema.safeParse({ callId: CALL_ID, reason: 'connectionLost' }).success).toBe(
      true,
    )
    // The server's own reasons are not a client's to claim.
    expect(endCallSchema.safeParse({ callId: CALL_ID, reason: 'timeout' }).success).toBe(false)
  })
})

describe('callSignalSchema', () => {
  it('refuses a signal that carries nothing', () => {
    expect(callSignalSchema.safeParse({ callId: CALL_ID }).success).toBe(false)
  })

  it('takes a description, a batch of candidates, or either marker', () => {
    expect(
      callSignalSchema.safeParse({ callId: CALL_ID, description: { type: 'offer', sdp: 'v=0' } })
        .success,
    ).toBe(true)
    expect(
      callSignalSchema.safeParse({
        callId: CALL_ID,
        candidates: [{ candidate: 'candidate:1 1 udp 1 203.0.113.1 9 typ relay', sdpMid: '0' }],
      }).success,
    ).toBe(true)
    expect(callSignalSchema.safeParse({ callId: CALL_ID, endOfCandidates: true }).success).toBe(
      true,
    )
    expect(callSignalSchema.safeParse({ callId: CALL_ID, restart: true }).success).toBe(true)
  })

  it('bounds what one device can make another parse', () => {
    const tooLong = 'x'.repeat(CALL_LIMITS.sdpMaxBytes + 1)
    expect(
      callSignalSchema.safeParse({ callId: CALL_ID, description: { type: 'offer', sdp: tooLong } })
        .success,
    ).toBe(false)

    const candidate = { candidate: 'candidate:1 1 udp 1 203.0.113.1 9 typ relay' }
    const tooMany = Array.from({ length: CALL_LIMITS.candidatesPerSignal + 1 }, () => candidate)
    expect(callSignalSchema.safeParse({ callId: CALL_ID, candidates: tooMany }).success).toBe(false)
  })

  it('does not let a description claim to be anything but an offer or an answer', () => {
    expect(
      callSignalSchema.safeParse({ callId: CALL_ID, description: { type: 'rollback', sdp: 'v=0' } })
        .success,
    ).toBe(false)
  })
})

describe('registerCallEndpointSchema', () => {
  it('takes an Android phone with no token at all', () => {
    expect(
      registerCallEndpointSchema.safeParse({ deviceId: 'd1', platform: 'android', protocol: 1 })
        .success,
    ).toBe(true)
  })

  it('takes a hex PushKit token and refuses anything else in its place', () => {
    const base = { deviceId: 'd1', platform: 'ios', protocol: 1 }
    expect(
      registerCallEndpointSchema.safeParse({ ...base, voipToken: 'a1'.repeat(32) }).success,
    ).toBe(true)
    // An Expo push token is the mistake most likely to be made here.
    expect(
      registerCallEndpointSchema.safeParse({ ...base, voipToken: 'ExponentPushToken[abc]' })
        .success,
    ).toBe(false)
  })

  it('has no web platform: a browser is rung over its socket or not at all', () => {
    expect(
      registerCallEndpointSchema.safeParse({ deviceId: 'd1', platform: 'web', protocol: 1 })
        .success,
    ).toBe(false)
  })
})

describe('call pushes', () => {
  it('names exactly the two kinds native code acts on', () => {
    expect(isCallPushKind('callRing')).toBe(true)
    expect(isCallPushKind('callCancel')).toBe(true)
    // The drawn fallback is an ordinary notification and must not be routed
    // to the native ringer.
    expect(isCallPushKind('call')).toBe(false)
    expect(isCallPushKind(undefined)).toBe(false)
  })

  it('carries who is calling, so a phone can ring without asking', () => {
    const ring = callRingDataSchema.parse({
      kind: 'callRing',
      callId: CALL_ID,
      conversationId: 'c1',
      media: 'audio',
      callerId: 'u1',
      callerName: 'Sofia',
      callerHandle: 'sofia',
      ringSeconds: 45,
      callToken: 'token',
    })
    expect(ring.callerName).toBe('Sofia')
  })
})

describe('outcomes', () => {
  it('counts the three in which nobody picked up', () => {
    expect(isUnansweredOutcome('missed')).toBe(true)
    expect(isUnansweredOutcome('declined')).toBe(true)
    expect(isUnansweredOutcome('busy')).toBe(true)
    // Answered and then lost is not somebody ignoring a call.
    expect(isUnansweredOutcome('failed')).toBe(false)
    expect(isUnansweredOutcome('completed')).toBe(false)
  })
})

describe('the call row among messages', () => {
  it('is a message type', () => {
    expect(MESSAGE_TYPES).toContain('call')
    expect(isCallRecord({ type: 'call' })).toBe(true)
    expect(isCallRecord({ type: 'text' })).toBe(false)
  })

  it('cannot be withdrawn from the other person, even by the caller', () => {
    const now = new Date('2026-10-04T12:00:00Z')
    const row = { senderId: 'u1', createdAt: '2026-10-04T11:59:00Z' }
    expect(canDeleteForEveryone({ ...row, type: 'text' }, 'u1', now)).toBe(true)
    expect(canDeleteForEveryone({ ...row, type: 'call' }, 'u1', now)).toBe(false)
  })
})

describe('the contract around it', () => {
  it('gives every call error a status', () => {
    for (const code of Object.values(ERROR_CODES)) {
      expect(ERROR_STATUS[code], code).toBeGreaterThanOrEqual(400)
    }
    expect(ERROR_STATUS.CALL_COOLDOWN).toBe(429)
    expect(ERROR_STATUS.CALLS_UNAVAILABLE).toBe(503)
  })

  it('uses each event name once', () => {
    const names = Object.values(CALL_EVENTS)
    expect(new Set(names).size).toBe(names.length)
    for (const name of names) expect(name.startsWith('call:')).toBe(true)
  })

  it('keeps the lease longer than the gap between heartbeats', () => {
    // Otherwise a healthy call expires between two of its own heartbeats.
    expect(CALL_LIMITS.leaseSeconds).toBeGreaterThan(CALL_LIMITS.heartbeatSeconds * 2)
  })
})
