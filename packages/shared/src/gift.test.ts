import { describe, expect, it } from 'vitest'
import { giftMaximum, giftReadyAt, rollGift } from './gift'
import { TOKEN_RULES } from './token'

const { tiers } = TOKEN_RULES.gift

/** A small deterministic generator, so the statistical test is repeatable. */
function lcg(seed: number): (maxExclusive: number) => number {
  let state = seed >>> 0
  return (maxExclusive) => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return Math.floor((state / 2 ** 32) * maxExclusive)
  }
}

describe('the gift tier table', () => {
  it('is contiguous, ascending and non-overlapping from zero', () => {
    let expectedMin = 0
    for (const tier of tiers) {
      expect(tier.weight).toBeGreaterThan(0)
      expect(tier.min).toBe(expectedMin)
      expect(tier.max).toBeGreaterThanOrEqual(tier.min)
      expectedMin = tier.max + 1
    }
  })

  it('tops out at 250 and can be empty', () => {
    expect(giftMaximum()).toBe(250)
    expect(tiers[0]).toMatchObject({ min: 0, max: 0 })
  })

  it('keeps the cooldown at an hour', () => {
    expect(TOKEN_RULES.gift.cooldownMs).toBe(60 * 60 * 1000)
  })
})

describe('rollGift', () => {
  it('lands in the first tier when every draw is zero', () => {
    expect(rollGift({ tiers }, () => 0)).toEqual({ amount: 0, tier: 0 })
  })

  it('lands on the very top when every draw is the largest possible', () => {
    const roll = rollGift({ tiers }, (n) => n - 1)
    expect(roll).toEqual({ amount: 250, tier: tiers.length - 1 })
  })

  it('moves to the second tier exactly at the first tier’s weight', () => {
    const draws = [tiers[0]!.weight, 0]
    const roll = rollGift({ tiers }, () => draws.shift() ?? 0)
    expect(roll).toEqual({ amount: tiers[1]!.min, tier: 1 })
  })

  it('can reach both ends of every tier', () => {
    let offset = 0
    tiers.forEach((tier, index) => {
      const low = [offset, 0]
      const high = [offset, tier.max - tier.min]
      expect(rollGift({ tiers }, () => low.shift() ?? 0)).toEqual({ amount: tier.min, tier: index })
      expect(rollGift({ tiers }, () => high.shift() ?? 0)).toEqual({
        amount: tier.max,
        tier: index,
      })
      offset += tier.weight
    })
  })

  it('never leaves the 0–250 range', () => {
    const random = lcg(7)
    for (let i = 0; i < 10_000; i++) {
      const { amount } = rollGift({ tiers }, random)
      expect(amount).toBeGreaterThanOrEqual(0)
      expect(amount).toBeLessThanOrEqual(250)
    }
  })

  it('pays about 11 on average and mostly 30 or less', () => {
    const random = lcg(42)
    const draws = 200_000
    let sum = 0
    let small = 0
    const perTier = new Array<number>(tiers.length).fill(0)
    for (let i = 0; i < draws; i++) {
      const roll = rollGift({ tiers }, random)
      sum += roll.amount
      if (roll.amount <= 30) small++
      perTier[roll.tier]!++
    }
    const mean = sum / draws
    expect(mean).toBeGreaterThan(10)
    expect(mean).toBeLessThan(12.5)
    expect(small / draws).toBeGreaterThan(0.9)
    const totalWeight = tiers.reduce((acc, tier) => acc + tier.weight, 0)
    tiers.forEach((tier, index) => {
      const expected = tier.weight / totalWeight
      expect(Math.abs(perTier[index]! / draws - expected)).toBeLessThan(0.015)
    })
  })
})

describe('giftReadyAt', () => {
  const now = new Date('2026-09-05T12:00:00.000Z')

  it('is ready when nothing has ever been opened', () => {
    expect(giftReadyAt(null, 3_600_000, now)).toBeNull()
    expect(giftReadyAt(undefined, 3_600_000, now)).toBeNull()
  })

  it('is ready once the cooldown has passed', () => {
    expect(giftReadyAt('2026-09-05T11:00:00.000Z', 3_600_000, now)).toBeNull()
    expect(giftReadyAt(new Date('2026-09-05T10:59:59.000Z'), 3_600_000, now)).toBeNull()
  })

  it('says when, while the cooldown is running', () => {
    expect(giftReadyAt('2026-09-05T11:30:00.000Z', 3_600_000, now)?.toISOString()).toBe(
      '2026-09-05T12:30:00.000Z',
    )
  })
})
