import type { StoredPlanTier } from '@langx/shared'
import { describe, expect, it } from 'vitest'
import { effectiveTier } from './entitlement'

function entitlement(overrides: Partial<{ tier: StoredPlanTier; expiresAt: Date }> = {}) {
  return { entitlement: { tier: 'free' as StoredPlanTier, updatedAt: new Date(), ...overrides } }
}

describe('effectiveTier', () => {
  it('free stays free regardless of expiresAt', () => {
    expect(effectiveTier(entitlement({ tier: 'free' }))).toBe('free')
  })

  it('pro with no expiresAt (e.g. lifetime/grandfathered) stays pro', () => {
    expect(effectiveTier(entitlement({ tier: 'pro' }))).toBe('pro')
  })

  it('pro with a future expiresAt stays pro', () => {
    const future = new Date(Date.now() + 60_000)
    expect(effectiveTier(entitlement({ tier: 'pro', expiresAt: future }))).toBe('pro')
  })

  it('pro with a past expiresAt is downgraded to free — the whole point of this function', () => {
    const past = new Date(Date.now() - 60_000)
    expect(effectiveTier(entitlement({ tier: 'pro', expiresAt: past }))).toBe('free')
  })

  /** A Polyglot row the merge script has not reached yet is Pro. */
  it('pro_plus with a future expiresAt is pro', () => {
    const future = new Date(Date.now() + 60_000)
    expect(effectiveTier(entitlement({ tier: 'pro_plus', expiresAt: future }))).toBe('pro')
  })

  it('pro_plus with a past expiresAt is downgraded to free', () => {
    const past = new Date(Date.now() - 60_000)
    expect(effectiveTier(entitlement({ tier: 'pro_plus', expiresAt: past }))).toBe('free')
  })
})
