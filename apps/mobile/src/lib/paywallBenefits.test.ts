import { PLAN_LIMITS, PRO_BENEFITS, type PlanLimits, type PlanTier } from '@langx/shared'
import { describe, expect, it } from 'vitest'
import { en } from '../i18n/messages/en'
import {
  BENEFIT_COPY,
  COMPARE_LEAD,
  HIGHLIGHT_COUNT,
  benefitsHeld,
  compareRows,
  compareStacked,
  fullyOn,
  highlightsFor,
  pendingTag,
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

  it('puts a feature in beta or not shipped last, and never ticks one that has not shipped', () => {
    const rows = compareRows()
    const partial = PRO_BENEFITS.filter((benefit) => !fullyOn(BENEFIT_COPY[benefit]))
    expect(partial).toContain('copilot')
    for (const benefit of partial) {
      if (!BENEFIT_COPY[benefit].shipped) expect(row(benefit).pro).toEqual({ kind: 'soon' })
    }
    expect(rows.slice(-partial.length).map((r) => r.benefit)).toEqual(partial)
    for (const benefit of PRO_BENEFITS.filter((b) => fullyOn(BENEFIT_COPY[b]))) {
      expect(row(benefit).tag).toBeNull()
    }
  })

  it('reads Copilot as both plans’ allowance, with Beta beside it', () => {
    expect(BENEFIT_COPY.copilot).toMatchObject({ shipped: true, beta: true })
    expect(row('copilot')).toEqual({
      benefit: 'copilot',
      label: 'paywall.compareCopilot',
      tag: 'paywall.betaTag',
      free: { kind: 'count', count: PLAN_LIMITS.free.copilotPer24h },
      pro: { kind: 'count', count: PLAN_LIMITS.pro.copilotPer24h },
    })
  })

  it('never reads Copilot as Pro-only, whatever its capability flag says', () => {
    const cells = row('copilot')
    expect(cells.free).not.toEqual({ kind: 'no' })
    expect(cells.pro).not.toEqual({ kind: 'yes' })
    const changed: Record<PlanTier, PlanLimits> = {
      free: { ...PLAN_LIMITS.free, copilotPer24h: 5 },
      pro: { ...PLAN_LIMITS.pro, copilotPer24h: 40 },
    }
    expect(row('copilot', changed)).toMatchObject({
      free: { kind: 'count', count: 5 },
      pro: { kind: 'count', count: 40 },
    })
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

describe('the Copilot copy', () => {
  it('quotes the free plan’s allowance from PLAN_LIMITS', () => {
    expect(BENEFIT_COPY.copilot.vars).toEqual({ count: PLAN_LIMITS.free.copilotPer24h })
    expect(en.paywall.copilotBody).toContain('{count}')
  })

  it('says Beta, and no longer that it is rolling out or may not be on', () => {
    expect(en.paywall.betaTag).toBe('Beta')
    for (const words of [en.paywall.copilot, en.paywall.copilotBody, en.paywall.betaTag]) {
      expect(words).not.toMatch(/rolling out|may not be on/i)
    }
  })
})

describe('pendingTag', () => {
  const base = BENEFIT_COPY.advancedFilters

  it('qualifies Copilot as a beta, and nothing that is on for everybody', () => {
    expect(pendingTag(BENEFIT_COPY.copilot)).toBe('paywall.betaTag')
    for (const benefit of PRO_BENEFITS.filter((b) => fullyOn(BENEFIT_COPY[b]))) {
      expect(pendingTag(BENEFIT_COPY[benefit])).toBeNull()
    }
  })

  it('says Soon for one that has not shipped, beta or not', () => {
    expect(pendingTag({ ...base, shipped: false })).toBe('paywall.compareSoon')
    expect(pendingTag({ ...base, shipped: false, beta: true })).toBe('paywall.compareSoon')
  })
})

describe('compareStacked', () => {
  /*
   * Measured on the web build at the default size: the column a row's name
   * has beside the two cells on a 320pt and a 375pt phone, and the widest
   * word of each language's widest name, hidden rows included.
   */
  const COLUMN = { 320: 92, 375: 147 }
  const WIDEST = {
    // "Übersetzungen pro Tag", a lead row; behind "And N more", "Ein Willkommenspaket".
    de: { lead: 116.7, all: 144.2 },
    // "Translations a day": a point over the column at 320, so it stacks there too.
    en: { lead: 93, all: 93 },
    // "Emporte tes expressions", a point under it.
    fr: { lead: 90.3, all: 91 },
  }

  it('stacks past the default text size, whatever fits', () => {
    expect(compareStacked({ fontScale: 1.01, column: COLUMN[375], words: [WIDEST.en.all] })).toBe(
      true,
    )
    expect(compareStacked({ fontScale: 3.571, column: 0, words: [] })).toBe(true)
  })

  it('stacks at the default size when a name’s word is wider than its column', () => {
    expect(
      compareStacked({ fontScale: 1, column: COLUMN[320], words: [44.4, WIDEST.de.lead] }),
    ).toBe(true)
    expect(compareStacked({ fontScale: 1, column: COLUMN[320], words: [WIDEST.en.all] })).toBe(true)
  })

  it('stays side by side where every word fits, as it always was', () => {
    // German at 375, every row counted: "Willkommenspaket" is 3pt inside.
    expect(compareStacked({ fontScale: 1, column: COLUMN[375], words: [WIDEST.de.all] })).toBe(
      false,
    )
    expect(compareStacked({ fontScale: 1, column: COLUMN[375], words: [WIDEST.en.all] })).toBe(
      false,
    )
    expect(compareStacked({ fontScale: 1, column: COLUMN[320], words: [WIDEST.fr.all] })).toBe(
      false,
    )
    // Below the default size too: what fits at 1× fits smaller.
    expect(compareStacked({ fontScale: 0.85, column: COLUMN[320], words: [WIDEST.fr.all] })).toBe(
      false,
    )
  })

  it('scales the 1× words down to the size a smaller text setting draws', () => {
    // German at Small (0.85) on a 360dp Android phone: "Willkommenspaket"
    // is 144.2 at 1× and drawn at about 122.6 in a 132 column.
    expect(compareStacked({ fontScale: 0.85, column: 132, words: [144.2] })).toBe(false)
    expect(compareStacked({ fontScale: 0.85, column: 120, words: [144.2] })).toBe(true)
  })

  it('keeps a word exactly as wide as its column beside the cells', () => {
    expect(compareStacked({ fontScale: 1, column: 92, words: [92] })).toBe(false)
    expect(compareStacked({ fontScale: 1, column: 92, words: [92.1] })).toBe(true)
  })

  it('counts one row alone, whichever it is', () => {
    const fits = [40, 60, 80]
    expect(compareStacked({ fontScale: 1, column: 92, words: fits })).toBe(false)
    expect(compareStacked({ fontScale: 1, column: 92, words: [...fits, 93] })).toBe(true)
    expect(compareStacked({ fontScale: 1, column: 92, words: [93, ...fits] })).toBe(true)
  })

  it('stays side by side until the column and the words are measured', () => {
    expect(compareStacked({ fontScale: 1, column: 0, words: [WIDEST.de.all] })).toBe(false)
    expect(compareStacked({ fontScale: 1, column: COLUMN[320], words: [] })).toBe(false)
  })
})
