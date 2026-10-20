import { SUPPORTED_LOCALES } from '@langx/shared'
import { describe, expect, it } from 'vitest'
import { createTranslate } from '../i18n/runtime'
import {
  HIDDEN_MODE_CHILDREN,
  SETTINGS_V3_LAYOUT,
  V3_BLOCK_IDS,
  V3_ROW_IDS,
  V3_SOLO_BLOCK_IDS,
} from './settingsLayoutV3'
import { SETTINGS_SECTIONS } from './settingsRegistry'

/**
 * The v3 pages draw their rows from this grouping, so a row the registry has
 * and the grouping lacks would be on the old page and in the search, and
 * missing from the new page without a word.
 */
describe('SETTINGS_V3_LAYOUT', () => {
  it('places every registry row exactly once, on its own page', () => {
    for (const section of SETTINGS_SECTIONS) {
      const placed = SETTINGS_V3_LAYOUT[section.id].flatMap((group) => group.ids)
      expect(new Set(placed).size, section.id).toBe(placed.length)
      expect([...placed].sort(), section.id).toEqual(section.items.map((i) => i.id).sort())
    }
  })

  it('keeps the rows under hidden mode in the group that holds its switch', () => {
    const group = SETTINGS_V3_LAYOUT.privacy.find((g) => g.ids.includes('privacy.hiddenMode'))
    for (const id of HIDDEN_MODE_CHILDREN) expect(group?.ids).toContain(id)
  })

  /*
   * Placing a row is not drawing it: `SettingsRowV3` draws nothing for an id
   * it has no case for. Every row has to be claimed by exactly one drawer —
   * a `SettingsRowV3` case, a page block, hidden mode's nest, or the
   * notification table — or it is on the old page and missing from the new.
   */
  it('gives every registry row exactly one thing that draws it', () => {
    const table = new Set(
      Object.values(SETTINGS_V3_LAYOUT)
        .flat()
        .filter((g) => g.kind === 'notifications')
        .flatMap((g) => g.ids),
    )
    const drawers: [string, ReadonlySet<string>][] = [
      ['row', new Set<string>(V3_ROW_IDS)],
      ['block', V3_BLOCK_IDS],
      ['nest', HIDDEN_MODE_CHILDREN],
      ['table', table],
    ]
    const registry = SETTINGS_SECTIONS.flatMap((s) => s.items.map((i) => i.id))
    for (const id of registry) {
      const claimed = drawers.filter(([, ids]) => ids.has(id)).map(([name]) => name)
      expect(claimed, id).toHaveLength(1)
    }
    for (const [, ids] of drawers) for (const id of ids) expect(registry, id).toContain(id)
  })

  it('draws the plan and share pages whole, and the block groups alone', () => {
    for (const id of ['plan', 'share'] as const) {
      for (const g of SETTINGS_V3_LAYOUT[id])
        for (const row of g.ids) expect(V3_BLOCK_IDS).toContain(row)
    }
    for (const groups of Object.values(SETTINGS_V3_LAYOUT)) {
      for (const g of groups) {
        if (g.ids.some((id) => V3_SOLO_BLOCK_IDS.has(id))) expect(g.ids).toHaveLength(1)
      }
    }
  })

  it('nests exactly the four rows HiddenModeNestV3 draws', () => {
    expect([...HIDDEN_MODE_CHILDREN].sort()).toEqual([
      'privacy.discoverable',
      'privacy.hideOnline',
      'privacy.incognito',
      'privacy.refuseNewChats',
    ])
  })

  it('resolves every heading in every locale', () => {
    for (const locale of SUPPORTED_LOCALES) {
      const t = createTranslate(locale)
      for (const groups of Object.values(SETTINGS_V3_LAYOUT)) {
        for (const group of groups) {
          if (group.headingKey) expect(t(group.headingKey), locale).not.toMatch(/^settings\./)
        }
      }
    }
  })
})
