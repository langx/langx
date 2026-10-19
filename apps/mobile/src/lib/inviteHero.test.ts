import { PRO_GIFT_RULES } from '@langx/shared'
import { describe, expect, it } from 'vitest'
import { inviteHeroFor } from './inviteHero'

const DAY = 24 * 60 * 60 * 1000
const later = () => new Date(Date.now() + 10 * DAY).toISOString()
const earlier = () => new Date(Date.now() - DAY).toISOString()

describe('inviteHeroFor', () => {
  it('leads with nothing while the switch is off, whoever is looking', () => {
    for (const guest of [true, false]) {
      expect(inviteHeroFor({ giveAWeek: false, guest, held: { tier: 'free' } })).toBeNull()
      expect(
        inviteHeroFor({
          giveAWeek: false,
          guest,
          held: { tier: 'pro', store: 'gift', expiresAt: later() },
        }),
      ).toBeNull()
    }
  })

  it('shows a guest the deal, not an invite link they do not have', () => {
    expect(inviteHeroFor({ giveAWeek: true, guest: true, held: { tier: 'free' } })).toBe('guest')
  })

  it('offers a week each on the free plan, and before the profile has loaded', () => {
    expect(inviteHeroFor({ giveAWeek: true, guest: false, held: { tier: 'free' } })).toBe('earn')
    expect(inviteHeroFor({ giveAWeek: true, guest: false, held: undefined })).toBe('earn')
  })

  /** A lapsed subscription whose webhook never came is free, by the server's rule. */
  it('reads a lapsed plan as free', () => {
    expect(
      inviteHeroFor({
        giveAWeek: true,
        guest: false,
        held: { tier: 'pro', store: 'app_store', expiresAt: earlier() },
      }),
    ).toBe('earn')
  })

  it('adds the week to a gift that ends', () => {
    expect(
      inviteHeroFor({
        giveAWeek: true,
        guest: false,
        held: { tier: 'pro', store: 'gift', expiresAt: later() },
      }),
    ).toBe('earnOnGift')
  })

  it('never promises a subscriber or a lifetime a week of what they already have', () => {
    expect(
      inviteHeroFor({
        giveAWeek: true,
        guest: false,
        held: { tier: 'pro', store: 'app_store', expiresAt: later() },
      }),
    ).toBe('give')
    expect(
      inviteHeroFor({
        giveAWeek: true,
        guest: false,
        held: { tier: 'pro', store: 'promotional', expiresAt: null },
      }),
    ).toBe('give')
  })

  /**
   * "Give a week of Pro, get a week" says one number for both sides; the
   * invite screen's copy is written for that, and has to be rewritten the
   * day the two lengths differ.
   */
  it('has one length for both sides, as the copy says', () => {
    expect(PRO_GIFT_RULES.giveAWeek.referrerWeeks).toBe(PRO_GIFT_RULES.giveAWeek.inviteeWeeks)
  })
})
