import { SUPPORTED_LOCALES } from '@langx/shared'
import { describe, expect, it } from 'vitest'
import { createTranslate } from '../i18n/runtime'
import { HIDDEN_MODE_CHILDREN, SETTINGS_V3_LAYOUT } from './settingsLayoutV3'
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
