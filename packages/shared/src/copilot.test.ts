import { describe, expect, it } from 'vitest'
import {
  adminCopilotAccessRequestSchema,
  copilotResultSchema,
  COPILOT_RULES,
  copilotSayItRequestSchema,
  COPILOT_UNAVAILABLE_REASONS,
} from './copilot'
import { DEFAULT_APP_CONFIG } from './appConfig'
import { PLAN_LIMITS } from './limits'

describe('who Copilot is for', () => {
  /**
   * The app's own minimum is the only age rule: Copilot keeps no number of
   * its own, so there is nothing for a 16-year-old to fall short of.
   */
  it('has no age rule of its own', () => {
    expect(COPILOT_RULES).not.toHaveProperty('minimumAge')
    expect(COPILOT_UNAVAILABLE_REASONS).not.toContain('age')
    expect(COPILOT_UNAVAILABLE_REASONS).not.toContain('partner_age')
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

describe('Say it', () => {
  const base = { conversationId: 'c1', text: 'Yarın görüşelim mi?', targetLanguage: 'en' }

  it('takes a short line and a language code', () => {
    expect(copilotSayItRequestSchema.parse({ ...base, text: '  hi  ' }).text).toBe('hi')
    expect(copilotSayItRequestSchema.safeParse(base).success).toBe(true)
  })

  it('refuses an empty line, a paragraph, or no language', () => {
    expect(copilotSayItRequestSchema.safeParse({ ...base, text: '   ' }).success).toBe(false)
    expect(
      copilotSayItRequestSchema.safeParse({
        ...base,
        text: 'a'.repeat(COPILOT_RULES.maxSayItChars + 1),
      }).success,
    ).toBe(false)
    expect(copilotSayItRequestSchema.safeParse({ ...base, targetLanguage: 'e' }).success).toBe(
      false,
    )
  })

  it('answers with options, each with a gloss', () => {
    const result = { action: 'sayIt', options: [{ text: 'See you tomorrow?', gloss: 'casual' }] }
    expect(copilotResultSchema.safeParse(result).success).toBe(true)
    expect(
      copilotResultSchema.safeParse({ action: 'sayIt', options: [{ text: 'x' }] }).success,
    ).toBe(false)
  })
})

describe('the operator allow-list', () => {
  it('takes a yes or a no, and nothing else', () => {
    expect(adminCopilotAccessRequestSchema.safeParse({ allowed: true }).success).toBe(true)
    expect(adminCopilotAccessRequestSchema.safeParse({ allowed: 'yes' }).success).toBe(false)
  })
})
