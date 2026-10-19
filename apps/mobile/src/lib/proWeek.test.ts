import { describe, expect, it } from 'vitest'
import { proWeekRecapDue, proWeekStarted, proWeekUntil, type ProWeekSubject } from './proWeek'

const NOW = new Date('2026-10-24T12:00:00Z')
const END = '2026-10-25T09:00:00Z'
const LATER = '2026-11-24T09:00:00Z'

const week = { startedAt: '2026-10-18T09:00:00Z', endsAt: END }

function me(fields: Partial<ProWeekSubject> = {}): ProWeekSubject {
  return {
    entitlement: { tier: 'pro_plus', store: 'gift', expiresAt: END },
    proWeek: week,
    ...fields,
  }
}

const free = { tier: 'free' }
const subscribed = { tier: 'pro_plus', store: 'app_store', expiresAt: LATER }
const storeTrial = { tier: 'pro_plus', store: 'play_store', expiresAt: LATER }
const lifetime = { tier: 'pro_plus', store: 'promotional' }

describe('with no Pro Week — every account while the switch is off', () => {
  const without = { entitlement: { tier: 'pro_plus', store: 'gift', expiresAt: END } }

  it('changes nothing anywhere', () => {
    expect(proWeekStarted(without)).toBe(false)
    expect(proWeekUntil(without, NOW)).toBeNull()
    expect(proWeekRecapDue(without, NOW)).toBe(false)
    expect(proWeekStarted(undefined)).toBe(false)
  })
})

describe('proWeekUntil', () => {
  it('names the end of Pro while the week runs', () => {
    expect(proWeekUntil(me(), NOW)?.toISOString()).toBe(new Date(END).toISOString())
  })

  it('names the later end when another gift is stacked on the week', () => {
    const stacked = me({ entitlement: { tier: 'pro_plus', store: 'gift', expiresAt: LATER } })
    expect(proWeekUntil(stacked, NOW)?.toISOString()).toBe(new Date(LATER).toISOString())
  })

  it('wears nothing once it has ended, or for a subscriber', () => {
    expect(proWeekUntil(me(), new Date('2026-10-26T00:00:00Z'))).toBeNull()
    expect(proWeekUntil(me({ entitlement: subscribed }), NOW)).toBeNull()
    expect(proWeekUntil(me({ entitlement: free }), NOW)).toBeNull()
  })
})

describe('proWeekStarted', () => {
  it('is the moment for a week granted or still pending', () => {
    expect(proWeekStarted(me())).toBe(true)
    // RevenueCat has not answered yet: the profile says the week began.
    expect(proWeekStarted(me({ entitlement: free, proWeek: { startedAt: week.startedAt } }))).toBe(
      true,
    )
  })

  it('is never the moment for somebody already paying', () => {
    expect(proWeekStarted(me({ entitlement: subscribed }))).toBe(false)
  })
})

describe('proWeekRecapDue', () => {
  it('is due on the last day and in the week after, once', () => {
    expect(proWeekRecapDue(me(), NOW)).toBe(true)
    expect(proWeekRecapDue(me({ entitlement: free }), new Date('2026-10-30T00:00:00Z'))).toBe(true)
    expect(proWeekRecapDue(me(), new Date('2026-10-22T00:00:00Z'))).toBe(false)
    expect(proWeekRecapDue(me({ entitlement: free }), new Date('2026-11-02T00:00:00Z'))).toBe(false)
    const seen = me({ proWeek: { ...week, recapSeenAt: '2026-10-24T10:00:00Z' } })
    expect(proWeekRecapDue(seen, NOW)).toBe(false)
  })

  it('never shows to a subscriber, a store free week, or a lifetime', () => {
    for (const entitlement of [subscribed, storeTrial, lifetime]) {
      expect(proWeekRecapDue(me({ entitlement }), NOW), entitlement.store).toBe(false)
    }
  })

  it('waits for an end date', () => {
    expect(proWeekRecapDue(me({ proWeek: { startedAt: week.startedAt } }), NOW)).toBe(false)
  })
})
