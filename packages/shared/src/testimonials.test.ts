import { describe, expect, it } from 'vitest'
import {
  TESTIMONIAL_MAX_LENGTH,
  TESTIMONIAL_MIN_LENGTH,
  TESTIMONIAL_UNLOCK_MESSAGES_EACH,
  TESTIMONIAL_UNLOCK_MIN_DAYS,
  testimonialInputSchema,
  testimonialUnlocked,
} from './testimonials'

const DAY_MS = 24 * 60 * 60 * 1000
const now = new Date('2026-09-30T12:00:00.000Z')
const longAgo = new Date(now.getTime() - 30 * DAY_MS)

function gate(counts: Record<string, number> | undefined, firstMessageAt = longAgo) {
  return testimonialUnlocked({
    participants: ['a', 'b'],
    messageCountBy: counts,
    firstMessageAt,
    now,
  })
}

describe('testimonialUnlocked', () => {
  it('opens at the threshold on both sides and not one message before', () => {
    const at = TESTIMONIAL_UNLOCK_MESSAGES_EACH
    expect(gate({ a: at, b: at })).toBe(true)
    expect(gate({ a: at - 1, b: at })).toBe(false)
    expect(gate({ a: at, b: at - 1 })).toBe(false)
  })

  it('refuses a one-sided thread however long it is', () => {
    // The shared-total hole the media gate had: one person talking alone must
    // never clear a gate that is meant to need two.
    expect(gate({ a: TESTIMONIAL_UNLOCK_MESSAGES_EACH * 2 })).toBe(false)
    expect(gate({ a: TESTIMONIAL_UNLOCK_MESSAGES_EACH * 2, b: 0 })).toBe(false)
  })

  it('waits the minimum days since the first message', () => {
    const counts = { a: 100, b: 100 }
    const exactly = new Date(now.getTime() - TESTIMONIAL_UNLOCK_MIN_DAYS * DAY_MS)
    expect(gate(counts, exactly)).toBe(true)
    expect(gate(counts, new Date(exactly.getTime() + 1))).toBe(false)
  })

  it('reads missing counts as locked', () => {
    expect(gate(undefined)).toBe(false)
  })
})

describe('testimonialInputSchema', () => {
  it('trims before measuring', () => {
    const short = `  ${'x'.repeat(TESTIMONIAL_MIN_LENGTH - 1)}  `
    expect(testimonialInputSchema.safeParse({ body: short }).success).toBe(false)
    const ok = testimonialInputSchema.parse({ body: `  ${'x'.repeat(TESTIMONIAL_MIN_LENGTH)}  ` })
    expect(ok.body).toHaveLength(TESTIMONIAL_MIN_LENGTH)
  })

  it('refuses a body over the maximum', () => {
    const long = 'x'.repeat(TESTIMONIAL_MAX_LENGTH + 1)
    expect(testimonialInputSchema.safeParse({ body: long }).success).toBe(false)
  })
})
