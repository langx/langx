import { describe, expect, it } from 'vitest'
import {
  ACTIVATION_RULES,
  COHORT_RETURN_DAYS,
  RETURN_RECORDED_FROM,
  activationWindowEnd,
  isActivated,
  isActivationSettled,
  isReturnMeasurable,
  weekStartKey,
} from './measurement'

const HOUR = 60 * 60 * 1000
const SIGNED_UP = new Date('2026-10-05T10:00:00Z')

/** `hours` after the fixture's sign-up. */
const after = (hours: number): Date => new Date(SIGNED_UP.getTime() + hours * HOUR)

describe('the activation definition', () => {
  it('is two two-way conversations inside the first three days', () => {
    // Pinned because goal 3 spells it out, and a baseline taken against one
    // definition cannot be compared with a reading taken against another.
    expect(ACTIVATION_RULES).toEqual({ conversations: 2, windowHours: 72 })
  })

  it('closes the window exactly windowHours after sign-up', () => {
    expect(activationWindowEnd(SIGNED_UP).toISOString()).toBe('2026-10-08T10:00:00.000Z')
  })

  it('needs both conversations, not one', () => {
    expect(isActivated(SIGNED_UP, [after(1)])).toBe(false)
    expect(isActivated(SIGNED_UP, [after(1), after(30)])).toBe(true)
    expect(isActivated(SIGNED_UP, [])).toBe(false)
  })

  it('counts the boundary instant on both sides', () => {
    expect(isActivated(SIGNED_UP, [after(0), after(72)])).toBe(true)
  })

  it('does not count a reply that landed after the window', () => {
    expect(isActivated(SIGNED_UP, [after(10), after(72.001)])).toBe(false)
  })

  it('does not trust a reply that predates the sign-up', () => {
    expect(isActivated(SIGNED_UP, [after(-5), after(10)])).toBe(false)
  })

  it('reads its thresholds from the rules it is handed', () => {
    const lenient = { conversations: 1, windowHours: 24 }
    expect(isActivated(SIGNED_UP, [after(5)], lenient)).toBe(true)
    expect(isActivated(SIGNED_UP, [after(25)], lenient)).toBe(false)
  })

  it('is settled only once the window has closed', () => {
    expect(isActivationSettled(SIGNED_UP, after(71.99))).toBe(false)
    expect(isActivationSettled(SIGNED_UP, after(72))).toBe(true)
    expect(isActivationSettled(SIGNED_UP, after(500))).toBe(true)
  })
})

describe('when a return day can be read', () => {
  it('reads day 1, 7 and 30', () => {
    expect([...COHORT_RETURN_DAYS]).toEqual([1, 7, 30])
  })

  it('waits until the day has fully ended', () => {
    // Joined on the 10th: day 1 is the 11th, and it is only over on the 12th.
    expect(isReturnMeasurable('2026-10-10', 1, '2026-10-11')).toBe(false)
    expect(isReturnMeasurable('2026-10-10', 1, '2026-10-12')).toBe(true)
  })

  it('crosses a month end', () => {
    // Day 30 after the 10th of October is the 9th of November.
    expect(isReturnMeasurable('2026-10-10', 30, '2026-11-09')).toBe(false)
    expect(isReturnMeasurable('2026-10-10', 30, '2026-11-10')).toBe(true)
  })

  it('refuses a day from before visits were recorded', () => {
    // A visit with nothing else in it left no row, so those days read as
    // empty whoever was there.
    expect(RETURN_RECORDED_FROM).toBe('2026-09-01')
    expect(isReturnMeasurable('2026-08-20', 1, '2026-10-01')).toBe(false)
    expect(isReturnMeasurable('2026-08-31', 1, '2026-10-01')).toBe(true)
  })

  it('takes the recording date as an argument', () => {
    expect(isReturnMeasurable('2026-10-10', 1, '2026-10-20', '2026-10-12')).toBe(false)
    expect(isReturnMeasurable('2026-10-10', 1, '2026-10-20', '2026-10-11')).toBe(true)
  })
})

describe('weekStartKey', () => {
  it('is the UTC Monday of the week', () => {
    expect(weekStartKey(new Date('2026-10-05T00:00:00Z'))).toBe('2026-10-05')
    expect(weekStartKey(new Date('2026-10-07T13:30:00Z'))).toBe('2026-10-05')
    expect(weekStartKey(new Date('2026-10-11T23:59:59Z'))).toBe('2026-10-05')
    expect(weekStartKey(new Date('2026-10-12T00:00:00Z'))).toBe('2026-10-12')
  })

  it('crosses a month and a year', () => {
    expect(weekStartKey(new Date('2026-11-01T12:00:00Z'))).toBe('2026-10-26')
    expect(weekStartKey(new Date('2027-01-01T12:00:00Z'))).toBe('2026-12-28')
  })
})
