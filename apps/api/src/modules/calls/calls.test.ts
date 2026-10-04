import { DEFAULT_LOCALE } from '@langx/shared'
import { ObjectId } from 'mongodb'
import { describe, expect, it } from 'vitest'
import type { Device } from '../push/devices'
import { CALL_TOKEN_GRACE_SECONDS, signCallToken, verifyCallToken } from './callToken'
import {
  durationSecondsOf,
  outcomeOf,
  reachedMaxDuration,
  wireReason,
  type Call,
  type CallEndCause,
} from './calls'
import type { CallEndpoint } from './endpoints'
import { hasRingTargets, ringTargets } from './ring'

/**
 * The parts of a call that need no database: what a call that ended is
 * remembered as, what each audience is told, which phones a ring goes to, and
 * the ticket that declines one. `ws/calls.test.ts` covers everything that
 * needs a socket and a replica set.
 */
describe('outcomeOf', () => {
  const ended = (endedFrom: NonNullable<Call['endedFrom']>, endCause: CallEndCause) => ({
    endedFrom,
    endCause,
  })

  it('remembers a call nobody picked up by who it was that ended it', () => {
    // The caller giving up and the ring running out are the same row to the
    // person who was called.
    expect(outcomeOf(ended('ringing', 'cancelled'))).toBe('missed')
    expect(outcomeOf(ended('ringing', 'timeout'))).toBe('missed')
    expect(outcomeOf(ended('ringing', 'declined'))).toBe('declined')
  })

  it('keeps "busy" and "nothing to ring" apart from each other', () => {
    expect(outcomeOf(ended('ringing', 'busy'))).toBe('busy')
    expect(outcomeOf(ended('ringing', 'unreachable'))).toBe('missed')
  })

  it('does not blame a person for a path that never came up', () => {
    expect(outcomeOf(ended('connecting', 'connectFailed'))).toBe('failed')
    expect(outcomeOf(ended('connecting', 'lost'))).toBe('failed')
    // Hanging up before it connected is still a call both agreed to.
    expect(outcomeOf(ended('connecting', 'hangup'))).toBe('completed')
  })

  it('calls anything that reached media a completed call, however it ended', () => {
    const causes: CallEndCause[] = [
      'hangup',
      'connectionLost',
      'lost',
      'maxDuration',
      'blocked',
      'suspended',
      'deleted',
    ]
    for (const cause of causes) expect(outcomeOf(ended('active', cause)), cause).toBe('completed')
  })

  it('counts a call ended by moderation while it rang as one the callee missed', () => {
    expect(outcomeOf(ended('ringing', 'blocked'))).toBe('missed')
  })
})

describe('wireReason', () => {
  it('never tells either person that it was a block, a suspension or a deletion', () => {
    for (const cause of ['blocked', 'suspended', 'deleted'] as const) {
      expect(wireReason(cause)).toBe('ended')
    }
    // Nor that a phone had nothing to ring: that is the callee's business.
    expect(wireReason('unreachable')).toBe('ended')
  })

  it('folds the two ways a line goes dead into one', () => {
    expect(wireReason('lost')).toBe('connectionLost')
    expect(wireReason('connectionLost')).toBe('connectionLost')
  })

  it('passes the rest through as they are', () => {
    for (const cause of [
      'cancelled',
      'declined',
      'timeout',
      'busy',
      'hangup',
      'connectFailed',
      'maxDuration',
    ] as const) {
      expect(wireReason(cause)).toBe(cause)
    }
  })
})

describe('durationSecondsOf', () => {
  it('measures from media to the end, in whole seconds', () => {
    const connectedAt = new Date('2026-10-04T10:00:00.000Z')
    expect(durationSecondsOf({ connectedAt, endedAt: new Date('2026-10-04T10:03:12.400Z') })).toBe(
      192,
    )
  })

  it('has nothing to say about a call that never connected', () => {
    expect(durationSecondsOf({ endedAt: new Date() })).toBeUndefined()
  })
})

describe('reachedMaxDuration', () => {
  it('tells a call that hit the ceiling from one whose devices went quiet', () => {
    const connectedAt = new Date('2026-10-04T10:00:00.000Z')
    const ceiling = new Date('2026-10-04T12:00:00.000Z')
    expect(reachedMaxDuration({ connectedAt, deadline: ceiling })).toBe(true)
    expect(
      reachedMaxDuration({ connectedAt, deadline: new Date('2026-10-04T10:05:00.000Z') }),
    ).toBe(false)
  })
})

