import { describe, expect, it } from 'vitest'
import { effectiveTier } from './entitlement'

function entitlement(overrides: Partial<{ tier: 'free' | 'pro'; expiresAt: Date }> = {}) {
  return { entitlement: { tier: 'free' as const, updatedAt: new Date(), ...overrides } }
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
})
