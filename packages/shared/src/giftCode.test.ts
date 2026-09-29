import { describe, expect, it } from 'vitest'
import { GIFT_CODE_PATTERN, adminGiftCodeCreateSchema, normalizeGiftCode } from './giftCode'

describe('normalizeGiftCode', () => {
  it('is case- and space-blind', () => {
    expect(normalizeGiftCode(' uber ')).toBe('UBER')
    expect(normalizeGiftCode('Uber 2026')).toBe('UBER2026')
  })

  it('does not follow a Turkish locale into a dotted capital I', () => {
    expect(normalizeGiftCode('istanbul')).toBe('ISTANBUL')
  })
})

describe('adminGiftCodeCreateSchema', () => {
  it('stores the code in its one spelling', () => {
    const parsed = adminGiftCodeCreateSchema.parse({ code: 'summer-26', months: 2 })
    expect(parsed.code).toBe('SUMMER-26')
    expect(GIFT_CODE_PATTERN.test(parsed.code)).toBe(true)
  })

  it('refuses a code nobody could read off a poster, and a length past a year', () => {
    expect(adminGiftCodeCreateSchema.safeParse({ code: 'ab', months: 1 }).success).toBe(false)
    expect(adminGiftCodeCreateSchema.safeParse({ code: 'ÜBER', months: 1 }).success).toBe(false)
    expect(adminGiftCodeCreateSchema.safeParse({ code: '-UBER', months: 1 }).success).toBe(false)
    expect(adminGiftCodeCreateSchema.safeParse({ code: 'UBER', months: 13 }).success).toBe(false)
    expect(adminGiftCodeCreateSchema.safeParse({ code: 'UBER', months: 0 }).success).toBe(false)
  })

  it('takes no limit and no end as "none"', () => {
    const parsed = adminGiftCodeCreateSchema.parse({
      code: 'UBER',
      months: 1,
      maxRedemptions: null,
      expiresAt: null,
    })
    expect(parsed.maxRedemptions).toBeNull()
    expect(parsed.expiresAt).toBeNull()
  })
})
