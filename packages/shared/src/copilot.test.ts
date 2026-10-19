import { describe, expect, it } from 'vitest'
import { MINIMUM_AGE } from './age'
import { copilotAgeAllows, COPILOT_RULES } from './copilot'
import { DEFAULT_APP_CONFIG } from './appConfig'
import { PLAN_LIMITS } from './limits'

describe('who Copilot is for', () => {
  const now = new Date('2026-10-18T12:00:00Z')

  it('is off for 16- and 17-year-olds by default', () => {
    expect(COPILOT_RULES.minimumAge).toBeGreaterThan(MINIMUM_AGE)
    expect(copilotAgeAllows('2010-01-01', now)).toBe(false)
  })

  /**
   * The reason it is not `ageFromBirthDate`: that one counts from the birth
   * year, and would call somebody born in December 2008 eighteen all year.
   */
  it('counts from the birthday, not the birth year', () => {
    expect(copilotAgeAllows('2008-10-19', now)).toBe(false)
    expect(copilotAgeAllows('2008-10-18', now)).toBe(true)
    expect(copilotAgeAllows('2008-12-31', now)).toBe(false)
  })

  it('opens on a 29 February birthday the day after the 28th in a common year', () => {
    expect(copilotAgeAllows('2008-02-29', new Date('2026-02-28T23:00:00Z'))).toBe(false)
    expect(copilotAgeAllows('2008-02-29', new Date('2026-03-01T00:00:00Z'))).toBe(true)
  })
})

describe("Copilot's switches and ceilings", () => {
  it('starts off: a key alone must never turn it on', () => {
    expect(DEFAULT_APP_CONFIG.flags.copilotEnabled).toBe(false)
  })

  /**
   * Every answer is a paid model call, so neither tier may be unlimited — and
   * the free taste must leave Pro something to be.
   */
  it('is finite on both tiers, and higher on Pro', () => {
    const free = PLAN_LIMITS.free.copilotPer24h
    const pro = PLAN_LIMITS.pro.copilotPer24h
    expect(free).not.toBeNull()
    expect(pro).not.toBeNull()
    expect(pro ?? 0).toBeGreaterThan(free ?? 0)
    expect(COPILOT_RULES.globalCallsPerDay).toBeGreaterThan(pro ?? 0)
  })
})
