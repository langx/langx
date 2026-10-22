import { PLAN_LIMITS, PRO_BENEFITS, type PlanLimits, type PlanTier } from '@langx/shared'
import { describe, expect, it } from 'vitest'
import {
  BENEFIT_COPY,
  COMPARE_LEAD,
  HIGHLIGHT_COUNT,
  benefitsHeld,
  compareRows,
  fullyOn,
  highlightsFor,
  sellableFeature,
} from './paywallBenefits'

function row(benefit: string, limits?: Record<PlanTier, PlanLimits>) {
  const found = compareRows(limits).find((candidate) => candidate.benefit === benefit)
  if (!found) throw new Error(`no row for ${benefit}`)
  return found
}

describe('compareRows', () => {
  it('has one row per Pro benefit, the lead rows first', () => {
    const rows = compareRows()
    expect(rows.map((r) => r.benefit).sort()).toEqual([...PRO_BENEFITS].sort())
    expect(rows.slice(0, COMPARE_LEAD.length).map((r) => r.benefit)).toEqual(COMPARE_LEAD)
  })

  it('reads every number off PLAN_LIMITS', () => {
    expect(row('unlimitedInitiations').free).toEqual({
      kind: 'count',
      count: PLAN_LIMITS.free.initiationsPer24h,
    })
    expect(row('translationQuota').free).toEqual({
      kind: 'count',
      count: PLAN_LIMITS.free.translationsPer24h,
    })
    expect(row('learningLanguages')).toMatchObject({
      free: { kind: 'count', count: PLAN_LIMITS.free.maxLearningLanguages },
      pro: { kind: 'count', count: PLAN_LIMITS.pro.maxLearningLanguages },
    })
  })

  it('calls a null limit unlimited', () => {
    expect(PLAN_LIMITS.pro.initiationsPer24h).toBeNull()
    expect(row('unlimitedInitiations').pro).toEqual({ kind: 'unlimited' })
    expect(row('translationQuota').pro).toEqual({ kind: 'unlimited' })
  })

  it('follows the config when a limit changes', () => {
    const changed: Record<PlanTier, PlanLimits> = {
      free: { ...PLAN_LIMITS.free, initiationsPer24h: 7, advancedFilters: true },
      pro: { ...PLAN_LIMITS.pro, translationsPer24h: 2000 },
    }
    expect(row('unlimitedInitiations', changed).free).toEqual({ kind: 'count', count: 7 })
    expect(row('translationQuota', changed).pro).toEqual({ kind: 'count', count: 2000 })
    expect(row('advancedFilters', changed).free).toEqual({ kind: 'yes' })
  })

  it('ticks a capability only on the tier that has it', () => {
    for (const benefit of ['advancedFilters', 'profileViewerIdentities', 'nearby', 'incognito']) {
      expect(row(benefit)).toMatchObject({ free: { kind: 'no' }, pro: { kind: 'yes' } })
    }
  })

  it('never ticks a feature that is not on for every buyer, and puts it last', () => {
    const rows = compareRows()
    const partial = PRO_BENEFITS.filter((benefit) => !fullyOn(BENEFIT_COPY[benefit]))
    expect(partial).toContain('copilot')
    for (const benefit of partial) {
      expect(row(benefit).pro).toEqual({ kind: BENEFIT_COPY[benefit].shipped ? 'beta' : 'soon' })
    }
    expect(rows.slice(-partial.length).map((r) => r.benefit)).toEqual(partial)
  })

  it('reads Copilot as a beta, not as coming', () => {
    expect(BENEFIT_COPY.copilot).toMatchObject({ shipped: true, beta: true })
    expect(row('copilot').pro).toEqual({ kind: 'beta' })
  })

  it('gives the welcome pack to Pro only', () => {
    expect(row('welcomePack')).toMatchObject({ free: { kind: 'no' }, pro: { kind: 'yes' } })
  })

  it('labels a quota row by what it counts, not by what Pro makes of it', () => {
    expect(row('unlimitedInitiations').label).toBe('paywall.compareNewChats')
    expect(row('advancedFilters').label).toBe(BENEFIT_COPY.advancedFilters.title)
  })
})

describe('highlightsFor', () => {
  it('leads with the everyday limits', () => {
    expect(highlightsFor(null)).toEqual([
      'unlimitedInitiations',
      'translationQuota',
      'profileViewerIdentities',
    ])
  })

  it('puts the refused feature first, once', () => {
    const rows = highlightsFor('advancedFilters')
    expect(rows[0]).toBe('advancedFilters')
    expect(rows).toHaveLength(HIGHLIGHT_COUNT)
    expect(new Set(rows).size).toBe(rows.length)
    expect(highlightsFor('profileViewerIdentities')[0]).toBe('profileViewerIdentities')
    expect(highlightsFor('nearby')).toEqual(['nearby', 'unlimitedInitiations', 'translationQuota'])
  })
})

describe('sellableFeature', () => {
  it('names a shipped capability', () => {
    expect(sellableFeature('advancedFilters')).toBe('advancedFilters')
    expect(sellableFeature('profileViewerIdentities')).toBe('profileViewerIdentities')
  })

  it('never sells one in beta as part of Pro', () => {
    expect(BENEFIT_COPY.copilot.beta).toBe(true)
    expect(sellableFeature('copilot')).toBeNull()
  })

  it('passes no gate through as none', () => {
    expect(sellableFeature(null)).toBeNull()
  })
})

describe('benefitsHeld', () => {
  it('ticks the welcome pack only for somebody who was handed it', () => {
    expect(benefitsHeld({ pro: '2026-10-01T00:00:00.000Z' })).toEqual(PRO_BENEFITS)
    expect(benefitsHeld({ pro_plus: '2026-09-01T00:00:00.000Z' })).toEqual(PRO_BENEFITS)
    const gift = benefitsHeld(undefined)
    expect(gift).not.toContain('welcomePack')
    expect(gift).toHaveLength(PRO_BENEFITS.length - 1)
    expect(benefitsHeld({})).toEqual(gift)
  })
})
