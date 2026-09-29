import { describe, expect, it } from 'vitest'
import { LOYALTY_LIFETIME_GRANTS, lifetimeGrantFor } from './billing'

/**
 * The v1 loyalty gift, pinned to its literal number.
 *
 * `legacyLifetimeGrant.test.ts` in the API reads the threshold back from the
 * constant and tests around it, which protects the direction of failure but
 * not the promise. There were two rungs while there were two paid plans; the
 * p99 one (37,821, Polyglot) is folded into this one, which gives the same
 * single plan. Moving the number changes who is in that room, and this test is
 * what makes it a decision rather than a typo.
 */
describe('LOYALTY_LIFETIME_GRANTS', () => {
  it('cuts lifetime Pro at v1 balance 9,136', () => {
    expect(LOYALTY_LIFETIME_GRANTS.map((rung) => [rung.tier, rung.minLegacyTokenBalance])).toEqual([
      ['pro', 9_136],
    ])
  })

  it('gives the old Polyglot and Fluent wallets the same Pro', () => {
    expect(lifetimeGrantFor(37_821)?.tier).toBe('pro')
    expect(lifetimeGrantFor(9_136)?.tier).toBe('pro')
    expect(lifetimeGrantFor(9_135)).toBeNull()
  })
})