describe('ringTargets', () => {
  const endpoint = (overrides: Partial<CallEndpoint>): CallEndpoint => ({
    _id: new ObjectId(),
    userId: 'u1',
    deviceId: 'd1',
    platform: 'ios',
    protocol: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  })
  const device = (overrides: Partial<Device>): Device => ({
    _id: new ObjectId(),
    userId: 'u1',
    pushToken: 'ExponentPushToken[x]',
    platform: 'ios',
    deviceId: 'd1',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  })
  const voip = { token: 'ab'.repeat(32), environment: 'production' as const }

  it('rings an iPhone through Apple without needing its notification permission', () => {
    // No device row at all: notifications were never allowed on this phone.
    const targets = ringTargets([endpoint({ voip })], [], true)
    expect(targets).toEqual({ voip: [voip], android: [], fallback: [] })
  })

  it('falls back to a notification where the call screen is not allowed', () => {
    const targets = ringTargets(
      [endpoint({ voip, callKit: false })],
      [device({ locale: 'tr' })],
      true,
    )
    expect(targets.voip).toEqual([])
    expect(targets.fallback).toEqual([{ token: 'ExponentPushToken[x]', locale: 'tr' }])
  })

  it('falls back for every iPhone when this deployment has no key for Apple', () => {
    const targets = ringTargets([endpoint({ voip })], [device({})], false)
    expect(targets.voip).toEqual([])
    expect(targets.fallback).toEqual([{ token: 'ExponentPushToken[x]', locale: DEFAULT_LOCALE }])
  })

  it('rings an Android phone only through a device row that is still deliverable', () => {
    const android = endpoint({ platform: 'android' })
    const row = device({ platform: 'android', pushToken: 'ExponentPushToken[a]' })
    expect(ringTargets([android], [row], true).android).toEqual(['ExponentPushToken[a]'])
    // Silenced on the phone itself, so `devicesFor` did not return it.
    expect(hasRingTargets(ringTargets([android], [], true))).toBe(false)
  })

  it('never matches an endpoint to another phone’s row', () => {
    const targets = ringTargets(
      [endpoint({ platform: 'android', deviceId: 'phone' })],
      [device({ platform: 'android', deviceId: 'tablet' })],
      true,
    )
    expect(hasRingTargets(targets)).toBe(false)
  })

  it('leaves out the phone that just answered', () => {
    const endpoints = [
      endpoint({ platform: 'android', deviceId: 'phone' }),
      endpoint({ platform: 'android', deviceId: 'tablet' }),
    ]
    const devices = [
      device({ platform: 'android', deviceId: 'phone', pushToken: 'ExponentPushToken[phone]' }),
      device({ platform: 'android', deviceId: 'tablet', pushToken: 'ExponentPushToken[tablet]' }),
    ]
    expect(ringTargets(endpoints, devices, true, 'phone').android).toEqual([
      'ExponentPushToken[tablet]',
    ])
  })
})

describe('call tokens', () => {
  const secret = 's'.repeat(32)
  const call = { callId: '6f1c2a34-9b7e-4c1d-8a2f-0e5d3b7a9c11', userId: 'callee' }
  const expiresAt = new Date('2026-10-04T10:01:45.000Z')
  const during = new Date('2026-10-04T10:01:00.000Z')

  it('verifies for the call and the person it was issued for', () => {
    const token = signCallToken(secret, { ...call, expiresAt })
    expect(verifyCallToken(secret, token, call, during)).toBe(true)
  })

  it('is worthless for any other call or any other person', () => {
    const token = signCallToken(secret, { ...call, expiresAt })
    expect(
      verifyCallToken(
        secret,
        token,
        { ...call, callId: '00000000-0000-4000-8000-000000000000' },
        during,
      ),
    ).toBe(false)
    expect(verifyCallToken(secret, token, { ...call, userId: 'caller' }, during)).toBe(false)
    expect(verifyCallToken('t'.repeat(32), token, call, during)).toBe(false)
  })

  it('stops working once the ring is well over', () => {
    const token = signCallToken(secret, { ...call, expiresAt })
    expect(verifyCallToken(secret, token, call, new Date(expiresAt.getTime() + 1000))).toBe(false)
    expect(CALL_TOKEN_GRACE_SECONDS).toBeGreaterThan(0)
  })

  it('cannot have its expiry pushed out by whoever holds it', () => {
    const token = signCallToken(secret, { ...call, expiresAt })
    const [, signature] = token.split('.')
    const later = Math.floor(expiresAt.getTime() / 1000) + 3600
    expect(verifyCallToken(secret, `${later}.${signature}`, call, during)).toBe(false)
  })

  it('refuses anything that is not a token without throwing', () => {
    for (const junk of ['', '.', 'abc', '123.', '.abc', 'NaN.abc', '1e3.abc']) {
      expect(verifyCallToken(secret, junk, call, during), junk).toBe(false)
    }
  })
})
