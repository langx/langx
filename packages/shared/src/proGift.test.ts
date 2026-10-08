import { describe, expect, it } from 'vitest'
import {
  PRO_GIFT_RULES,
  adminGiftProSchema,
  addMonthsUtc,
  referralGiftSlots,
  streakGiftsOwed,
} from './proGift'

describe('addMonthsUtc', () => {
  it('adds calendar months and keeps the time of day', () => {
    expect(addMonthsUtc(new Date('2026-09-28T10:15:00Z'), 3).toISOString()).toBe(
      '2026-12-28T10:15:00.000Z',
    )
    expect(addMonthsUtc(new Date('2026-11-15T00:00:00Z'), 12).toISOString()).toBe(
      '2027-11-15T00:00:00.000Z',
    )
  })

  it('lands on the last day of a shorter month rather than spilling over', () => {
    expect(addMonthsUtc(new Date('2027-01-31T12:00:00Z'), 1).toISOString()).toBe(
      '2027-02-28T12:00:00.000Z',
    )
    expect(addMonthsUtc(new Date('2028-01-31T12:00:00Z'), 1).toISOString()).toBe(
      '2028-02-29T12:00:00.000Z',
    )
  })
})

describe('streakGiftsOwed', () => {
  it('owes nothing below the first milestone', () => {
    expect(streakGiftsOwed(6)).toEqual([])
  })

  it('owes a week at seven days', () => {
    expect(streakGiftsOwed(7)).toEqual([{ days: 7, months: 0, weeks: 1 }])
    expect(streakGiftsOwed(99, [7])).toEqual([])
  })

  it('owes a milestone at or past it, once', () => {
    expect(streakGiftsOwed(100, [7])).toEqual([{ days: 100, months: 1, weeks: 0 }])
    expect(streakGiftsOwed(250, [7, 100])).toEqual([])
  })

  /** A v1 restore of four hundred days earns every rung on its first action. */
  it('owes every rung a long streak has passed', () => {
    const owed = streakGiftsOwed(400)
    expect(owed.map((rung) => rung.days)).toEqual([7, 100, 365])
    expect(owed.reduce((sum, rung) => sum + rung.months, 0)).toBe(4)
    expect(owed.reduce((sum, rung) => sum + rung.weeks, 0)).toBe(1)
  })
})

describe('referralGiftSlots', () => {
  const { activationsPerGift, maxGiftsPerYear } = PRO_GIFT_RULES.referral

  it('is one slot per full group of activations', () => {
    expect(referralGiftSlots(activationsPerGift - 1)).toBe(0)
    expect(referralGiftSlots(activationsPerGift)).toBe(1)
    expect(referralGiftSlots(activationsPerGift * 2 + 1)).toBe(2)
  })

  it('never passes the yearly cap', () => {
    expect(referralGiftSlots(activationsPerGift * 50)).toBe(maxGiftsPerYear)
  })
})

describe('adminGiftProSchema', () => {
  it('takes the offered lengths and nothing else', () => {
    expect(adminGiftProSchema.safeParse({ months: 6 }).success).toBe(true)
    expect(adminGiftProSchema.safeParse({ months: 2 }).success).toBe(false)
    expect(adminGiftProSchema.safeParse({ months: 24 }).success).toBe(false)
  })
})
