import { describe, expect, it } from 'vitest'
import { LOYALTY_LIFETIME_GRANTS, lifetimeGrantFor } from './billing'

/**
 * The v1 loyalty gift, pinned to its literal numbers.
 *
 * `legacyLifetimeGrant.test.ts` in the API reads the thresholds back from the
 * constant and tests around them, which protects the direction of failure but
 * not the promise: edit either number and every test there stays green. On
 * 5 September 2026 the staged production records put exactly ten wallets at
 * or above the Polyglot line — the tenth holds 37,821 exactly — and 88 more
 * at or above the Fluent one. Moving a threshold changes who is in that room,
 * and this test is what makes it a decision rather than a typo.
 */
describe('LOYALTY_LIFETIME_GRANTS', () => {
  it('cuts Polyglot at v1 balance 37,821 and Fluent at 9,136', () => {
    expect(LOYALTY_LIFETIME_GRANTS.map((rung) => [rung.tier, rung.minLegacyTokenBalance])).toEqual([
      ['pro_plus', 37_821],
      ['pro', 9_136],
    ])
  })

  it('gives the tenth wallet Polyglot and the eleventh Fluent', () => {
    expect(lifetimeGrantFor(37_821)?.tier).toBe('pro_plus')
    expect(lifetimeGrantFor(36_993)?.tier).toBe('pro')
    expect(lifetimeGrantFor(9_136)?.tier).toBe('pro')
    expect(lifetimeGrantFor(9_135)).toBeNull()
  })
})
